import { test } from "node:test";
import assert from "node:assert/strict";
import { CITIES, getCity } from "../src/config/cities.ts";

test("every city has a unique, URL-safe slug", () => {
  const slugs = CITIES.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("covers all three tiers and every state/UT", () => {
  for (const tier of [1, 2, 3]) assert.ok(CITIES.some((c) => c.tier === tier));
  assert.equal(new Set(CITIES.map((c) => c.state)).size, 36);
});

test("landing-page cities exist (their slugs are live URLs)", () => {
  for (const s of ["guwahati", "mumbai", "delhi", "bengaluru", "kolkata", "pune", "hyderabad", "chennai", "jaipur", "ahmedabad", "lucknow", "shillong"]) {
    assert.ok(getCity(s), s);
  }
});

test("same-name towns get distinct slugs", () => {
  assert.equal(getCity("bilaspur")?.state, "Chhattisgarh");
  assert.equal(getCity("bilaspur-himachal-pradesh")?.state, "Himachal Pradesh");
  assert.equal(getCity("udaipur")?.state, "Rajasthan");
  assert.equal(getCity("udaipur-tripura")?.state, "Tripura");
});
