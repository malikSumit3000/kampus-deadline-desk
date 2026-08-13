import { NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/account-guard";
import { revokeEncryptedGoogleToken } from "@/lib/google/revoke";

export async function DELETE() {
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { data: connection } = await access.admin.from("gmail_connections")
    .select("encrypted_refresh_token").eq("user_id", access.user.id).maybeSingle();
  await revokeEncryptedGoogleToken(connection?.encrypted_refresh_token);
  const { error } = await access.admin.auth.admin.deleteUser(access.user.id);
  return error ? NextResponse.json({ error: "Deletion failed" }, { status: 500 }) : NextResponse.json({ ok: true });
}
