import type { CartItem, OrderTotals, PaymentMode } from '../types';
import { POLICY } from '../config';
import { getListing } from './inventory';

/**
 * Every rupee figure in the application is produced here.
 *
 * The checkout UI and the serverless payment route both call `computeTotals`
 * with the same inputs, so the amount the customer is shown is the amount the
 * server asks Razorpay to collect. The server never trusts a total sent by the
 * browser — it recomputes it from the catalog and the cart contents.
 */

export interface Promo {
  code: string;
  label: string;
  minSubtotal: number;
  /** Flat rupee discount, or a percentage when `percent` is set. */
  amount: number;
  percent?: boolean;
  maxDiscount?: number;
}

export const PROMOS: Promo[] = [
  {
    code: 'WELCOME500',
    label: '₹500 off your first order above ₹10,000',
    minSubtotal: 10000,
    amount: 500,
  },
  {
    code: 'ASSAM5',
    label: '5% off, up to ₹2,000',
    minSubtotal: 8000,
    amount: 5,
    percent: true,
    maxDiscount: 2000,
  },
  {
    code: 'BPS1000',
    label: '₹1,000 off orders above ₹25,000',
    minSubtotal: 25000,
    amount: 1000,
  },
];

export function findPromo(code: string | undefined): Promo | undefined {
  if (!code) return undefined;
  const wanted = code.trim().toUpperCase();
  return PROMOS.find((p) => p.code === wanted);
}

export function discountFor(promo: Promo | undefined, subtotal: number): number {
  if (!promo || subtotal < promo.minSubtotal) return 0;
  const raw = promo.percent ? (subtotal * promo.amount) / 100 : promo.amount;
  const capped = promo.maxDiscount ? Math.min(raw, promo.maxDiscount) : raw;
  return Math.min(Math.round(capped), subtotal);
}

export function shippingFor(subtotalAfterDiscount: number, method: 'standard' | 'express'): number {
  const base = subtotalAfterDiscount >= POLICY.freeShippingAbove ? 0 : POLICY.shippingFlat;
  return method === 'express' ? base + POLICY.expressSurcharge : base;
}

/**
 * The smallest booking charge we will accept against a cash-on-delivery order:
 * one tenth of the order total, rounded up so the customer never sees an odd
 * figure. Rounding is always upward, so the result can never fall below the
 * one-tenth floor the policy requires.
 */
export function minBookingCharge(total: number): number {
  const tenth = total * POLICY.minBookingFraction;
  const step = POLICY.bookingRoundTo;
  const rounded = Math.ceil(tenth / step) * step;
  return Math.min(rounded, total);
}

export function codAvailable(total: number): boolean {
  return total > 0 && total <= POLICY.codMaxOrderValue;
}

export interface TotalsInput {
  items: CartItem[];
  shippingMethod: 'standard' | 'express';
  paymentMode: PaymentMode;
  promoCode?: string;
  /**
   * What the customer chose to pay online now under COD. Clamped between the
   * minimum booking charge and the full order total. Ignored for prepaid.
   */
  bookingAmount?: number;
}

export function subtotalFor(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const listing = getListing(item.listingId);
    if (!listing) return sum;
    return sum + listing.price * clampQty(item.qty, listing.stock);
  }, 0);
}

export function clampQty(qty: number, stock: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.min(Math.floor(qty), stock));
}

export function computeTotals(input: TotalsInput): OrderTotals {
  const subtotal = subtotalFor(input.items);
  const discount = discountFor(findPromo(input.promoCode), subtotal);
  const shipping = shippingFor(subtotal - discount, input.shippingMethod);
  const total = Math.max(0, subtotal - discount + shipping);
  const minBooking = minBookingCharge(total);

  if (input.paymentMode === 'prepaid' || !codAvailable(total)) {
    return { subtotal, discount, shipping, total, payNow: total, balanceDue: 0, minBooking };
  }

  const requested = input.bookingAmount ?? minBooking;
  const payNow = Math.min(Math.max(Math.round(requested), minBooking), total);

  return { subtotal, discount, shipping, total, payNow, balanceDue: total - payNow, minBooking };
}

/** Rupees to paise, which is the only unit Razorpay accepts. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
