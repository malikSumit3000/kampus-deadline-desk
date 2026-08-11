import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationalEvent } from "../lib/observability/events.ts";

test("operational events whitelist metrics and drop content fields", () => {
  const event = buildOperationalEvent({
    operation: "ask_kampus",
    status: "succeeded",
    durationMs: 420,
    sourceCount: 3,
    inputTokens: 120,
    outputTokens: 44,
    question: "private question",
    answer: "private answer",
    body: "email body",
  });

  assert.deepEqual(event, {
    operation: "ask_kampus",
    status: "succeeded",
    duration_ms: 420,
    source_count: 3,
    input_tokens: 120,
    output_tokens: 44,
  });
});
