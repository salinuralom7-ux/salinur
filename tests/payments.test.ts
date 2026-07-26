/**
 * Checks the two pieces of the payment path that must never be wrong:
 * the booking-charge floor, and the Razorpay signature verification.
 *
 * Run with `npm test`. No test framework — these are assertions against
 * reference values, so they can run anywhere Node can.
 */

import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { verifyPaymentSignature, timingSafeEqual } from '../api/_lib/razorpay';
import { computeTotals, minBookingCharge, toPaise } from '../src/lib/pricing';
import { LISTINGS, getListing } from '../src/lib/inventory';
import { POLICY } from '../src/config';

let checks = 0;
function check(label: string, condition: boolean): void {
  checks += 1;
  if (!condition) {
    console.error(`  ✗ ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`  ✓ ${label}`);
}

// ---------------------------------------------------------------------------
console.log('\nBooking charge');
// ---------------------------------------------------------------------------

// The policy promise is "at least one tenth". Verify it over the whole catalog
// rather than a handful of hand-picked numbers.
{
  let worst = Infinity;
  let below = 0;
  for (const listing of LISTINGS) {
    const booking = minBookingCharge(listing.price);
    const ratio = booking / listing.price;
    worst = Math.min(worst, ratio);
    if (ratio < POLICY.minBookingFraction) below += 1;
  }
  check(
    `every one of ${LISTINGS.length} listings books at >= ${POLICY.minBookingFraction * 100}% (lowest ${(worst * 100).toFixed(3)}%)`,
    below === 0,
  );
}

check('rounds up, never down', minBookingCharge(24601) >= 2460.1);
check('a one-rupee order books at one rupee', minBookingCharge(1) === 1);
check('booking never exceeds the total', minBookingCharge(50) <= 50);

// ---------------------------------------------------------------------------
console.log('\nOrder totals');
// ---------------------------------------------------------------------------

{
  const listing = LISTINGS.find((l) => l.price > 20000 && l.stock >= 2);
  assert(listing, 'expected a stocked listing above 20,000 for the fixture');
  const items = [{ listingId: listing.id, qty: 1 }];

  const prepaid = computeTotals({ items, shippingMethod: 'standard', paymentMode: 'prepaid' });
  check('prepaid collects the whole total up front', prepaid.payNow === prepaid.total);
  check('prepaid leaves nothing for the courier', prepaid.balanceDue === 0);

  const cod = computeTotals({ items, shippingMethod: 'standard', paymentMode: 'cod' });
  check('COD defaults to the minimum booking charge', cod.payNow === cod.minBooking);
  check('COD split always adds back to the total', cod.payNow + cod.balanceDue === cod.total);

  // A tampered client asking to book for one rupee must be clamped upward.
  const tampered = computeTotals({
    items,
    shippingMethod: 'standard',
    paymentMode: 'cod',
    bookingAmount: 1,
  });
  check('a booking below the floor is raised to the floor', tampered.payNow === tampered.minBooking);

  // Asking to overpay is clamped to the total, never beyond.
  const overpaid = computeTotals({
    items,
    shippingMethod: 'standard',
    paymentMode: 'cod',
    bookingAmount: cod.total * 5,
  });
  check('a booking above the total is capped at the total', overpaid.payNow === overpaid.total);
  check('paying it all leaves no balance', overpaid.balanceDue === 0);

  // Quantities beyond stock must not inflate the total.
  const overQty = computeTotals({
    items: [{ listingId: listing.id, qty: 999 }],
    shippingMethod: 'standard',
    paymentMode: 'prepaid',
  });
  check(
    'quantity is clamped to stock on hand',
    overQty.subtotal === listing.price * listing.stock,
  );

  // An unknown listing contributes nothing rather than throwing.
  const bogus = computeTotals({
    items: [{ listingId: 'does-not-exist', qty: 1 }],
    shippingMethod: 'standard',
    paymentMode: 'prepaid',
  });
  check('an unknown listing is ignored, not priced', bogus.subtotal === 0);
  check('getListing rejects unknown ids', getListing('does-not-exist') === undefined);

  check('rupees convert to whole paise', toPaise(2460) === 246000 && toPaise(0.5) === 50);
}

// ---------------------------------------------------------------------------
console.log('\nRazorpay signature verification');
// ---------------------------------------------------------------------------

{
  const secret = 'test_secret_abc123';
  const orderId = 'order_Nabc123XYZ';
  const paymentId = 'pay_Ndef456UVW';

  // The reference digest, computed the way Razorpay documents it.
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

  check(
    'a genuine signature is accepted',
    await verifyPaymentSignature(secret, orderId, paymentId, expected),
  );
  check(
    'a tampered signature is rejected',
    !(await verifyPaymentSignature(secret, orderId, paymentId, expected.slice(0, -1) + '0')),
  );
  check(
    'the wrong account secret is rejected',
    !(await verifyPaymentSignature('wrong_secret', orderId, paymentId, expected)),
  );
  check(
    'swapping order and payment ids is rejected',
    !(await verifyPaymentSignature(secret, paymentId, orderId, expected)),
  );
  check(
    'uppercase hex from the gateway is accepted',
    await verifyPaymentSignature(secret, orderId, paymentId, expected.toUpperCase()),
  );
  check('length mismatch is rejected before comparing', timingSafeEqual('abc', 'abcd') === false);
  check('identical strings compare equal', timingSafeEqual('abcd', 'abcd') === true);
}

console.log(
  `\n${process.exitCode ? 'FAILED' : 'All ' + checks + ' checks passed'}\n`,
);
