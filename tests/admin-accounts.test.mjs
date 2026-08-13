import test from "node:test";
import assert from "node:assert/strict";
import {
  canManageAccount,
  parseAdminAccountAction,
  removalEmailMatches,
  sanitizeAdminAccountRow,
} from "../lib/admin/accounts.ts";

test("accepts only block and unblock account actions", () => {
  assert.equal(parseAdminAccountAction({ action: "block" }), "block");
  assert.equal(parseAdminAccountAction({ action: "unblock" }), "unblock");
  assert.equal(parseAdminAccountAction({ action: "remove" }), null);
  assert.equal(parseAdminAccountAction({}), null);
});

test("prevents an administrator from managing self or another administrator", () => {
  assert.equal(canManageAccount("actor-1", { id: "student-1", isAdmin: false }), true);
  assert.equal(canManageAccount("actor-1", { id: "actor-1", isAdmin: false }), false);
  assert.equal(canManageAccount("actor-1", { id: "admin-2", isAdmin: true }), false);
});

test("permanent removal requires the exact account email after harmless trimming", () => {
  assert.equal(removalEmailMatches(" student@iimk.ac.in ", "student@iimk.ac.in"), true);
  assert.equal(removalEmailMatches("Student@iimk.ac.in", "student@iimk.ac.in"), false);
  assert.equal(removalEmailMatches("student", "student@iimk.ac.in"), false);
});

test("admin account rows expose only the approved operational fields", () => {
  assert.deepEqual(sanitizeAdminAccountRow({
    id: "student-1",
    display_name: "Student One",
    email: "student@iimk.ac.in",
    role: "student",
    is_admin: false,
    account_status: "active",
    created_at: "2026-08-13T00:00:00.000Z",
    gmail_connected: true,
    last_sync_at: "2026-08-13T01:00:00.000Z",
    sync_error_code: "gmail_rate_limited",
    private_task_count: 4,
    open_review_count: 2,
    subject: "must not leak",
    task_title: "must not leak",
    encrypted_refresh_token: "must not leak",
  }), {
    id: "student-1",
    name: "Student One",
    email: "student@iimk.ac.in",
    role: "student",
    isAdmin: false,
    status: "active",
    joinedAt: "2026-08-13T00:00:00.000Z",
    gmailConnected: true,
    lastSyncAt: "2026-08-13T01:00:00.000Z",
    syncErrorCode: "gmail_rate_limited",
    privateTaskCount: 4,
    openReviewCount: 2,
  });
});
