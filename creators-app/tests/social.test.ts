import { test } from "node:test";
import assert from "node:assert/strict";
import { facebookUrl, normalizeFacebook, normalizeInstagram } from "../src/lib/social.ts";

test("Instagram: accepts handles and profile links in any shape", () => {
  assert.equal(normalizeInstagram("@Food.Guwahati"), "food.guwahati");
  assert.equal(normalizeInstagram("https://www.instagram.com/food.guwahati/?hl=en"), "food.guwahati");
  assert.equal(normalizeInstagram("instagram.com/salinur_alom"), "salinur_alom");
});

test("Instagram: rejects posts, reels and invalid usernames", () => {
  assert.equal(normalizeInstagram("https://instagram.com/reel/Cxyz123/"), null);
  assert.equal(normalizeInstagram("bad..handle"), null);
  assert.equal(normalizeInstagram(".dotfirst"), null);
  assert.equal(normalizeInstagram("has space"), null);
  assert.equal(normalizeInstagram("a".repeat(31)), null);
});

test("Facebook: accepts page names, vanity links and numeric profile links", () => {
  assert.equal(normalizeFacebook("https://www.facebook.com/GuwahatiFoodie"), "guwahatifoodie");
  assert.equal(normalizeFacebook("fb.com/guwahati.foodie/"), "guwahati.foodie");
  assert.equal(normalizeFacebook("guwahatifoodie"), "guwahatifoodie");
  assert.equal(normalizeFacebook("https://m.facebook.com/profile.php?id=100012345678"), "id:100012345678");
  assert.equal(normalizeFacebook("https://www.facebook.com/people/Salinur-Alom/100087654321/"), "id:100087654321");
  assert.equal(facebookUrl("id:100012345678"), "https://www.facebook.com/profile.php?id=100012345678");
});

test("Facebook: rejects groups, share links and too-short names", () => {
  assert.equal(normalizeFacebook("https://www.facebook.com/groups/123456"), null);
  assert.equal(normalizeFacebook("https://www.facebook.com/share/abc123/"), null);
  assert.equal(normalizeFacebook("abc"), null);
});
