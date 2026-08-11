import { isSensitiveMessage } from "../gmail/client.ts";

export type AskTurn = { role: "user" | "assistant"; content: string };

export function askAccessDecision(input: { authenticated: boolean; gmailConnected: boolean; usedToday: number; dailyLimit: number }) {
  if (!input.authenticated) return { code: "unauthorized", status: 401 } as const;
  if (!input.gmailConnected) return { code: "gmail_not_connected", status: 409 } as const;
  if (input.usedToday >= input.dailyLimit) return { code: "daily_limit", status: 429 } as const;
  return null;
}

export type AskSource = {
  id: string;
  label: string;
  subject: string;
  sender: string;
  receivedAt: string;
  url: string;
  body: string;
  sensitive: boolean;
};

type EmailSummary = {
  id: string;
  threadId?: string;
  subject: string;
  sender: string;
  receivedAt: string;
  body: string;
  attachments: string[];
};

export function parseAskRequest(input: unknown): { question: string; history: AskTurn[] } | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  const question = typeof value.question === "string" ? value.question.trim() : "";
  if (!question || question.length > 1_000) return null;
  if (value.history !== undefined && !Array.isArray(value.history)) return null;
  const history = (value.history ?? []) as unknown[];
  const parsed: AskTurn[] = [];
  for (const turn of history) {
    if (!turn || typeof turn !== "object") return null;
    const candidate = turn as Record<string, unknown>;
    if ((candidate.role !== "user" && candidate.role !== "assistant") || typeof candidate.content !== "string") return null;
    const content = candidate.content.trim();
    if (!content || content.length > 4_000) return null;
    parsed.push({ role: candidate.role, content });
  }
  return { question, history: parsed.slice(-6) };
}

export function buildBoundedQueries(plannedQueries: string[], scanAfter: string) {
  const after = Math.floor(new Date(scanAfter).getTime() / 1000);
  if (!Number.isFinite(after)) throw new Error("invalid_scan_boundary");
  const dateOperator = /\b(?:after|before|older|newer|older_than|newer_than):\S+/gi;
  const cleaned = plannedQueries
    .slice(0, 2)
    .map((query) => query.replace(dateOperator, " ").replace(/\s+/g, " ").trim().slice(0, 200))
    .filter(Boolean)
    .map((query) => `after:${after} ${query}`);
  return [...new Set(cleaned.length ? cleaned : [`after:${after}`])];
}

export function parsePlannerQueries(text: string) {
  try {
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")) as { queries?: unknown };
    if (!Array.isArray(parsed.queries)) return null;
    const queries = parsed.queries.filter((query): query is string => typeof query === "string" && Boolean(query.trim())).slice(0, 2);
    return queries.length ? queries : null;
  } catch {
    return null;
  }
}

export function gmailMessageLink(account: string, threadId: string) {
  return `https://mail.google.com/mail/u/${encodeURIComponent(account)}/#all/${encodeURIComponent(threadId)}`;
}

export function prepareEmailSources(messages: EmailSummary[], account: string): AskSource[] {
  let remaining = 30_000;
  return messages.slice(0, 10).map((message, index) => {
    const sensitive = isSensitiveMessage(message);
    const body = sensitive ? "" : message.body.slice(0, Math.min(4_000, remaining));
    remaining -= body.length;
    return {
      id: message.id,
      label: `S${index + 1}`,
      subject: message.subject,
      sender: message.sender,
      receivedAt: message.receivedAt,
      url: gmailMessageLink(account, message.threadId ?? message.id),
      body,
      sensitive,
    };
  });
}

export function buildEvidenceContext(sources: AskSource[]) {
  return sources.map((source) => [
    `[${source.label}]`,
    `From: ${source.sender}`,
    `Subject: ${source.subject}`,
    `Received: ${source.receivedAt}`,
    source.sensitive ? "Body: [BODY WITHHELD — sensitive content]" : `Body: ${source.body || "[No readable message text]"}`,
  ].join("\n")).join("\n\n");
}

export function istDayBounds(now = new Date()) {
  const offsetMs = 5.5 * 60 * 60 * 1_000;
  const ist = new Date(now.getTime() + offsetMs);
  const startMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - offsetMs;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + 24 * 60 * 60 * 1_000).toISOString(),
  };
}

export function sseEvent(event: string, payload: unknown) {
  if (!/^[a-z-]+$/.test(event)) throw new Error("invalid_sse_event");
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, task: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker));
  return results;
}
