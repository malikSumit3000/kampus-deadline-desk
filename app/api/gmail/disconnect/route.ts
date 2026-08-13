import { NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/account-guard";
import { revokeEncryptedGoogleToken } from "@/lib/google/revoke";

export async function POST(request: Request) {
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const { data } = await access.admin.from("gmail_connections")
    .select("encrypted_refresh_token").eq("user_id", access.user.id).maybeSingle();
  await revokeEncryptedGoogleToken(data?.encrypted_refresh_token);
  await access.admin.from("gmail_connections").delete().eq("user_id", access.user.id);
  return NextResponse.redirect(new URL("/?gmail=disconnected", request.url), { status: 303 });
}
