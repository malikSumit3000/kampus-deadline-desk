import { NextResponse } from "next/server";
import { decryptToken } from "@/lib/security/token-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const { data: connection } = await admin.from("gmail_connections")
    .select("encrypted_refresh_token").eq("user_id", user.id).maybeSingle();
  if (connection?.encrypted_refresh_token) {
    const token = decryptToken(connection.encrypted_refresh_token, process.env.TOKEN_ENCRYPTION_KEY!);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }).catch(() => undefined);
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  return error ? NextResponse.json({ error: "Deletion failed" }, { status: 500 }) : NextResponse.json({ ok: true });
}
