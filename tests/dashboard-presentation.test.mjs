import assert from "node:assert/strict";
import test from "node:test";

import {
  agendaAttribution,
  moderatorActionLabels,
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
