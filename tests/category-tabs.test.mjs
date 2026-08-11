import assert from "node:assert/strict";
import test from "node:test";

import { categoryTabs } from "../app/dashboard-data.ts";

test("adds a personal category to the dashboard tabs after standard categories", () => {
  assert.deepEqual(categoryTabs(["All", "Case Comps", "Committees", "Placements", "Academics", "Internship applications"]), [
    "All", "Case Comps", "Committees", "Placements", "Academics", "Internship applications",
  ]);
});

test("does not repeat a saved personal category in the tab list", () => {
  assert.deepEqual(categoryTabs(["All", "Case Comps", "Committees", "Placements", "Academics", "Internships", "Internships"]), [
    "All", "Case Comps", "Committees", "Placements", "Academics", "Internships",
  ]);
});
