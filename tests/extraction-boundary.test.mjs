import assert from "node:assert/strict";
import test from "node:test";

import { normaliseDeadlineExtraction, normaliseDeadlineExtractions } from "../lib/extraction/normalise.ts";
import { classifySyncFailure } from "../lib/extraction/errors.ts";
import { readExtractionToolInput } from "../lib/extraction/tool-contract.ts";

const valid = {
  relevant: true,
  sensitive: false,
  scope: "shared",
  confidence: 0.96,
  action: "new",
  title: "Marketing assignment",
  category: "Academics",
  deadline: "2026-08-14T18:00:00+05:30",
  detail: "Submit one PDF per group.",
  evidence: "Due Friday at 6 PM IST.",
};

test("normalises harmless Claude formatting differences before validation", () => {
  assert.deepEqual(normaliseDeadlineExtraction({
    ...valid,
    confidence: "96%",
    action: "new deadline",
    category: "academics",
  }), valid);
});

test("does not invent an action when Claude returns an unknown decision", () => {
  assert.throws(
    () => normaliseDeadlineExtraction({ ...valid, action: "delete" }),
    /model_output_invalid/,
  );
});

test("keeps every distinct deadline Claude extracts from one email", () => {
  const first = { ...valid, title: "Register for the case competition", deadline: "2026-08-20T12:30:00+05:30" };
  const second = { ...valid, title: "Submit the case deck", deadline: "2026-08-24T18:00:00+05:30" };
  assert.deepEqual(
    normaliseDeadlineExtractions({ tasks: [first, second] }).map(({ title }) => title),
    ["Register for the case competition", "Submit the case deck"],
  );
});

test("accepts an empty Claude task list for email without deadlines", () => {
  assert.deepEqual(normaliseDeadlineExtractions({ tasks: [] }), []);
});

test("distinguishes AI validation failures from Gmail connection failures", () => {
  assert.deepEqual(classifySyncFailure(new Error("model_output_invalid")), {
    code: "model_output_invalid",
    message: "AI read the email but returned an unusable result. Please retry inbox refresh.",
    status: 502,
  });
  assert.deepEqual(classifySyncFailure(new Error("gmail_token_refresh_failed")), {
    code: "gmail_token_refresh_failed",
    message: "Gmail authorization has expired. Please reconnect Gmail.",
    status: 401,
  });
});

test("reads only the forced deadline extraction tool result", () => {
  const toolInput = { tasks: [valid] };
  assert.deepEqual(readExtractionToolInput([
    { type: "text", text: "I found a deadline." },
    { type: "tool_use", name: "record_deadline_extraction", input: toolInput },
  ]), toolInput);
  assert.throws(
    () => readExtractionToolInput([{ type: "text", text: JSON.stringify(valid) }]),
    /model_output_missing/,
  );
});
