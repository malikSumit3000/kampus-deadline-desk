import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createServerClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createAdminClient,
}));

import { DELETE as deleteAccount } from "../app/api/account/route";
import { GET as listAdminAccounts } from "../app/api/admin/accounts/route";
import { DELETE as deleteAgenda } from "../app/api/agendas/[id]/route";
import { DELETE as clearPrivateAgendas } from "../app/api/agendas/route";
import { POST as askKampus } from "../app/api/ask-kampus/route";
import { POST as syncGmail } from "../app/api/gmail/sync/route";
import { PATCH as resolveProposal } from "../app/api/moderator/proposals/[id]/route";
import { PATCH as resolveReview } from "../app/api/reviews/[id]/route";

function unauthenticatedClient() {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } };
}

function authenticatedClient() {
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "student@iimk.ac.in" } } }) } };
}

function connectionQuery(connection: unknown) {
  return {
    select() { return this; },
    eq() { return this; },
    is() { return this; },
    maybeSingle: vi.fn().mockResolvedValue({ data: connection }),
  };
}

function profileQuery(profile: unknown = {
  id: "user-1",
  email: "student@iimk.ac.in",
  display_name: "Student One",
  role: "student",
  is_admin: false,
  account_status: "active",
}) {
  return {
    select() { return this; },
    eq() { return this; },
    maybeSingle: vi.fn().mockResolvedValue({ data: profile }),
  };
}

describe("route authorization boundaries", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset();
    mocks.createAdminClient.mockReset();
    mocks.createServerClient.mockResolvedValue(unauthenticatedClient());
  });

  it("returns a stable Ask Kampus unavailable response without accessing user data", async () => {
    const response = await askKampus();

    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      code: "ask_kampus_unavailable",
      error: "Ask Kampus is coming soon.",
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated Gmail sync and account deletion", async () => {
    expect((await syncGmail()).status).toBe(401);
    expect((await deleteAccount()).status).toBe(401);
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects legacy moderator labels before authentication or database access", async () => {
    const response = await resolveProposal(new Request("http://localhost/api/moderator/proposals/p-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "Merged and approved" }),
    }), { params: Promise.resolve({ id: "p-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("resolves a review atomically and returns the created private agenda", async () => {
    mocks.createServerClient.mockResolvedValue(authenticatedClient());
    const rpc = vi.fn().mockResolvedValue({
      data: {
        status: "approved",
        agenda: {
          id: "private-3",
          title: "Marketing submission",
          category: "Academics",
          detail: "Upload the PDF",
          source_label: "Gmail review",
          confidence: 0.91,
          deadline: "2026-08-20T12:30:00.000Z",
          status: "to-do",
        },
      },
      error: null,
    });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(profileQuery()), rpc });

    const response = await resolveReview(new Request("http://localhost/api/reviews/review-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    }), { params: Promise.resolve({ id: "review-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: "approved", agenda: { id: "private-3" } });
    expect(rpc).toHaveBeenCalledWith("resolve_review_item", {
      p_actor_id: "user-1",
      p_review_id: "review-1",
      p_action: "approve",
    });
  });

  it("rejects legacy review labels before authentication or database access", async () => {
    const response = await resolveReview(new Request("http://localhost/api/reviews/review-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "Approved" }),
    }), { params: Promise.resolve({ id: "review-1" }) });

    expect(response.status).toBe(400);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns a conflict when the Gmail sync lease is already held", async () => {
    mocks.createServerClient.mockResolvedValue(authenticatedClient());
    const rpc = vi.fn().mockResolvedValue({ data: [{ run_id: null, acquired: false }], error: null });
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "profiles" ? profileQuery() : connectionQuery({ encrypted_refresh_token: "unused", scan_after: "2026-08-11T00:00:00.000Z" })),
      rpc,
    });

    const response = await syncGmail();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "An inbox refresh is already running." });
    expect(rpc).toHaveBeenCalledWith("start_gmail_sync", { p_user_id: "user-1", p_lease_seconds: 75 });
  });

  it("keeps another student's private task untouched", async () => {
    const records = [{ id: "private-2", user_id: "user-2" }];
    const filters: Record<string, string> = {};
    const deleteQuery = {
      delete() { return this; },
      eq(column: string, value: string) { filters[column] = value; return this; },
      then(resolve: (value: { error: null }) => unknown) {
        const index = records.findIndex((record) => Object.entries(filters).every(([key, value]) => record[key as keyof typeof record] === value));
        if (index >= 0) records.splice(index, 1);
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    mocks.createServerClient.mockResolvedValue({
      ...authenticatedClient(),
      from: vi.fn().mockReturnValue(deleteQuery),
    });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(profileQuery()) });

    const response = await deleteAgenda(new Request("http://localhost/api/agendas/private-2?scope=private", { method: "DELETE" }), {
      params: Promise.resolve({ id: "private-2" }),
    });

    expect(response.status).toBe(200);
    expect(records).toEqual([{ id: "private-2", user_id: "user-2" }]);
    expect(filters).toEqual({ id: "private-2", user_id: "user-1" });
  });

  it("clears private tasks through the authenticated user's atomic RPC", async () => {
    mocks.createServerClient.mockResolvedValue(authenticatedClient());
    const rpc = vi.fn().mockResolvedValue({ data: 4, error: null });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(profileQuery()), rpc });

    const response = await clearPrivateAgendas();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedCount: 4 });
    expect(rpc).toHaveBeenCalledWith("clear_private_agendas", { p_user_id: "user-1" });
  });

  it("deletes only the authenticated account id", async () => {
    mocks.createServerClient.mockResolvedValue(authenticatedClient());
    const deletedIds: string[] = [];
    mocks.createAdminClient.mockReturnValue({
      from: vi.fn((table: string) => table === "profiles" ? profileQuery() : connectionQuery(null)),
      auth: { admin: { deleteUser: vi.fn(async (id: string) => {
        deletedIds.push(id);
        return { error: null };
      }) } },
    });

    const response = await deleteAccount();

    expect(response.status).toBe(200);
    expect(deletedIds).toEqual(["user-1"]);
  });

  it("denies the account monitor to an active non-admin", async () => {
    mocks.createServerClient.mockResolvedValue(authenticatedClient());
    const rpc = vi.fn();
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(profileQuery()), rpc });

    const response = await listAdminAccounts();

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "admin_required" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns only approved operational account fields to an admin", async () => {
    mocks.createServerClient.mockResolvedValue(authenticatedClient());
    const adminProfile = { id: "user-1", email: "student@iimk.ac.in", display_name: "Sumit", role: "moderator", is_admin: true, account_status: "active" };
    const rpc = vi.fn().mockResolvedValue({ data: [{
      id: "user-2", display_name: "Student Two", email: "two@iimk.ac.in", role: "student", is_admin: false,
      account_status: "active", created_at: "2026-08-13T00:00:00.000Z", gmail_connected: true,
      last_sync_at: null, sync_error_code: null, private_task_count: 3, open_review_count: 1,
      subject: "secret subject", encrypted_refresh_token: "secret token",
    }], error: null });
    mocks.createAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(profileQuery(adminProfile)), rpc });

    const response = await listAdminAccounts();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.accounts[0]).toEqual({
      id: "user-2", name: "Student Two", email: "two@iimk.ac.in", role: "student", isAdmin: false,
      status: "active", joinedAt: "2026-08-13T00:00:00.000Z", gmailConnected: true,
      lastSyncAt: null, syncErrorCode: null, privateTaskCount: 3, openReviewCount: 1,
    });
  });
});
