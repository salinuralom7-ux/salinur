import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PROMO_CODES, formatINR, productTitle } from '../data/products';
import { GRADES } from '../data/grades';
import { newOrderId, useStore } from '../store/context';
import type { Address, Order } from '../types';

const STEPS = ['Address', 'Shipping', 'Payment', 'Review'] as const;

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI (Google Pay / PhonePe / Paytm)' },
  { id: 'card', label: 'Debit / Credit Card' },
  { id: 'netbanking', label: 'Net Banking' },
  { id: 'emi', label: 'EMI — 0% for 3/6 months (orders above ₹10,000)' },
  { id: 'cod', label: 'Cash on Delivery' },
];

export default function Checkout() {
  const { products: PRODUCTS, cart, placeOrder } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const [address, setAddress] = useState<Address>({ name: '', phone: '', line1: '', city: '', state: 'Assam', pincode: '' });
  const [shipping, setShipping] = useState<'standard' | 'express'>('standard');
  const [payment, setPayment] = useState('upi');
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState('');
  const [gradeEAck, setGradeEAck] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');

  const lines = cart
    .map((item) => ({ item, product: PRODUCTS.find((p) => p.id === item.productId)! }))
    .filter((l) => l.product);

  if (lines.length === 0) {
    return (
      <div className="container empty-state">
        <h1>Nothing to check out</h1>
        <Link to="/shop" className="btn btn-primary btn-lg">Shop Phones</Link>
      </div>
    );
  }

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.item.qty, 0);
  const shippingCost = shipping === 'express' ? 199 : 0;

  let discount = 0;
  if (promo) {
    const code = PROMO_CODES[promo];
    if (code.type === 'flat') discount = code.value;
    else discount = Math.min(Math.round((subtotal * code.value) / 100), 300);
  }
  const total = Math.max(subtotal - discount + shippingCost, 0);

  const hasGradeE = lines.some((l) => l.product.grade === 'E');
  const emiAvailable = subtotal >= 10000;

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    const def = PROMO_CODES[code];
    if (!def) {
      setPromoError('Invalid promo code');
      setPromo(null);
    } else if (subtotal < def.minOrder) {
      setPromoError(`This code needs a minimum order of ${formatINR(def.minOrder)}`);
      setPromo(null);
    } else {
      setPromo(code);
      setPromoError('');
    }
  };

  const addressValid =
    address.name.trim() !== '' &&
    /^\d{10}$/.test(address.phone) &&
    address.line1.trim() !== '' &&
    address.city.trim() !== '' &&
    /^\d{6}$/.test(address.pincode);

  const confirmOrder = () => {
    const order: Order = {
      id: newOrderId(),
      date: new Date().toISOString(),
      items: lines.map((l) => ({
        productId: l.product.id,
        qty: l.item.qty,
        price: l.product.price,
        grade: l.product.grade,
        title: productTitle(l.product),
        warrantyMonths: GRADES[l.product.grade].warrantyMonths,
      })),
      subtotal,
      discount,
      shipping: shippingCost,
      total,
      promoCode: promo ?? undefined,
      shippingMethod: shipping,
      paymentMethod: PAYMENT_METHODS.find((m) => m.id === payment)?.label ?? payment,
      address,
      status: 'pending',
      gradeEAck,
    };
    setPlacing(true);
    setPlaceError('');
    placeOrder(order)
      .then(() => navigate(`/order-confirmed/${order.id}`))
      .catch((e) => {
        setPlaceError(e instanceof Error ? e.message : 'Order failed — please try again.');
        setPlacing(false);
      });
  };

  return (
    <div className="container">
      <h1>Checkout</h1>
      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'active' : i < step ? 'done' : ''}>
            {i < step ? '✓ ' : `${i + 1}. `}{s}
          </li>
        ))}
      </ol>

      <div className="checkout-layout">
        <div className="checkout-main">
          {step === 0 && (
            <div className="card">
              <h2>Delivery Address</h2>
              <div className="form-grid">
                <label>Full name<input value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} /></label>
                <label>Phone (10 digits)<input value={address.phone} maxLength={10} onChange={(e) => setAddress({ ...address, phone: e.target.value.replace(/\D/g, '') })} /></label>
                <label className="span2">Address (house, street, area)<input value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} /></label>
                <label>City / Town<input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} /></label>
                <label>State<input value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} /></label>
                <label>PIN code (6 digits)<input value={address.pincode} maxLength={6} onChange={(e) => setAddress({ ...address, pincode: e.target.value.replace(/\D/g, '') })} /></label>
              </div>
              <button className="btn btn-primary btn-lg" disabled={!addressValid} onClick={() => setStep(1)}>
                Continue to Shipping
              </button>
              {!addressValid && <p className="muted">Fill all fields — phone must be 10 digits, PIN code 6 digits.</p>}
            </div>
          )}

          {step === 1 && (
            <div className="card">
              <h2>Shipping Options</h2>
              <label className="option-row">
                <input type="radio" checked={shipping === 'standard'} onChange={() => setShipping('standard')} />
                <span><strong>Standard (5–7 days)</strong> — Free</span>
              </label>
              <label className="option-row">
                <input type="radio" checked={shipping === 'express'} onChange={() => setShipping('express')} />
                <span><strong>Express (2–3 days)</strong> — ₹199</span>
              </label>
              <div className="step-nav">
                <button className="btn btn-outline" onClick={() => setStep(0)}>Back</button>
                <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>Continue to Payment</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="card">
              <h2>Payment Method</h2>
              {PAYMENT_METHODS.map((m) => {
                const disabled = m.id === 'emi' && !emiAvailable;
                return (
                  <label key={m.id} className={`option-row ${disabled ? 'disabled' : ''}`}>
                    <input type="radio" checked={payment === m.id} disabled={disabled} onChange={() => setPayment(m.id)} />
                    <span>{m.label}{disabled && ' — not available for this order value'}</span>
                  </label>
                );
              })}
              <p className="muted">
                Online payments are processed securely via Razorpay (integration goes live with your Razorpay merchant keys).
              </p>
              <div className="promo-box">
                <h4>Promo code</h4>
                <div className="promo-input">
                  <input
                    placeholder="e.g. WELCOME50"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                  />
                  <button className="btn btn-outline" onClick={applyPromo}>Apply</button>
                </div>
                {promo && <p className="promo-ok">✓ {promo} applied — you save {formatINR(discount)}</p>}
                {promoError && <p className="promo-err">{promoError}</p>}
              </div>
              <div className="step-nav">
                <button className="btn btn-outline" onClick={() => setStep(1)}>Back</button>
                <button className="btn btn-primary btn-lg" onClick={() => setStep(3)}>Review Order</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="card">
              <h2>Order Review</h2>
              {lines.map(({ item, product }) => (
                <div key={product.id} className="review-line">
                  <span>
                    {productTitle(product)} × {item.qty}
                    <small className="muted"> — Grade {product.grade}, {GRADES[product.grade].warrantyNote}</small>
                  </span>
                  <span>{formatINR(product.price * item.qty)}</span>
                </div>
              ))}
              <div className="review-line muted">
                <span>Deliver to</span>
                <span>{address.name}, {address.line1}, {address.city}, {address.state} – {address.pincode}</span>
              </div>
              <div className="review-line muted">
                <span>Payment</span>
                <span>{PAYMENT_METHODS.find((m) => m.id === payment)?.label}</span>
              </div>

              {hasGradeE && (
                <label className="grade-e-ack">
                  <input type="checkbox" checked={gradeEAck} onChange={(e) => setGradeEAck(e.target.checked)} />
                  <span>
                    <strong>I understand this order contains a Grade E phone that needs repair before use.</strong>{' '}
                    Grade E items carry a 1-month repair warranty only and are sold with full disclosure of faults.
                  </span>
                </label>
              )}

              <div className="step-nav">
                <button className="btn btn-outline" onClick={() => setStep(2)}>Back</button>
                <button
                  className="btn btn-buy btn-lg"
                  disabled={(hasGradeE && !gradeEAck) || placing}
                  onClick={confirmOrder}
                >
                  {placing ? 'Placing order…' : `Place Order — ${formatINR(total)}`}
                </button>
              </div>
              {placeError && <p className="promo-err">{placeError}</p>}
            </div>
          )}
        </div>

        <aside className="cart-summary">
          <h3>Summary</h3>
          <div className="summary-row"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
          {discount > 0 && <div className="summary-row promo-ok"><span>Promo ({promo})</span><span>−{formatINR(discount)}</span></div>}
          <div className="summary-row"><span>Shipping</span><span>{shippingCost === 0 ? 'Free' : formatINR(shippingCost)}</span></div>
          <div className="summary-row total"><span>Total</span><span>{formatINR(total)}</span></div>
          <p className="muted">🛡️ Buyer Protection: every purchase covered by our 15-day money-back guarantee.</p>
        </aside>
      </div>
    </div>
  );
}
