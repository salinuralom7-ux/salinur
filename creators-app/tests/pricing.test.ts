import { test } from "node:test";
import assert from "node:assert/strict";
import { MONTHLY_FOR_A_YEAR, PLANS, YEARLY_PER_MONTH_INR, YEARLY_SAVING_INR, YEARLY_SAVING_PCT } from "../src/lib/pricing.ts";

test("yearly plan maths shown on the pricing card", () => {
  assert.equal(PLANS.monthly.priceInr, 99);
  assert.equal(PLANS.yearly.priceInr, 499);
  assert.equal(MONTHLY_FOR_A_YEAR, 1188);
  assert.equal(YEARLY_SAVING_INR, 689);
  assert.equal(YEARLY_SAVING_PCT, 58); // 57.99…%
  assert.equal(YEARLY_PER_MONTH_INR, 42); // 41.58 rounded up: we never understate a price
});
