import { decryptToken } from "@/lib/security/token-crypto";

export async function revokeEncryptedGoogleToken(encryptedToken: string | null | undefined) {
  if (!encryptedToken) return;
  try {
    const token = decryptToken(encryptedToken, process.env.TOKEN_ENCRYPTION_KEY!);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // The database block/removal remains authoritative if Google is unavailable.
  }
}
