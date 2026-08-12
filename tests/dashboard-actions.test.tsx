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
});
