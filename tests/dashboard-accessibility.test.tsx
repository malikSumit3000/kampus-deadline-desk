import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Dashboard from "../app/Dashboard";

const initialData = {
  generatedAt: "2026-08-11T09:00:00.000Z",
  profile: { name: "Student One", email: "student@iimk.ac.in", role: "student" },
  agendas: [],
  progress: {},
  privateDates: {},
  reviews: [],
  proposals: [],
  gmail: { connected: false, lastSyncAt: null, error: null },
  availableCategories: [],
};

describe("dashboard keyboard behavior", () => {
  it("gives the moderator publisher its own readable form layout", async () => {
    const user = userEvent.setup();
    render(<Dashboard initialData={{ ...initialData, profile: { ...initialData.profile, role: "moderator" } }} />);
    await user.click(screen.getByRole("button", { name: /^Moderator queue/i }));

    const publisher = screen.getByRole("region", { name: "Publish a verified shared deadline" });
    expect(publisher).toHaveClass("moderator-publisher");
    expect(within(publisher).getByRole("button", { name: "Publish shared deadline" }).closest("form")).toHaveClass("moderator-publish-form");
  });

  it("keeps the date tile and title in one desktop task column", () => {
    render(<Dashboard initialData={{
      ...initialData,
      agendas: [{
        id: "agenda-1",
        title: "Marketing assignment",
        category: "Academics",
        detail: "Upload the PDF",
        source: "Course office",
        confidence: 0.95,
        deadline: "2026-08-14T12:30:00.000Z",
        displayDate: "14 Aug, 6:00 pm",
        countdown: "2d left",
        urgency: "soon",
        scope: "private",
        stages: [{ id: "private:agenda-1", name: "Personal deadline", deadline: "2026-08-14T12:30:00.000Z", displayDate: "14 Aug, 6:00 pm", status: "to-do", note: "Visible only to you." }],
      }],
    }} />);

    const summary = screen.getByRole("button", { name: /marketing assignment/i });
    const taskCell = summary.querySelector(".agenda-task-cell");
    expect(taskCell).not.toBeNull();
    expect(taskCell).toContainElement(summary.querySelector(".urgency"));
    expect(taskCell).toContainElement(summary.querySelector(".agenda-main"));
    expect(summary.children).toHaveLength(7);
    expect(summary.querySelector(".expand-mark svg")).not.toBeNull();
    expect(summary.querySelector(".expand-mark")).toHaveClass("is-open");
  });

  it("links category tabs to their panel and supports arrow-key selection", async () => {
    const user = userEvent.setup();
    render(<Dashboard initialData={initialData} />);
    const allTab = screen.getByRole("tab", { name: "All" });
    const caseCompsTab = screen.getByRole("tab", { name: "Case Comps" });

    expect(allTab).toHaveAttribute("aria-controls", "deadline-category-panel");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "deadline-category-panel");

    allTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(caseCompsTab).toHaveFocus();
    expect(caseCompsTab).toHaveAttribute("aria-selected", "true");
  });

  it("traps focus inside a dialog and restores it to the opener", async () => {
    const user = userEvent.setup();
    render(<Dashboard initialData={initialData} />);
    const opener = screen.getByRole("button", { name: /category/i });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: /add a category/i });
    const input = within(dialog).getByRole("textbox", { name: /category name/i });
    const cancel = within(dialog).getByRole("button", { name: /cancel/i });
    const submit = within(dialog).getByRole("button", { name: /add category/i });
    expect(input).toHaveFocus();

    submit.focus();
    await user.tab();
    expect(input).toHaveFocus();
    input.focus();
    await user.tab({ shift: true });
    expect(submit).toHaveFocus();

    await user.click(cancel);
    expect(opener).toHaveFocus();
  });
});
