import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAllowanceResult,
  parseModeratorDecision,
  parseSyncLease,
} from "../lib/reliability/rpc-contracts.ts";

test("parses an acquired Gmail sync lease", () => {
  assert.deepEqual(parseSyncLease([{ run_id: "run-1", acquired: true }]), { runId: "run-1" });
  assert.equal(parseSyncLease([{ run_id: null, acquired: false }]), null);
  assert.equal(parseSyncLease(null), null);
});

test("parses an atomically consumed Ask Kampus allowance", () => {
  assert.deepEqual(
    parseAllowanceResult([{ allowed: true, audit_id: 42, used: 3, remaining: 7 }]),
    { allowed: true, auditId: 42, used: 3, remaining: 7 },
  );
  assert.deepEqual(
    parseAllowanceResult([{ allowed: false, audit_id: null, used: 10, remaining: 0 }]),
    { allowed: false, auditId: null, used: 10, remaining: 0 },
  );
  assert.equal(parseAllowanceResult([]), null);
});

test("accepts only machine-readable moderator decisions", () => {
  assert.equal(parseModeratorDecision("approve"), "approve");
  assert.equal(parseModeratorDecision("private"), "private");
  assert.equal(parseModeratorDecision("reject"), "reject");
  assert.equal(parseModeratorDecision("Merged and approved"), null);
  assert.equal(parseModeratorDecision("anything"), null);
});
