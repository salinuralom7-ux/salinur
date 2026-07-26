import { computeTotals, toPaise } from '../../src/lib/pricing';
import { getListing } from '../../src/lib/inventory';
import type { CartItem, PaymentMode } from '../../src/types';
import { credentials, createRazorpayOrder, json, notConfigured } from '../_lib/razorpay';

/**
 * Creates the Razorpay order the browser will pay against.
 *
 * The browser sends what is in the cart, never a price. The amount is
 * recomputed here from the same catalog and the same pricing rules the
 * storefront uses, which is what stops a modified client from booking a
 * ninety-thousand-rupee iPhone for one rupee.
 */

interface OrderRequest {
  items: CartItem[];
  shippingMethod: 'standard' | 'express';
  paymentMode: PaymentMode;
  promoCode?: string;
  bookingAmount?: number;
  orderRef: string;
  customer?: { name?: string; email?: string; phone?: string };
}

function parseItems(input: unknown): CartItem[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 20) return null;

  const items: CartItem[] = [];
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) return null;
    const { listingId, qty } = raw as Partial<CartItem>;
    if (typeof listingId !== 'string') return null;
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) return null;

    const listing = getListing(listingId);
    if (!listing) return null;
    if (qty > listing.stock) return null;

    items.push({ listingId, qty });
  }
  return items;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const creds = credentials();
  if (!creds) return notConfigured();

  let body: OrderRequest;
  try {
    body = (await request.json()) as OrderRequest;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const items = parseItems(body.items);
  if (!items) {
    return json({ error: 'invalid_cart', message: 'One or more items are no longer available.' }, 400);
  }

  const shippingMethod = body.shippingMethod === 'express' ? 'express' : 'standard';
  const paymentMode: PaymentMode = body.paymentMode === 'cod' ? 'cod' : 'prepaid';

  const totals = computeTotals({
    items,
    shippingMethod,
    paymentMode,
    promoCode: body.promoCode,
    bookingAmount: body.bookingAmount,
  });

  // computeTotals already clamps the booking charge to at least a tenth of the
  // order, but assert it here too — this is the boundary that faces the network.
  if (paymentMode === 'cod' && totals.payNow < totals.minBooking) {
    return json({ error: 'booking_too_low', minBooking: totals.minBooking }, 400);
  }

  const amount = toPaise(totals.payNow);
  if (amount < 100) {
    return json({ error: 'amount_too_small', message: 'Minimum online payment is ₹1.' }, 400);
  }

  const orderRef = typeof body.orderRef === 'string' ? body.orderRef.slice(0, 40) : 'BPS';

  const result = await createRazorpayOrder(creds, {
    amount,
    currency: 'INR',
    receipt: orderRef,
    notes: {
      order_ref: orderRef,
      payment_mode: paymentMode,
      order_total: String(totals.total),
      paid_online: String(totals.payNow),
      balance_on_delivery: String(totals.balanceDue),
      items: items.map((i) => `${i.listingId}×${i.qty}`).join(', ').slice(0, 480),
    },
  });

  if (!result.ok) {
    return json({ error: 'gateway_error', status: result.status, detail: result.detail }, 502);
  }

  return json({
    orderId: result.order.id,
    amount: result.order.amount,
    currency: result.order.currency,
    keyId: creds.keyId,
    totals,
  });
}
