import assert from "node:assert/strict";
import test from "node:test";

import { decryptToken, encryptToken } from "../lib/security/token-crypto.ts";

const key = Buffer.alloc(32, 7).toString("base64");

test("encrypts and decrypts a Gmail refresh token", () => {
  const encrypted = encryptToken("refresh-token-value", key);

  assert.notEqual(encrypted, "refresh-token-value");
  assert.equal(decryptToken(encrypted, key), "refresh-token-value");
});

test("uses a unique nonce for each encryption", () => {
  assert.notEqual(encryptToken("same", key), encryptToken("same", key));
});

test("rejects malformed keys", () => {
  assert.throws(() => encryptToken("token", "too-short"), /32 bytes/);
});

test("detects modified ciphertext", () => {
  const encrypted = encryptToken("secret", key);
  const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;

  assert.throws(() => decryptToken(tampered, key));
});

