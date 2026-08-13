import test from "node:test";
import assert from "node:assert/strict";
import { initialGmailScanAfter, shouldCompleteBackfill } from "../lib/gmail/backfill.ts";
import { classifyShortlistDeadline } from "../lib/gmail/shortlist.ts";
import { gmailWindowQuery, isSensitiveMessage, limitSyncCandidates, selectSyncCandidates, summariseMessage } from "../lib/gmail/client.ts";
import { processMessagesIndependently } from "../lib/gmail/process-batch.ts";
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

test("lists every message after the scan boundary without keyword filtering", () => {
  assert.equal(
    gmailWindowQuery("2026-08-11T00:00:00.000Z"),
    "after:1786406400",
  );
});

test("passes the full plaintext Gmail body with line breaks instead of a snippet", () => {
  const fullBody = "Applications are open.\n\nDeadline: 13 August 2026 at 17:59 IST.\nSubmit through the portal.";
  const encoded = Buffer.from(fullBody).toString("base64url");
  const result = summariseMessage({
    id: "message-1",
    internalDate: String(Date.parse("2026-08-13T08:00:00.000Z")),
    payload: {
      mimeType: "multipart/alternative",
      headers: [
        { name: "Subject", value: "O3 Capital | Applications | SIP 2026" },
        { name: "From", value: "placements@iimk.ac.in" },
      ],
      parts: [
        { mimeType: "text/plain", body: { data: encoded } },
        { mimeType: "text/html", body: { data: Buffer.from(`<p>${fullBody}</p>`).toString("base64url") } },
      ],
    },
  });

  assert.equal(result.body, fullBody);
  assert.match(result.body, /Deadline: 13 August 2026 at 17:59 IST/);
  assert.equal(result.body.includes(fullBody + fullBody), false);
});

test("one failed message does not prevent Claude processing later messages", async () => {
  const visited = [];
  const failures = await processMessagesIndependently(["one", "two", "three"], async (id) => {
    visited.push(id);
    if (id === "two") throw new Error("model_output_invalid");
  });

  assert.deepEqual(visited, ["one", "two", "three"]);
  assert.deepEqual(failures, [{ item: "two", error: "model_output_invalid" }]);
});

test("processes Gmail messages with at most two Claude calls at once", async () => {
  let active = 0;
  let maximumActive = 0;
  await processMessagesIndependently(["one", "two", "three", "four"], async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
  }, 2);

  assert.equal(maximumActive, 2);
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
    { message_id: "m-12", processing_status: "failed", attempt_count: 5, updated_at: "2026-08-11T09:00:00.000Z" },
    { message_id: "m-13", processing_status: "processing", attempt_count: 1, updated_at: "2026-08-11T08:55:00.000Z" },
  ];

  assert.deepEqual(
    selectSyncCandidates(ids, receipts, new Date("2026-08-11T09:00:00.000Z")),
    ["m-10", "m-11", "m-14", "m-15", "m-16", "m-17", "m-18"],
  );
});

test("starts a Gmail connection seven days before the connection time", () => {
  assert.equal(
    initialGmailScanAfter("2026-08-12T10:30:00.000Z"),
    "2026-08-05T10:30:00.000Z",
  );
});

test("completes backfill only when no eligible candidate remains after this batch", () => {
  const tenIds = Array.from({ length: 10 }, (_, index) => `m-${index}`);
  const elevenIds = [...tenIds, "m-10"];
  assert.equal(shouldCompleteBackfill(tenIds, [], tenIds), true);
  assert.equal(shouldCompleteBackfill(elevenIds, [], tenIds), false);
  assert.equal(shouldCompleteBackfill(elevenIds, [{
    message_id: "m-10",
    processing_status: "succeeded",
    attempt_count: 1,
    updated_at: "2026-08-12T10:00:00.000Z",
  }], tenIds), true);
});

test("retries a failed Claude message up to five attempts", () => {
  const ids = ["failed-four-times", "failed-five-times"];
  assert.deepEqual(selectSyncCandidates(ids, [
    { message_id: ids[0], processing_status: "failed", attempt_count: 4, updated_at: "2026-08-12T10:00:00.000Z" },
    { message_id: ids[1], processing_status: "failed", attempt_count: 5, updated_at: "2026-08-12T10:00:00.000Z" },
  ]), [ids[0]]);
});

test("only treats a failed message as resolved after five attempts", () => {
  const id = "message-1";
  const receipt = (attempt_count) => ({ message_id: id, processing_status: "failed", attempt_count, updated_at: "2026-08-12T10:00:00.000Z" });
  assert.equal(shouldCompleteBackfill([id], [receipt(4)], []), false);
  assert.equal(shouldCompleteBackfill([id], [receipt(5)], []), true);
});

test("extracts an explicit shortlist action date locally without retaining sensitive text", () => {
  assert.deepEqual(classifyShortlistDeadline(summary({
    subject: "Company shortlist announcement",
    body: "Selected students must confirm participation by 14 August 2026 at 6:00 PM IST. Candidate names follow.",
  })), {
    kind: "deadline",
    deadline: "2026-08-14T12:30:00.000Z",
  });
});

test("routes a date-only shortlist action to metadata-only review", () => {
  assert.deepEqual(classifyShortlistDeadline(summary({
    subject: "Placement selection list",
    body: "Selected students must confirm participation by 14 August 2026. Candidate names follow.",
  })), { kind: "review" });
});

test("ignores shortlist messages without an explicit action deadline", () => {
  assert.deepEqual(classifyShortlistDeadline(summary({
    subject: "Placement shortlist",
    body: "Interviews will be held on 14 August 2026 at 6:00 PM IST.",
  })), { kind: "ignore" });
  assert.deepEqual(classifyShortlistDeadline(summary()), { kind: "not_shortlist" });
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

test("does not bypass Claude for ordinary placement applications that mention CVs or shortlists", () => {
  assert.equal(isSensitiveMessage(summary({
    subject: "O3 Capital | Applications | SIP 2026",
    body: "Submit your application and CV before the deadline. Shortlisted candidates will be contacted later.",
  })), false);
});

test("still withholds clearly individualized sensitive messages", () => {
  assert.equal(isSensitiveMessage(summary({ subject: "Your CGPA transcript" })), true);
  assert.equal(isSensitiveMessage(summary({ subject: "Medical diagnosis and prescription" })), true);
  assert.equal(isSensitiveMessage(summary({ subject: "Bank of America shortlist results", attachments: ["selected-students.xlsx"] })), true);
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
