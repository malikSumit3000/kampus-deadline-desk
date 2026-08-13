import test from "node:test";
import assert from "node:assert/strict";
import { accountAccessDecision } from "../lib/auth/account-policy.ts";

test("requires authentication before protected work", () => {
  assert.deepEqual(accountAccessDecision(null, null), { allowed: false, status: 401, code: "unauthorized" });
});

test("blocked profiles are denied even with a valid auth session", () => {
  assert.deepEqual(accountAccessDecision({ id: "user-1" }, { account_status: "blocked" }), { allowed: false, status: 403, code: "account_blocked" });
});

test("an active profile is allowed", () => {
  assert.deepEqual(accountAccessDecision({ id: "user-1" }, { account_status: "active" }), { allowed: true });
});

test("missing profiles fail closed", () => {
  assert.deepEqual(accountAccessDecision({ id: "user-1" }, null), { allowed: false, status: 403, code: "profile_unavailable" });
});
