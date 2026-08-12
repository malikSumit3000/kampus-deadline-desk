import assert from "node:assert/strict";
import test from "node:test";

import { routeExtraction } from "../lib/extraction/policy.ts";

const base = { relevant: true, sensitive: false, scope: "shared", confidence: 0.96 };

test("keeps high-confidence shared discoveries private to the connected student", () => {
  assert.equal(routeExtraction(base), "private");
});

test("keeps lower-confidence shared discoveries in review", () => {
  assert.equal(routeExtraction({ ...base, confidence: 0.94 }), "review");
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
