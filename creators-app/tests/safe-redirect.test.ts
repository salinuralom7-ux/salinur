import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../src/lib/safe-redirect.ts";

test("after login, only redirect within this site", () => {
  assert.equal(safeNextPath("/join"), "/join");
  assert.equal(safeNextPath("/c/asha.eats?x=1"), "/c/asha.eats?x=1");
  assert.equal(safeNextPath(null), "/");
  assert.equal(safeNextPath("https://evil.example"), "/");
  assert.equal(safeNextPath("//evil.example"), "/");
  assert.equal(safeNextPath("/\\evil.example"), "/");
  assert.equal(safeNextPath("javascript:alert(1)", "/home"), "/home");
});
