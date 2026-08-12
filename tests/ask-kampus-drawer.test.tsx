import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AskKampusLauncher from "../app/AskKampusLauncher";

describe("Ask Kampus coming-soon dialog", () => {
  it("opens an unavailable notice and restores trigger focus when Escape closes it", async () => {
    const user = userEvent.setup();
    render(<AskKampusLauncher />);

    const trigger = screen.getByRole("button", { name: /ask kampus/i });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: /ask kampus is coming soon/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("traps focus in the notice and closes from its action", async () => {
    const user = userEvent.setup();
    render(<AskKampusLauncher />);
    const trigger = screen.getByRole("button", { name: /ask kampus/i });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Got it" });
    expect(close).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.click(close);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
