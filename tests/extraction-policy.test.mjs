import assert from "node:assert/strict";
import test from "node:test";

import { routeExtraction } from "../lib/extraction/policy.ts";

const base = { relevant: true, sensitive: false, scope: "shared", confidence: 0.96, deadline: "2026-08-20T12:30:00.000Z" };

test("keeps high-confidence shared discoveries private to the connected student", () => {
  assert.equal(routeExtraction(base), "private");
});

test("adds a valid Claude deadline directly even when confidence is lower", () => {
  assert.equal(routeExtraction({ ...base, confidence: 0.72 }), "private");
});

test("withholds sensitive content but trusts Claude on scope wording", () => {
  assert.equal(routeExtraction({ ...base, sensitive: true }), "review");
  assert.equal(routeExtraction({ ...base, scope: "uncertain" }), "private");
});

test("keeps high-confidence personal facts private", () => {
  assert.equal(routeExtraction({ ...base, scope: "private", confidence: 0.94 }), "private");
});

test("ignores irrelevant mail", () => {
  assert.equal(routeExtraction({ ...base, relevant: false }), "ignore");
});

test("does not create a task when Claude found no exact deadline", () => {
  assert.equal(routeExtraction({ ...base, deadline: null }), "ignore");
});
