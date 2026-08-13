import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminView from "../app/dashboard/AdminView";

const admin = {
  id: "admin-1", name: "Sumit Malik", email: "mba26sumit@iimk.ac.in", role: "moderator" as const,
  isAdmin: true, status: "active" as const, joinedAt: "2026-08-10T00:00:00.000Z",
  gmailConnected: true, lastSyncAt: "2026-08-13T01:00:00.000Z", syncErrorCode: null,
  privateTaskCount: 2, openReviewCount: 0,
};

const student = {
  id: "student-1", name: "Student One", email: "student@iimk.ac.in", role: "student" as const,
  isAdmin: false, status: "active" as const, joinedAt: "2026-08-12T00:00:00.000Z",
  gmailConnected: true, lastSyncAt: "2026-08-13T02:00:00.000Z", syncErrorCode: "gmail_rate_limited",
  privateTaskCount: 4, openReviewCount: 2,
};

describe("Account monitor", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads privacy-safe operational summaries and blocks an account without reloading", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accounts: [admin, student] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ account: { id: student.id, status: "blocked", gmailConnected: false } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const notices: string[] = [];
    const user = userEvent.setup();
    render(<AdminView currentUserId="admin-1" setNotice={(message) => notices.push(message)} />);

    expect(await screen.findByRole("heading", { name: "Account monitor" })).toBeInTheDocument();
    expect(screen.getByText("2", { selector: ".admin-stat-total strong" })).toBeInTheDocument();
    const studentRow = screen.getByRole("row", { name: /student one/i });
    expect(within(studentRow).getByText("gmail_rate_limited")).toBeInTheDocument();
    expect(screen.queryByText(/subject|task title|refresh token/i)).not.toBeInTheDocument();

    await user.click(within(studentRow).getByRole("button", { name: "Block account" }));
    const dialog = screen.getByRole("dialog", { name: "Block Student One?" });
    await user.click(within(dialog).getByRole("button", { name: "Block account" }));

    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/accounts/student-1", expect.objectContaining({ method: "PATCH" }));
    expect(await screen.findByRole("row", { name: /student one.*blocked/i })).toBeInTheDocument();
    expect(notices.at(-1)).toBe("Student One is blocked and Gmail was disconnected.");
  });

  it("requires the exact email before permanent removal", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ accounts: [admin, { ...student, status: "blocked" }] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ removedId: student.id }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AdminView currentUserId="admin-1" setNotice={() => undefined} />);
    const studentRow = await screen.findByRole("row", { name: /student one/i });

    await user.click(within(studentRow).getByRole("button", { name: "Permanently remove" }));
    const dialog = screen.getByRole("dialog", { name: "Permanently remove Student One?" });
    const removeButton = within(dialog).getByRole("button", { name: "Permanently remove" });
    expect(removeButton).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox", { name: /type student@iimk.ac.in/i }), "student@iimk.ac.in");
    expect(removeButton).toBeEnabled();
    await user.click(removeButton);

    expect(screen.queryByRole("row", { name: /student one/i })).not.toBeInTheDocument();
  });
});
