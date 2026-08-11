import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AskKampusLauncher from "../app/AskKampusLauncher";

describe("Ask Kampus drawer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("cancels a streaming request when Escape closes the drawer and restores trigger focus", async () => {
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    }));
    const user = userEvent.setup();
    render(<AskKampusLauncher gmailConnected />);

    const trigger = screen.getByRole("button", { name: /ask kampus/i });
    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.type(screen.getByRole("textbox", { name: /ask a question/i }), "What is due?");
    await user.click(screen.getByRole("button", { name: /send question/i }));
    await waitFor(() => expect(requestSignal).toBeDefined());

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(requestSignal?.aborted).toBe(true);
    expect(trigger).toHaveFocus();
  });

  it("keeps the token-by-token message stream out of the live region", async () => {
    const user = userEvent.setup();
    render(<AskKampusLauncher gmailConnected />);
    await user.click(screen.getByRole("button", { name: /ask kampus/i }));

    expect((await screen.findByRole("dialog")).querySelector(".ask-messages")).not.toHaveAttribute("aria-live");
  });

  it("renders streamed evidence and preserves the tab-session conversation after closing", async () => {
    const source = {
      label: "S1",
      subject: "Submission deadline",
      sender: "office@iimk.ac.in",
      receivedAt: "2026-08-11T09:00:00.000Z",
      url: "https://mail.google.com/mail/u/0/#all/thread-1",
      sensitive: false,
    };
    const body = [
      `event: sources\ndata: ${JSON.stringify({ items: [source] })}\n\n`,
      `event: delta\ndata: ${JSON.stringify({ text: "The deadline is Friday [S1]." })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ remaining: 9 })}\n\n`,
    ].join("");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, {
      headers: { "content-type": "text/event-stream" },
    })));
    const user = userEvent.setup();
    render(<AskKampusLauncher gmailConnected />);

    const trigger = screen.getByRole("button", { name: /ask kampus/i });
    await user.click(trigger);
    await user.type(await screen.findByRole("textbox", { name: /ask a question/i }), "When is it due?");
    await user.click(screen.getByRole("button", { name: /send question/i }));
    expect(await screen.findByText(/deadline is friday/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /submission deadline/i })).toHaveAttribute("href", source.url);

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close Ask Kampus" }));
    await user.click(trigger);
    expect(await screen.findByText(/deadline is friday/i)).toBeInTheDocument();
  });
});
