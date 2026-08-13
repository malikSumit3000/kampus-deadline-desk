import { NextResponse } from "next/server";
import { canManageAccount, parseAdminAccountAction, removalEmailMatches } from "@/lib/admin/accounts";
import { requireActiveAccount } from "@/lib/auth/account-guard";
import { revokeEncryptedGoogleToken } from "@/lib/google/revoke";

async function targetFor(access: Awaited<ReturnType<typeof requireActiveAccount>>, id: string) {
  if (!access.ok) return null;
  const { data } = await access.admin.from("profiles").select("id,email,is_admin").eq("id", id).maybeSingle();
  return data ? { id: data.id as string, email: data.email as string, isAdmin: data.is_admin === true } : null;
}

async function encryptedConnection(access: Extract<Awaited<ReturnType<typeof requireActiveAccount>>, { ok: true }>, id: string) {
  const { data } = await access.admin.from("gmail_connections").select("encrypted_refresh_token").eq("user_id", id).maybeSingle();
  return data?.encrypted_refresh_token as string | undefined;
}

function adminRequired(access: Extract<Awaited<ReturnType<typeof requireActiveAccount>>, { ok: true }>) {
  return access.profile.is_admin ? null : NextResponse.json({ error: "Administrator access required.", code: "admin_required" }, { status: 403 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const denied = adminRequired(access);
  if (denied) return denied;
  const { id } = await context.params;
  const action = parseAdminAccountAction(await request.json().catch(() => null));
  if (!action) return NextResponse.json({ error: "Invalid account action." }, { status: 400 });
  const target = await targetFor(access, id);
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!canManageAccount(access.user.id, target)) return NextResponse.json({ error: "Administrators cannot manage this account." }, { status: 403 });

  const encryptedToken = action === "block" ? await encryptedConnection(access, id) : undefined;
  const { data, error } = await access.admin.rpc("set_account_status", {
    p_actor_id: access.user.id,
    p_target_id: id,
    p_status: action === "block" ? "blocked" : "active",
  });
  if (error) return NextResponse.json({ error: "Account status could not be changed." }, { status: 500 });
  if (action === "block") await revokeEncryptedGoogleToken(encryptedToken);
  return NextResponse.json({ account: data });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const denied = adminRequired(access);
  if (denied) return denied;
  const { id } = await context.params;
  const target = await targetFor(access, id);
  if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  if (!canManageAccount(access.user.id, target)) return NextResponse.json({ error: "Administrators cannot remove this account." }, { status: 403 });
  const body = await request.json().catch(() => null) as { confirmationEmail?: unknown } | null;
  if (!removalEmailMatches(body?.confirmationEmail, target.email)) return NextResponse.json({ error: "Type the exact account email to confirm removal." }, { status: 400 });

  const targetId = target.id;
  const auditBase = { actor_id: access.user.id, target_type: "profile", target_id: targetId };
  const { error: auditRequestError } = await access.admin.from("audit_events").insert({ ...auditBase, event_type: "admin.account_remove_requested", metadata: { status: "started" } });
  if (auditRequestError) return NextResponse.json({ error: "Account removal could not be audited, so no data was deleted." }, { status: 500 });
  const encryptedToken = await encryptedConnection(access, targetId);
  await revokeEncryptedGoogleToken(encryptedToken);
  const { error } = await access.admin.auth.admin.deleteUser(targetId);
  if (error) {
    await access.admin.from("audit_events").insert({ ...auditBase, event_type: "admin.account_remove_failed", metadata: { status: "failed", failure_code: "auth_delete_failed" } });
    return NextResponse.json({ error: "Account could not be permanently removed." }, { status: 500 });
  }
  await access.admin.from("audit_events").insert({ ...auditBase, event_type: "admin.account_removed", metadata: { status: "succeeded" } });
  return NextResponse.json({ removedId: targetId });
}
