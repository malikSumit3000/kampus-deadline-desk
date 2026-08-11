import assert from "node:assert/strict";
import test from "node:test";

import { parseAgendaScope, parseManualDeadline, parsePersonalCategory } from "../lib/manual-deadlines.ts";

test("normalizes a valid manual deadline to India Standard Time", () => {
  assert.deepEqual(parseManualDeadline({
    title: "Submit resume",
    category: "Placements",
    deadline: "2026-08-20T18:00",
    detail: "Upload the final PDF",
  }), {
    title: "Submit resume",
    category: "Placements",
    deadline: "2026-08-20T18:00:00+05:30",
    detail: "Upload the final PDF",
  });
});

test("rejects invalid manual deadline payloads", () => {
  assert.equal(parseManualDeadline({
    title: "",
    category: "Placements",
    deadline: "2026-08-20T18:00",
  }), null);
  assert.equal(parseManualDeadline({
    title: "Apply",
    category: "Other",
    deadline: "2026-08-20T18:00",
  }), null);
  assert.equal(parseManualDeadline({
    title: "Apply",
    category: "Placements",
    deadline: "20 August",
  }), null);
});

test("normalizes a private custom category", () => {
  assert.equal(parsePersonalCategory("  Internship applications  "), "Internship applications");
  assert.equal(parsePersonalCategory(""), null);
  assert.equal(parsePersonalCategory("x".repeat(61)), null);
});

test("accepts only the two supported deletion scopes", () => {
  assert.equal(parseAgendaScope("private"), "private");
  assert.equal(parseAgendaScope("shared"), "shared");
  assert.equal(parseAgendaScope("all"), null);
});
