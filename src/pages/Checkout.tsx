import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import type { Address, Order, OrderItem, PaymentMode } from '../types';
import { CONDITIONS } from '../data/conditions';
import { formatStorage, getListing } from '../lib/inventory';
import { codAvailable, computeTotals, findPromo, PROMOS } from '../lib/pricing';
import { PaymentCancelled, PaymentError, pay } from '../lib/razorpay';
import { inr } from '../lib/format';
import { POLICY, STORE } from '../config';
import { PAYMENTS_MODE } from '../lib/env';
import { newOrderRef, useStore } from '../store/context';

const STEPS = ['Delivery address', 'Delivery speed', 'Payment', 'Review'] as const;

const STATES = [
  'Assam',
  'Arunachal Pradesh',
  'Bihar',
  'Delhi',
  'Karnataka',
  'Kerala',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'West Bengal',
];

const EMPTY_ADDRESS: Address = {
  name: '',
  phone: '',
  email: '',
  line1: '',
  line2: '',
  city: '',
  state: 'Assam',
  pincode: '',
  landmark: '',
};

/** Presets offered for the cash-on-delivery booking charge. */
const BOOKING_PRESETS = [0.1, 0.25, 0.5] as const;

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, placeOrder } = useStore();

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('prepaid');
  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState<string | undefined>();
  const [promoError, setPromoError] = useState<string | null>(null);
  const [bookingAmount, setBookingAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Placing an order empties the cart. Without this flag the empty-cart guard
  // below would fire on the next render and bounce the customer back to the
  // cart before the redirect to their confirmation page could happen.
  const [placed, setPlaced] = useState(false);

  const lines = useMemo(
    () =>
      cart.flatMap((item) => {
        const listing = getListing(item.listingId);
        return listing ? [{ item, listing }] : [];
      }),
    [cart],
  );

  // Totals for the *currently chosen* booking amount.
  const totals = useMemo(
    () =>
      computeTotals({
        items: cart,
        shippingMethod,
        paymentMode,
        promoCode,
        bookingAmount: bookingAmount ?? undefined,
      }),
    [cart, shippingMethod, paymentMode, promoCode, bookingAmount],
  );

  if (lines.length === 0 && !placed) return <Navigate to="/cart" replace />;

  const codAllowed = codAvailable(totals.total);
  const bookingFloorPercent = Math.round(POLICY.minBookingFraction * 100);

  const addressValid =
    address.name.trim().length >= 2 &&
    /^[6-9]\d{9}$/.test(address.phone.replace(/\D/g, '')) &&
    /^\S+@\S+\.\S+$/.test(address.email.trim()) &&
    address.line1.trim().length >= 6 &&
    address.city.trim().length >= 2 &&
    /^\d{6}$/.test(address.pincode.trim());

  const field = (key: keyof Address) => ({
    value: address[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setAddress((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const applyPromo = () => {
    const promo = findPromo(promoInput);
    if (!promo) {
      setPromoError('That code is not recognised.');
      return;
    }
    if (totals.subtotal < promo.minSubtotal) {
      setPromoError(`This code needs a subtotal of at least ${inr(promo.minSubtotal)}.`);
      return;
    }
    setPromoCode(promo.code);
    setPromoError(null);
  };

  const chooseMode = (mode: PaymentMode) => {
    setPaymentMode(mode);
    setError(null);
    // Reset the booking amount so it re-derives from the new total.
    setBookingAmount(null);
  };

  const setBookingPreset = (fraction: number) => {
    const raw = Math.round(totals.total * fraction);
    setBookingAmount(Math.max(raw, totals.minBooking));
  };

  const placeIt = async () => {
    setBusy(true);
    setError(null);

    const orderRef = newOrderRef();

    try {
      const result = await pay({
        items: cart,
        totals,
        shippingMethod,
        paymentMode,
        promoCode,
        orderRef,
        address,
      });

      const items: OrderItem[] = lines.map(({ item, listing }) => ({
        listingId: listing.id,
        title: `${listing.model} · ${formatStorage(listing.storageGb)} · ${listing.color.name}`,
        qty: item.qty,
        price: listing.price,
        condition: listing.condition,
        warrantyMonths: listing.warrantyMonths,
        unitRef: listing.unitRef,
      }));

      const order: Order = {
        id: orderRef,
        date: new Date().toISOString(),
        items,
        totals,
        promoCode,
        shippingMethod,
        paymentMode,
        payment: result.payment,
        address,
        status: 'confirmed',
      };

      setPlaced(true);
      placeOrder(order);
      navigate(`/order/${encodeURIComponent(orderRef)}`, { replace: true });
    } catch (err) {
      if (err instanceof PaymentCancelled) {
        setError('You closed the payment window before it finished. Nothing has been charged.');
      } else if (err instanceof PaymentError) {
        setError(err.message);
      } else {
        setError('Something went wrong while taking the payment. Nothing has been charged — please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container checkout">
      <header className="page-head">
        <h1>Checkout</h1>
      </header>

      <ol className="stepper" aria-label="Checkout steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={index === step ? 'is-current' : index < step ? 'is-done' : ''}
            aria-current={index === step ? 'step' : undefined}
          >
            <button type="button" onClick={() => index < step && setStep(index)} disabled={index >= step}>
              <span className="step-num">{index < step ? '✓' : index + 1}</span>
              <span>{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="checkout-layout">
        <div className="checkout-main">
          {/* ---- Step 1: address ---------------------------------------- */}
          {step === 0 && (
            <section className="panel">
              <h2>Where should it go?</h2>
              <div className="form-grid">
                <label className="field">
                  <span>Full name</span>
                  <input type="text" autoComplete="name" required {...field('name')} />
                </label>
                <label className="field">
                  <span>Mobile number</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="10-digit number"
                    required
                    {...field('phone')}
                  />
                </label>
                <label className="field field-wide">
                  <span>Email</span>
                  <input type="email" autoComplete="email" required {...field('email')} />
                  <small className="muted">The order confirmation and warranty card go here.</small>
                </label>
                <label className="field field-wide">
                  <span>Address</span>
                  <input
                    type="text"
                    autoComplete="address-line1"
                    placeholder="House number, street, area"
                    required
                    {...field('line1')}
                  />
                </label>
                <label className="field field-wide">
                  <span>
                    Landmark <em>(optional)</em>
                  </span>
                  <input type="text" {...field('landmark')} />
                </label>
                <label className="field">
                  <span>Town or city</span>
                  <input type="text" autoComplete="address-level2" required {...field('city')} />
                </label>
                <label className="field">
                  <span>State</span>
                  <select {...field('state')}>
                    {STATES.map((state) => (
                      <option key={state}>{state}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>PIN code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="postal-code"
                    required
                    {...field('pincode')}
                  />
                </label>
              </div>

              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={!addressValid}
                onClick={() => setStep(1)}
              >
                Continue to delivery
              </button>
              {!addressValid && (
                <p className="muted small">Fill in the name, mobile, email, address, city and PIN code to continue.</p>
              )}
            </section>
          )}

          {/* ---- Step 2: shipping --------------------------------------- */}
          {step === 1 && (
            <section className="panel">
              <h2>How fast do you need it?</h2>

              <label className={`option${shippingMethod === 'standard' ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="shipping"
                  checked={shippingMethod === 'standard'}
                  onChange={() => setShippingMethod('standard')}
                />
                <span className="option-body">
                  <strong>Standard delivery</strong>
                  <span className="muted">3–5 working days across Assam, 5–8 elsewhere in India</span>
                </span>
                <span className="option-price">
                  {totals.subtotal >= POLICY.freeShippingAbove ? 'Free' : inr(POLICY.shippingFlat)}
                </span>
              </label>

              <label className={`option${shippingMethod === 'express' ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="shipping"
                  checked={shippingMethod === 'express'}
                  onChange={() => setShippingMethod('express')}
                />
                <span className="option-body">
                  <strong>Express delivery</strong>
                  <span className="muted">1–2 working days within Assam, 3–4 elsewhere</span>
                </span>
                <span className="option-price">
                  +{inr(POLICY.expressSurcharge)}
                </span>
              </label>

              <div className="promo">
                <label className="field">
                  <span>Discount code</span>
                  <div className="promo-row">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value.toUpperCase());
                        setPromoError(null);
                      }}
                      placeholder="e.g. WELCOME500"
                    />
                    <button type="button" className="btn btn-secondary" onClick={applyPromo}>
                      Apply
                    </button>
                  </div>
                </label>
                {promoError && <p className="field-error">{promoError}</p>}
                {promoCode && (
                  <p className="promo-ok">
                    {promoCode} applied — {inr(totals.discount)} off.{' '}
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setPromoCode(undefined);
                        setPromoInput('');
                      }}
                    >
                      Remove
                    </button>
                  </p>
                )}
                <ul className="promo-list">
                  {PROMOS.map((promo) => (
                    <li key={promo.code}>
                      <code>{promo.code}</code> — {promo.label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="step-nav">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
                  Back
                </button>
                <button type="button" className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
                  Continue to payment
                </button>
              </div>
            </section>
          )}

          {/* ---- Step 3: payment ---------------------------------------- */}
          {step === 2 && (
            <section className="panel">
              <h2>How would you like to pay?</h2>

              <label className={`option${paymentMode === 'prepaid' ? ' is-on' : ''}`}>
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMode === 'prepaid'}
                  onChange={() => chooseMode('prepaid')}
                />
                <span className="option-body">
                  <strong>Pay the full amount now</strong>
                  <span className="muted">
                    UPI, card, net banking or wallet through Razorpay. Nothing to pay at the door.
                  </span>
                </span>
                <span className="option-price">{inr(totals.total)}</span>
              </label>

              <label
                className={`option${paymentMode === 'cod' ? ' is-on' : ''}${codAllowed ? '' : ' is-disabled'}`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMode === 'cod'}
                  disabled={!codAllowed}
                  onChange={() => chooseMode('cod')}
                />
                <span className="option-body">
                  <strong>Cash on delivery</strong>
                  <span className="muted">
                    {codAllowed
                      ? `Pay a booking charge online now, the rest in cash to the courier.`
                      : `Not available above ${inr(POLICY.codMaxOrderValue)} — too much cash for a courier to carry.`}
                  </span>
                </span>
                <span className="option-price">from {inr(totals.minBooking)}</span>
              </label>

              {paymentMode === 'cod' && codAllowed && (
                <div className="booking-panel">
                  <h3>Your booking charge</h3>
                  <p>
                    A cash-on-delivery order is secured with a booking charge paid online — at least{' '}
                    <strong>a tenth of the order total</strong>, which is {inr(totals.minBooking)} on this
                    order. It is not a fee: the full amount comes off what you owe at the door.
                  </p>

                  <div className="booking-presets">
                    {BOOKING_PRESETS.map((fraction) => {
                      const amount = Math.max(Math.round(totals.total * fraction), totals.minBooking);
                      return (
                        <button
                          key={fraction}
                          type="button"
                          className={`chip-btn${totals.payNow === amount ? ' is-on' : ''}`}
                          onClick={() => setBookingPreset(fraction)}
                        >
                          {Math.round(fraction * 100)}% · {inr(amount)}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`chip-btn${totals.payNow === totals.total ? ' is-on' : ''}`}
                      onClick={() => setBookingAmount(totals.total)}
                    >
                      Pay it all · {inr(totals.total)}
                    </button>
                  </div>

                  <label className="field">
                    <span>Or set your own amount</span>
                    <input
                      type="range"
                      min={totals.minBooking}
                      max={totals.total}
                      step={POLICY.bookingRoundTo}
                      value={totals.payNow}
                      onChange={(e) => setBookingAmount(Number(e.target.value))}
                      aria-label="Booking charge"
                    />
                    <div className="range-ends">
                      <span>min {inr(totals.minBooking)}</span>
                      <span>full {inr(totals.total)}</span>
                    </div>
                  </label>

                  <div className="booking-split">
                    <div>
                      <span className="muted small">Pay online now</span>
                      <strong>{inr(totals.payNow)}</strong>
                    </div>
                    <span className="booking-plus" aria-hidden="true">
                      +
                    </span>
                    <div>
                      <span className="muted small">Cash to the courier</span>
                      <strong>{inr(totals.balanceDue)}</strong>
                    </div>
                  </div>

                  <details className="fine-print">
                    <summary>What happens to the booking charge</summary>
                    <ul>
                      <li>It is deducted from the total. You never pay it twice.</li>
                      <li>
                        You get {POLICY.inspectionWindowMinutes} minutes with the courier present to switch the
                        phone on and check it against the listing.
                      </li>
                      <li>
                        If the handset does not match its listing, refuse the delivery and the booking charge
                        is refunded in full within five working days.
                      </li>
                      <li>
                        If you simply change your mind and refuse a delivery that does match, the booking
                        charge covers the round trip and is not refunded.
                      </li>
                      <li>If we cannot deliver for any reason of ours, it is refunded in full.</li>
                    </ul>
                  </details>
                </div>
              )}

              {PAYMENTS_MODE !== 'live' && (
                <p className="notice">
                  If the shop’s Razorpay account is not yet connected, the payment step runs in test mode and
                  no money moves. The order is still recorded so the flow can be checked end to end.
                </p>
              )}

              <div className="step-nav">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="button" className="btn btn-primary btn-lg" onClick={() => setStep(3)}>
                  Review the order
                </button>
              </div>
            </section>
          )}

          {/* ---- Step 4: review ----------------------------------------- */}
          {step === 3 && (
            <section className="panel">
              <h2>Check everything over</h2>

              <div className="review-block">
                <h3>Delivering to</h3>
                <p>
                  {address.name}
                  <br />
                  {address.line1}
                  {address.landmark ? `, ${address.landmark}` : ''}
                  <br />
                  {address.city}, {address.state} {address.pincode}
                  <br />
                  {address.phone} · {address.email}
                </p>
                <button type="button" className="link-btn" onClick={() => setStep(0)}>
                  Change
                </button>
              </div>

              <div className="review-block">
                <h3>Items</h3>
                <ul className="review-items">
                  {lines.map(({ item, listing }) => (
                    <li key={listing.id}>
                      <span>
                        {listing.model} · {formatStorage(listing.storageGb)} · {listing.color.name} ·{' '}
                        {CONDITIONS[listing.condition].name}
                        {item.qty > 1 ? ` × ${item.qty}` : ''}
                        <br />
                        <small className="muted">
                          Unit {listing.unitRef} · {listing.warrantyMonths}-month warranty
                        </small>
                      </span>
                      <strong>{inr(listing.price * item.qty)}</strong>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="review-block">
                <h3>Payment</h3>
                {paymentMode === 'prepaid' ? (
                  <p>
                    Paying {inr(totals.total)} now through Razorpay. Nothing to pay at the door.
                  </p>
                ) : (
                  <p>
                    Paying a booking charge of <strong>{inr(totals.payNow)}</strong> now through Razorpay, and{' '}
                    <strong>{inr(totals.balanceDue)}</strong> in cash to the courier on delivery.
                  </p>
                )}
                <button type="button" className="link-btn" onClick={() => setStep(2)}>
                  Change
                </button>
              </div>

              {error && (
                <p className="alert" role="alert">
                  {error}
                </p>
              )}

              <button
                type="button"
                className="btn btn-primary btn-lg btn-block"
                onClick={placeIt}
                disabled={busy}
              >
                {busy
                  ? 'Opening payment…'
                  : paymentMode === 'cod'
                    ? `Pay ${inr(totals.payNow)} and book it`
                    : `Pay ${inr(totals.total)}`}
              </button>

              <p className="muted small">
                By placing this order you accept our condition grading and returns policy. Questions? Write to{' '}
                <a href={`mailto:${STORE.email}`}>{STORE.email}</a>.
              </p>

              <div className="step-nav">
                <button type="button" className="btn btn-ghost" onClick={() => setStep(2)} disabled={busy}>
                  Back
                </button>
              </div>
            </section>
          )}
        </div>

        {/* ---- Running summary ------------------------------------------ */}
        <aside className="summary">
          <h2>Order summary</h2>
          <dl className="summary-lines">
            <div>
              <dt>
                Subtotal <span className="muted small">({lines.length} item{lines.length === 1 ? '' : 's'})</span>
              </dt>
              <dd>{inr(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="summary-discount">
                <dt>Discount {promoCode && <code>{promoCode}</code>}</dt>
                <dd>−{inr(totals.discount)}</dd>
              </div>
            )}
            <div>
              <dt>Delivery</dt>
              <dd>{totals.shipping === 0 ? 'Free' : inr(totals.shipping)}</dd>
            </div>
            <div className="summary-total">
              <dt>Order total</dt>
              <dd>{inr(totals.total)}</dd>
            </div>
          </dl>

          {paymentMode === 'cod' && codAllowed && (
            <div className="summary-split">
              <div>
                <dt>Booking charge, paid online</dt>
                <dd>{inr(totals.payNow)}</dd>
              </div>
              <div>
                <dt>Cash on delivery</dt>
                <dd>{inr(totals.balanceDue)}</dd>
              </div>
              <p className="muted small">
                Minimum booking charge is {bookingFloorPercent}% of the total, or {inr(totals.minBooking)} here.
              </p>
            </div>
          )}

          <ul className="assurance">
            <li>{POLICY.inspectionWindowMinutes}-minute check at your door</li>
            <li>{POLICY.returnWindowDays}-day return if it does not match the listing</li>
            <li>Warranty on every handset</li>
          </ul>

          <p className="muted small">
            <Link to="/cart">Edit the cart</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
