import test from "node:test";
import assert from "node:assert/strict";
import { isSensitiveMessage, limitSyncCandidates, selectSyncCandidates } from "../lib/gmail/client.ts";
import { mergeSyncResult } from "../lib/dashboard/sync.ts";
import { makeManualAgenda } from "../lib/dashboard/optimistic.ts";

function summary(overrides = {}) {
  return {
    subject: "Campus update",
    sender: "office@iimk.ac.in",
    receivedAt: "2026-08-11T00:00:00.000Z",
    body: "General announcement",
    attachments: [],
    ...overrides,
  };
}

test("limits an extraction sync to ten unique candidate messages", () => {
  const ids = ["one", "two", ...Array.from({ length: 12 }, (_, index) => `m-${index}`), "one"];
  assert.deepEqual(limitSyncCandidates(ids), ids.slice(0, 10));
});

test("selects ten unprocessed or retryable messages instead of ten recent receipts", () => {
  const ids = Array.from({ length: 19 }, (_, index) => `m-${index}`);
  const receipts = [
    ...ids.slice(0, 10).map((messageId) => ({
      message_id: messageId,
      processing_status: "succeeded",
      attempt_count: 1,
      updated_at: "2026-08-11T09:00:00.000Z",
    })),
    { message_id: "m-10", processing_status: "processing", attempt_count: 1, updated_at: "2026-08-11T08:40:00.000Z" },
    { message_id: "m-11", processing_status: "failed", attempt_count: 1, updated_at: "2026-08-11T09:00:00.000Z" },
    { message_id: "m-12", processing_status: "failed", attempt_count: 2, updated_at: "2026-08-11T09:00:00.000Z" },
    { message_id: "m-13", processing_status: "processing", attempt_count: 1, updated_at: "2026-08-11T08:55:00.000Z" },
  ];

  assert.deepEqual(
    selectSyncCandidates(ids, receipts, new Date("2026-08-11T09:00:00.000Z")),
    ["m-10", "m-11", "m-14", "m-15", "m-16", "m-17", "m-18"],
  );
});

test("withholds expanded academic, compensation, offer, and medical variants", () => {
  for (const text of [
    "CGPA transcript attached",
    "Your CTC and compensation details",
    "Confidential offer letter",
    "Diagnosis and prescription",
    "Individual rank list",
  ]) {
    assert.equal(isSensitiveMessage(summary({ body: text })), true, text);
  }
});

test("fails closed for personal-document attachment names", () => {
  assert.equal(isSensitiveMessage(summary({ attachments: ["student-transcript.pdf"] })), true);
  assert.equal(isSensitiveMessage(summary({ attachments: ["offer_details.docx"] })), true);
});

test("merges Gmail sync deltas without duplicating dashboard records", () => {
  const existingAgenda = { id: "agenda-1", deadline: "2026-08-12T00:00:00.000Z" };
  const newAgenda = { id: "agenda-2", deadline: "2026-08-11T00:00:00.000Z" };
  const existingReview = { id: "review-1" };
  const newReview = { id: "review-2" };
  const result = mergeSyncResult(
    { agendas: [existingAgenda], reviews: [existingReview] },
    {
      privateAgendas: [existingAgenda, newAgenda],
      reviews: [existingReview, newReview],
      lastSyncAt: "2026-08-11T01:00:00.000Z",
    },
  );

  assert.deepEqual(result.agendas.map((agenda) => agenda.id), ["agenda-2", "agenda-1"]);
  assert.deepEqual(result.reviews.map((review) => review.id), ["review-2", "review-1"]);
  assert.equal(result.lastSyncAt, "2026-08-11T01:00:00.000Z");
});

test("formats a Gmail-extracted private agenda with its real attribution", () => {
  const agenda = makeManualAgenda({
    id: "private-1",
    title: "Placement form",
    category: "Placements",
    deadline: "2026-08-12T10:00:00.000Z",
    detail: "Complete the form",
    scope: "private",
    source: "Placement Office",
    confidence: 0.96,
    status: "in progress",
  });

  assert.equal(agenda.source, "Placement Office");
  assert.equal(agenda.confidence, 0.96);
  assert.equal(agenda.stages[0].status, "in progress");
});
