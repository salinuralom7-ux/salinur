/**
 * Creator plans. The only thing anyone pays for: creators choose monthly or
 * yearly billing for the same listing. Businesses are always free.
 *
 * Savings are calculated from the two prices, never typed by hand, so the
 * "Save X%" badge can't drift out of sync if a price changes.
 */
export const PLANS = {
  monthly: { id: "monthly", priceInr: 99, interval: "month" },
  yearly: { id: "yearly", priceInr: 594, interval: "year" },
} as const;

export type PlanId = keyof typeof PLANS;

/** What 12 months on the monthly plan would cost. */
export const MONTHLY_FOR_A_YEAR = PLANS.monthly.priceInr * 12;

/** Rupees saved per year by choosing yearly. */
export const YEARLY_SAVING_INR = MONTHLY_FOR_A_YEAR - PLANS.yearly.priceInr;

/** Discount vs. paying monthly, as a whole percent. */
export const YEARLY_SAVING_PCT = Math.round((YEARLY_SAVING_INR / MONTHLY_FOR_A_YEAR) * 100);

/** Effective monthly cost of the yearly plan, rounded up so we never understate it. */
export const YEARLY_PER_MONTH_INR = Math.ceil(PLANS.yearly.priceInr / 12);
