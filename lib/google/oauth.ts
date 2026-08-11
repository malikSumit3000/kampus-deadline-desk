export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function googleAuthorizationUrl({
  origin,
  state,
  loginHint,
}: {
  origin: string;
  state: string;
  loginHint: string;
}) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/gmail/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: `${GMAIL_READONLY_SCOPE} https://www.googleapis.com/auth/userinfo.email`,
    state,
    login_hint: loginHint,
    hd: "iimk.ac.in",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string, origin: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/gmail/callback`,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!response.ok) throw new Error("Google token exchange failed");
  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  }>;
}

export async function googleAccountEmail(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not verify connected Google account");
  const data = (await response.json()) as { email?: string; verified_email?: boolean };
  if (!data.verified_email) throw new Error("Google account email is not verified");
  return data.email ?? null;
}

