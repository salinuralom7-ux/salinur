/**
 * Browser-side environment. Kept apart from `config.ts` so the pricing module
 * stays free of Vite-only globals and can be imported by the serverless
 * payment routes as well as by the app.
 */

export type PaymentsMode = 'auto' | 'live' | 'demo';

/**
 *  - 'auto' (default): use the real Razorpay routes when the server has keys
 *    configured, and fall back to a clearly-labelled test mode when it does not,
 *    so the shop is usable before the merchant account is live.
 *  - 'live': never fall back. Payment fails loudly if the gateway is unreachable.
 *  - 'demo': never contact Razorpay at all.
 */
export const PAYMENTS_MODE: PaymentsMode =
  (import.meta.env.VITE_PAYMENTS_MODE as PaymentsMode | undefined) ?? 'auto';
