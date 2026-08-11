const IIMK_DOMAIN = "iimk.ac.in";

export function normalizeIimkEmail(
  value: string | null | undefined,
): string | null {
  const email = value?.trim().toLowerCase();

  if (!email || /\s/.test(email)) return null;

  const at = email.lastIndexOf("@");
  if (at <= 0 || email.slice(at + 1) !== IIMK_DOMAIN) return null;

  return email;
}

