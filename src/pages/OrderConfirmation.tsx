import { Link, Navigate, useParams } from 'react-router-dom';
import { CONDITIONS } from '../data/conditions';
import { inr, longDate } from '../lib/format';
import { POLICY, STORE } from '../config';
import { useStore } from '../store/context';

export default function OrderConfirmation() {
  const { id = '' } = useParams();
  const { orders } = useStore();

  const order = orders.find((o) => o.id === decodeURIComponent(id));
  if (!order) return <Navigate to="/orders" replace />;

  const cod = order.paymentMode === 'cod';
  const simulated = order.payment.provider === 'test';

  const whatsapp = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(
    `Hello ${STORE.name}, I have just placed order ${order.id}.`,
  )}`;

  return (
    <div className="container confirmation">
      <div className="confirm-hero">
        <span className="confirm-tick" aria-hidden="true">
          ✓
        </span>
        <h1>{cod ? 'Your phone is booked' : 'Payment received'}</h1>
        <p className="lede">
          Order <strong>{order.id}</strong> · placed {longDate(order.date)}
        </p>
      </div>

      {simulated && (
        <p className="notice" role="status">
          This order was placed in <strong>test mode</strong> — the shop’s Razorpay account is not connected
          yet, so no money has moved and nothing has been dispatched. The order is recorded so the flow can be
          checked end to end.
        </p>
      )}

      <section className="panel">
        <h2>What happens next</h2>
        <ol className="steps steps-compact">
          <li>
            <h3>We pull your handset off the shelf</h3>
            <p>
              Each unit reference below identifies one physical phone. It is set aside for you as soon as this
              order is confirmed.
            </p>
          </li>
          <li>
            <h3>Final inspection and packing</h3>
            <p>
              The phone is charged, wiped, re-tested and packed. We will send you photographs of the actual
              unit on WhatsApp before it leaves the shop.
            </p>
          </li>
          <li>
            <h3>Check it at your door</h3>
            <p>
              You have {POLICY.inspectionWindowMinutes} minutes with the courier present to switch it on and
              check it against the listing.
              {cod && ' Pay the balance in cash only after you are satisfied.'}
            </p>
          </li>
        </ol>
      </section>

      <div className="confirm-grid">
        <section className="panel">
          <h2>Payment</h2>
          <dl className="summary-lines">
            <div>
              <dt>Order total</dt>
              <dd>{inr(order.totals.total)}</dd>
            </div>
            <div>
              <dt>{cod ? 'Booking charge paid online' : 'Paid online'}</dt>
              <dd>{inr(order.totals.payNow)}</dd>
            </div>
            {cod && (
              <div className="summary-total">
                <dt>Due in cash on delivery</dt>
                <dd>{inr(order.totals.balanceDue)}</dd>
              </div>
            )}
          </dl>

          <p className="muted small">
            Payment reference {order.payment.paymentId}
            {order.payment.verified ? ' · verified' : ''}
          </p>

          {cod && (
            <p className="note">
              Please keep {inr(order.totals.balanceDue)} in cash ready. The courier cannot accept UPI or cards
              at the door.
            </p>
          )}
        </section>

        <section className="panel">
          <h2>Delivering to</h2>
          <p>
            {order.address.name}
            <br />
            {order.address.line1}
            {order.address.landmark ? `, ${order.address.landmark}` : ''}
            <br />
            {order.address.city}, {order.address.state} {order.address.pincode}
            <br />
            {order.address.phone}
          </p>
          <p className="muted small">
            {order.shippingMethod === 'express' ? 'Express delivery' : 'Standard delivery'} — a tracking link
            goes to {order.address.email} once it is dispatched.
          </p>
        </section>
      </div>

      <section className="panel">
        <h2>Your handsets</h2>
        <ul className="review-items">
          {order.items.map((item) => (
            <li key={item.listingId}>
              <span>
                {item.title}
                {item.qty > 1 ? ` × ${item.qty}` : ''}
                <br />
                <small className="muted">
                  {CONDITIONS[item.condition].name} · unit {item.unitRef} · {item.warrantyMonths}-month
                  warranty from delivery
                </small>
              </span>
              <strong>{inr(item.price * item.qty)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <div className="confirm-actions">
        <a href={whatsapp} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
          Message us on WhatsApp
        </a>
        <Link to="/orders" className="btn btn-secondary">
          All my orders
        </Link>
        <Link to="/shop" className="btn btn-ghost">
          Keep shopping
        </Link>
      </div>

      <p className="muted small">
        Quote order {order.id} in any message. Questions go to{' '}
        <a href={`mailto:${STORE.email}`}>{STORE.email}</a>.
      </p>
    </div>
  );
}
