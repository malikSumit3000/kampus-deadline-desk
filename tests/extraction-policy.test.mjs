import assert from "node:assert/strict";
import test from "node:test";

import { routeExtraction } from "../lib/extraction/policy.ts";

const base = { relevant: true, sensitive: false, scope: "shared", confidence: 0.96 };

test("routes high-confidence shared facts to moderator approval", () => {
  assert.equal(routeExtraction(base), "moderator");
});

test("never automatically shares sensitive or uncertain content", () => {
  assert.equal(routeExtraction({ ...base, sensitive: true }), "review");
  assert.equal(routeExtraction({ ...base, confidence: 0.89 }), "review");
  assert.equal(routeExtraction({ ...base, scope: "uncertain" }), "review");
});

test("keeps high-confidence personal facts private", () => {
  assert.equal(routeExtraction({ ...base, scope: "private", confidence: 0.94 }), "private");
});

test("ignores irrelevant mail", () => {
  assert.equal(routeExtraction({ ...base, relevant: false }), "ignore");
});

