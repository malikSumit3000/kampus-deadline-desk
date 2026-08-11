import test from "node:test";
import assert from "node:assert/strict";
import { buildSecurityHeaders } from "../lib/security/headers.ts";

test("builds a strict production CSP with a request nonce and Supabase origin", () => {
  const headers = buildSecurityHeaders({
    nonce: "fixed-nonce",
    isDevelopment: false,
    supabaseUrl: "https://project.supabase.co",
  });

  assert.match(headers["Content-Security-Policy"], /script-src 'self' 'nonce-fixed-nonce' 'strict-dynamic'/);
  assert.match(headers["Content-Security-Policy"], /connect-src 'self' https:\/\/project\.supabase\.co/);
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.doesNotMatch(headers["Content-Security-Policy"], /unsafe-eval/);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(headers["Permissions-Policy"], "camera=(), microphone=(), geolocation=(), payment=()");
});

test("allows the development evaluator without weakening production", () => {
  const headers = buildSecurityHeaders({
    nonce: "dev-nonce",
    isDevelopment: true,
    supabaseUrl: "not-a-url",
  });

  assert.match(headers["Content-Security-Policy"], /'unsafe-eval'/);
  assert.match(headers["Content-Security-Policy"], /style-src 'self' 'unsafe-inline'/);
  assert.match(headers["Content-Security-Policy"], /connect-src 'self'/);
});
