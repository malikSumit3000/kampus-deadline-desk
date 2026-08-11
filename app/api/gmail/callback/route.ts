import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { normalizeIimkEmail } from "@/lib/auth/domain-policy";
import { exchangeGoogleCode, googleAccountEmail } from "@/lib/google/oauth";
import { encryptToken } from "@/lib/security/token-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function back(request: Request, status: string) {
  return NextResponse.redirect(new URL(`/?gmail=${encodeURIComponent(status)}`, request.url));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gmail_oauth_state")?.value;
  cookieStore.delete("gmail_oauth_state");
  if (!code || !state || state !== expectedState) return back(request, "invalid_state");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const signedInEmail = normalizeIimkEmail(user?.email);
  if (!user || !signedInEmail) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const tokens = await exchangeGoogleCode(code, url.origin);
    const connectedEmail = normalizeIimkEmail(await googleAccountEmail(tokens.access_token));
    if (!connectedEmail || connectedEmail !== signedInEmail || !tokens.refresh_token) {
      return back(request, "account_mismatch");
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("gmail_connections").upsert({
      user_id: user.id,
      google_email: connectedEmail,
      encrypted_refresh_token: encryptToken(tokens.refresh_token, process.env.TOKEN_ENCRYPTION_KEY!),
      connected_at: new Date().toISOString(),
      scan_after: new Date().toISOString(),
      revoked_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return back(request, "connected");
  } catch {
    return back(request, "failed");
  }
}

