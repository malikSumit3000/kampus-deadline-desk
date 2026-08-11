import assert from "node:assert/strict";
import test from "node:test";

import { normalizeIimkEmail } from "../lib/auth/domain-policy.ts";

test("accepts and normalizes a verified IIMK address", () => {
  assert.equal(
    normalizeIimkEmail("  MBA26SUMIT@IIMK.AC.IN  "),
    "mba26sumit@iimk.ac.in",
  );
});

test("rejects personal Google addresses", () => {
  assert.equal(normalizeIimkEmail("sumit@gmail.com"), null);
});

test("rejects lookalike and subdomain addresses", () => {
  assert.equal(normalizeIimkEmail("sumit@iimk.ac.in.example.com"), null);
  assert.equal(normalizeIimkEmail("sumit@student.iimk.ac.in"), null);
});
