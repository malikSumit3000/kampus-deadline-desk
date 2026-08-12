import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dashboard from "../app/Dashboard";

const privateAgenda = {
  id: "private-1",
  title: "Existing task",
  category: "Academics",
  scope: "private" as const,
  urgency: "soon" as const,
  countdown: "2d",
  deadline: "2026-08-13T10:00:00.000Z",
  displayDate: "13 Aug · 3:30 PM",
  detail: "Existing detail",
  source: "Added by you",
  confidence: 1,
  stages: [{
    id: "private-stage-1",
    name: "Personal deadline",
    deadline: "2026-08-13T10:00:00.000Z",
    displayDate: "13 Aug · 3:30 PM",
    status: "to-do" as const,
    note: "Visible only to you.",
  }],
};

function data(agendas = [privateAgenda]) {
  return {
    generatedAt: "2026-08-11T09:00:00.000Z",
    profile: { name: "Student One", email: "student@iimk.ac.in", role: "student" },
    agendas,
    progress: {},
    privateDates: {},
    reviews: [],
    proposals: [],
    gmail: { connected: false, lastSyncAt: null, error: null },
    availableCategories: ["Academics"],
  };
}

function connectedData(agendas = [privateAgenda]) {
  return { ...data(agendas), gmail: { connected: true, lastSyncAt: new Date().toISOString(), error: null } };
}

const review = {
  id: "review-1",
  kind: "Needs review · 91%",
  title: "Marketing submission",
  received: "12 Aug, 3:30 PM",
  reason: "Deadline wording needs confirmation.",
  proposedDate: "20 Aug, 6:00 PM",
  source: "Open in Gmail",
  canAddToDashboard: true,
};

describe("dashboard local actions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("adds a private deadline directly to the current dashboard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      agenda: {
        id: "private-2",
        title: "New task",
        category: "Academics",
        detail: "New detail",
        deadline: "2026-08-14T10:00:00.000Z",
      },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const user = userEvent.setup();
    render(<Dashboard initialData={data([])} />);

    await user.click(screen.getByRole("button", { name: /add a private deadline/i }));
    const form = screen.getByRole("button", { name: "Add private deadline" }).closest("form")!;
    await user.type(within(form).getByRole("textbox", { name: "Title" }), "New task");
    await user.type(within(form).getByRole("textbox", { name: "Note" }), "New detail");
    fireEvent.change(within(form).getByLabelText("Deadline"), { target: { value: "2026-08-14T15:30" } });
    await user.click(within(form).getByRole("button", { name: "Add private deadline" }));

    expect((await screen.findAllByText("New task")).length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("Private deadline added");
  });

  it("deletes a private task in place after the accessible confirmation dialog", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    const user = userEvent.setup();
    render(<Dashboard initialData={data()} />);

    await user.click(screen.getByText("Manage task"));
    await user.click(screen.getByRole("button", { name: "Delete task" }));
    const dialog = screen.getByRole("dialog", { name: /delete “existing task”/i });
    await user.click(within(dialog).getByRole("button", { name: "Delete task" }));

    expect(screen.queryByText("Existing task")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Task deleted");
  });

  it("adds an approved review to the dashboard without a reload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      status: "approved",
      agenda: {
        id: "private-3",
        title: "Marketing submission",
        category: "Academics",
        detail: "Upload the PDF",
        source: "Gmail review",
        confidence: 0.91,
        deadline: "2026-08-20T12:30:00.000Z",
        status: "to-do",
      },
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const user = userEvent.setup();
    render(<Dashboard initialData={{ ...data([]), reviews: [review] }} />);

    await user.click(screen.getByRole("button", { name: /^Review inbox/i }));
    await user.click(screen.getByRole("button", { name: "Mark reviewed" }));
    expect(screen.queryByText("Marketing submission")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("added to your dashboard");

    await user.click(screen.getByRole("button", { name: /^Deadline runway/i }));
    expect((await screen.findAllByText("Marketing submission")).length).toBeGreaterThan(0);
  });

  it("does not offer dashboard approval when a review has no extracted deadline", async () => {
    const user = userEvent.setup();
    render(<Dashboard initialData={{ ...data([]), reviews: [{ ...review, canAddToDashboard: false, proposedDate: "No deadline extracted" }] }} />);
    await user.click(screen.getByRole("button", { name: /^Review inbox/i }));
    expect(screen.getByRole("button", { name: "Mark reviewed" })).toBeDisabled();
  });

  it("continues Gmail batches until Claude has inspected the full window", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        scanned: 10, candidates: 1, failed: 0, hasMore: true,
        lastSyncAt: "2026-08-13T00:00:00.000Z", privateAgendas: [], reviews: [],
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        scanned: 4, candidates: 0, failed: 0, hasMore: false,
        lastSyncAt: "2026-08-13T00:01:00.000Z", privateAgendas: [], reviews: [],
      }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<Dashboard initialData={connectedData([])} />);

    await user.click(screen.getByRole("button", { name: "Refresh inbox" }));

    expect(await screen.findByRole("status")).toHaveTextContent("14 messages scanned");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
