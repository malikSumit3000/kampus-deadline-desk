import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizeIimkEmail } from "@/lib/auth/domain-policy";
import { googleAuthorizationUrl } from "@/lib/google/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = normalizeIimkEmail(user?.email);
  if (!user || !email) return NextResponse.redirect(new URL("/login", request.url));

  const state = randomBytes(32).toString("base64url");
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(googleAuthorizationUrl({ origin, state, loginHint: email }));
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/gmail/callback",
    maxAge: 600,
  });
  return response;
}

