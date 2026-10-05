import { test } from "node:test";
import assert from "node:assert/strict";
import { MONTHLY_FOR_A_YEAR, PLANS, YEARLY_PER_MONTH_INR, YEARLY_SAVING_INR, YEARLY_SAVING_PCT } from "../src/lib/pricing.ts";

test("yearly plan maths shown on the pricing card", () => {
  assert.equal(PLANS.monthly.priceInr, 99);
  assert.equal(PLANS.yearly.priceInr, 594); // exactly half of 12 × ₹99
  assert.equal(MONTHLY_FOR_A_YEAR, 1188);
  assert.equal(YEARLY_SAVING_INR, 594);
  assert.equal(YEARLY_SAVING_PCT, 50);
  assert.equal(YEARLY_PER_MONTH_INR, 50); // 49.50 rounded up: we never understate a price
});
