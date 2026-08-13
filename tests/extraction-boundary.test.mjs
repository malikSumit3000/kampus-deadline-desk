import assert from "node:assert/strict";
import test from "node:test";

import { buildDeadlineExtractionPrompt, planExtractionMutation, validateExtractionTargets } from "../lib/extraction/context.ts";
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
  agendaId: null,
  isNewStage: false,
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

test("shows Claude the current deadline state and the explicit processing date", () => {
  const prompt = buildDeadlineExtractionPrompt({
    messages: [{
      subject: "Task 2 deadline extended",
      sender: "calicutmarathon@iimk.ac.in",
      receivedAt: "2026-08-13T08:00:00.000Z",
      body: "The deadline is extended until 11:59 PM today.",
    }],
    currentState: [{
      id: "8d8eb1f2-8ae8-4e16-9694-25fffc1714f5",
      title: "Calicut Marathon Task 2",
      category: "Case Comps",
      deadline: "2026-08-13T12:00:00.000Z",
      source: "calicutmarathon@iimk.ac.in",
    }],
    today: "2026-08-13",
  });

  assert.match(prompt, /TODAY IN ASIA\/KOLKATA: 2026-08-13/);
  assert.match(prompt, /8d8eb1f2-8ae8-4e16-9694-25fffc1714f5/);
  assert.match(prompt, /Calicut Marathon Task 2/);
  assert.match(prompt, /extended until 11:59 PM today/);
});

test("rejects updates that do not reuse an id from the supplied current state", () => {
  const currentState = [{
    id: "8d8eb1f2-8ae8-4e16-9694-25fffc1714f5",
    title: "BNY case submission",
    category: "Case Comps",
    deadline: "2026-08-13T09:00:00.000Z",
    source: "bny@example.com",
  }];
  const update = {
    ...valid,
    action: "correction",
    agendaId: currentState[0].id,
  };

  assert.deepEqual(validateExtractionTargets([update], currentState), [update]);
  assert.throws(
    () => validateExtractionTargets([{ ...update, agendaId: "00000000-0000-0000-0000-000000000000" }], currentState),
    /model_update_target_invalid/,
  );
});

test("rejects duplicate updates to the same current task in one model result", () => {
  const currentState = [{
    id: "8d8eb1f2-8ae8-4e16-9694-25fffc1714f5",
    title: "BNY case submission",
    category: "Case Comps",
    deadline: "2026-08-13T09:00:00.000Z",
    source: "bny@example.com",
  }];
  const update = { ...valid, action: "extension", agendaId: currentState[0].id };

  assert.throws(
    () => validateExtractionTargets([update, { ...update, deadline: "2026-08-13T18:00:00+05:30" }], currentState),
    /model_update_target_duplicate/,
  );
});

test("plans extensions and corrections as updates instead of duplicate inserts", () => {
  const agendaId = "8d8eb1f2-8ae8-4e16-9694-25fffc1714f5";
  assert.deepEqual(
    planExtractionMutation({ ...valid, action: "extension", agendaId }),
    { kind: "update", agendaId },
  );
  assert.deepEqual(
    planExtractionMutation({ ...valid, action: "new", agendaId: null }),
    { kind: "create" },
  );
  assert.deepEqual(
    planExtractionMutation({ ...valid, action: "new", agendaId, isNewStage: true }),
    { kind: "create", parentAgendaId: agendaId },
  );
});
