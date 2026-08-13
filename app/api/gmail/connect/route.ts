import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { normalizeIimkEmail } from "@/lib/auth/domain-policy";
import { requireActiveAccount } from "@/lib/auth/account-guard";
import { googleAuthorizationUrl } from "@/lib/google/oauth";

export async function GET(request: Request) {
  const access = await requireActiveAccount();
  if (!access.ok) return access.response;
  const email = normalizeIimkEmail(access.user.email);
  if (!email) return NextResponse.redirect(new URL("/login", request.url));

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
