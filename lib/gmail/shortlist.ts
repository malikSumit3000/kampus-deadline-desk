type MessageSummary = {
  subject: string;
  body: string;
  attachments: string[];
};

export type ShortlistDecision =
  | { kind: "not_shortlist" }
  | { kind: "ignore" }
  | { kind: "review" }
  | { kind: "deadline"; deadline: string };

const shortlistPattern = /\b(shortlist(?:ed)?|selection\s+list|selected\s+(?:students|candidates)|placement\s+result|roster)\b/i;
const actionPattern = /\b(confirm|respond|reply|register|submit|complete|fill|upload|accept|decline|apply)\b[^.!?]{0,160}\b(?:by|before|no later than)\s+/i;
const datePattern = /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d{2})/i;
const timePattern = /(?:\bat\s+|,\s*)(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:ist)?\b/i;

export function classifyShortlistDeadline(summary: MessageSummary): ShortlistDecision {
  const text = `${summary.subject}\n${summary.body}`;
  if (!shortlistPattern.test(text)) return { kind: "not_shortlist" };

  const action = text.match(actionPattern);
  if (!action || action.index === undefined) return { kind: "ignore" };
  const deadlineText = text.slice(action.index + action[0].length, action.index + action[0].length + 180);
  const date = deadlineText.match(datePattern);
  if (!date) return { kind: "ignore" };
  const time = deadlineText.match(timePattern);
  if (!time) return { kind: "review" };

  const parsed = new Date(`${date[1]} ${date[2]} ${date[3]} ${time[1]}:${time[2] ?? "00"} ${time[3]} GMT+0530`);
  return Number.isNaN(parsed.getTime()) ? { kind: "review" } : { kind: "deadline", deadline: parsed.toISOString() };
}
