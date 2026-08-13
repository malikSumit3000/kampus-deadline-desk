import { NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/account-guard";

export async function DELETE() {
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { data, error } = await access.admin.rpc("clear_private_agendas", { p_user_id: access.user.id });
  if (error) return NextResponse.json({ error: "Private tasks could not be deleted." }, { status: 500 });
  return NextResponse.json({ deletedCount: Number(data ?? 0) });
}
