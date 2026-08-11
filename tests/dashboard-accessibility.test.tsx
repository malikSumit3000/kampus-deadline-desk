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
