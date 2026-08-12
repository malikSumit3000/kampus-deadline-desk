import assert from "node:assert/strict";
import test from "node:test";

import {
  agendaAttribution,
  actionContextPreview,
  moderatorActionLabels,
  deadlineCountdownLabel,
  selectUpNext,
  stageProgress,
  reviewActionLabels,
} from "../lib/dashboard/presentation.ts";
import { makeManualAgenda } from "../lib/dashboard/optimistic.ts";

test("manual deadlines are attributed to the user rather than extraction confidence", () => {
  assert.equal(agendaAttribution({ source: "Added by you", confidence: 1 }), "Added by you");
});

test("extracted deadlines retain their confidence attribution", () => {
  assert.equal(agendaAttribution({ source: "Course Office", confidence: 0.92 }), "92% extraction confidence");
});

test("task rows show a concise action preview without losing the stored detail", () => {
  const detail = "Marketing Management group assignment must be submitted by Friday. One PDF per group should be uploaded on the course portal with section and group number included.";
  const preview = actionContextPreview(detail);
  assert.ok(preview.length <= 80);
  assert.match(preview, /One PDF/);
  assert.ok(preview.endsWith("…"));
  assert.equal(actionContextPreview("Upload the PDF"), "Upload the PDF");
});

test("review and moderator labels describe the existing decisions", () => {
  assert.deepEqual(reviewActionLabels, ["Mark reviewed", "Mark correction noted", "Dismiss"]);
  assert.deepEqual(moderatorActionLabels, ["Approve proposal", "Mark private", "Reject"]);
});

test("stage progress uses the saved task status rather than an invented percentage", () => {
  assert.deepEqual(stageProgress("to-do"), { percent: 0, label: "To do", tone: "not-started" });
  assert.deepEqual(stageProgress("in progress"), { percent: 50, label: "In progress", tone: "active" });
  assert.deepEqual(stageProgress("submitted"), { percent: 100, label: "Submitted", tone: "complete" });
});

test("a newly saved manual deadline can be shown locally without a dashboard reload", () => {
  const agenda = makeManualAgenda({
    id: "private-1",
    title: "Submit case deck",
    category: "Academics",
    deadline: "2026-08-20T18:00:00+05:30",
    detail: "Final version",
    scope: "private",
  });

  assert.equal(agenda.id, "private-1");
  assert.equal(agenda.source, "Added by you");
  assert.equal(agenda.stages[0].id, "private:private-1");
  assert.equal(agenda.deadline, "2026-08-20T18:00:00+05:30");
});

test("expired deadlines are labelled overdue rather than zero hours left", () => {
  const now = Date.parse("2026-08-13T10:00:00.000Z");
  assert.equal(deadlineCountdownLabel({ deadline: "2026-08-13T09:59:59.000Z", countdown: "0h" }, now), "Overdue");
  assert.equal(deadlineCountdownLabel({ deadline: "2026-08-14T10:00:00.000Z", countdown: "1d" }, now), "1d left");
  assert.equal(deadlineCountdownLabel({ deadline: "2026-08-14T10:00:00.000Z", countdown: "1d left" }, now), "1d left");
});

test("up next selects the closest future incomplete deadline", () => {
  const now = Date.parse("2026-08-13T10:00:00.000Z");
  const agendas = [
    { id: "expired", deadline: "2026-08-12T10:00:00.000Z", stages: [{ id: "expired-stage", status: "to-do" }] },
    { id: "future-complete", deadline: "2026-08-14T10:00:00.000Z", stages: [{ id: "complete-stage", status: "submitted" }] },
    { id: "later", deadline: "2026-08-16T10:00:00.000Z", stages: [{ id: "later-stage", status: "to-do" }] },
    { id: "next", deadline: "2026-08-15T10:00:00.000Z", stages: [{ id: "next-stage", status: "to-do" }] },
  ];

  assert.equal(selectUpNext(agendas, { "later-stage": "in progress" }, now)?.id, "next");
  assert.equal(selectUpNext(agendas.slice(0, 2), {}, now), null);
});
