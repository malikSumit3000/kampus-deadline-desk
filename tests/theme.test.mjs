import assert from "node:assert/strict";
import test from "node:test";
import { resolveTheme } from "../lib/theme.ts";

test("saved theme takes priority over device preference", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("first visit follows the device preference", () => {
  assert.equal(resolveTheme(null, true), "dark");
  assert.equal(resolveTheme(undefined, false), "light");
});

test("invalid stored values fall back safely", () => {
  assert.equal(resolveTheme("sepia", true), "dark");
});
