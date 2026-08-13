import { NextResponse } from "next/server";
import { sanitizeAdminAccountRow } from "@/lib/admin/accounts";
import { requireActiveAccount } from "@/lib/auth/account-guard";

export async function GET() {
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  if (!access.profile.is_admin) return NextResponse.json({ error: "Administrator access required.", code: "admin_required" }, { status: 403 });

  const { data, error } = await access.admin.rpc("list_admin_accounts", { p_actor_id: access.user.id, p_limit: 200 });
  if (error) return NextResponse.json({ error: "Account status could not be loaded." }, { status: 500 });
  const accounts = ((data ?? []) as Record<string, unknown>[]).map(sanitizeAdminAccountRow);
  return NextResponse.json({ accounts });
}
