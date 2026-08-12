type SecurityHeaderOptions = {
  nonce: string;
  isDevelopment: boolean;
  supabaseUrl?: string;
};

function safeOrigin(value?: string) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function buildSecurityHeaders({ nonce, isDevelopment, supabaseUrl }: SecurityHeaderOptions) {
  const supabaseOrigin = safeOrigin(supabaseUrl);
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];

  return {
    "Content-Security-Policy": `${directives.join("; ")};`,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  } as const;
}
