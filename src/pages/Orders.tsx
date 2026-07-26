import { Link } from 'react-router-dom';
import { CONDITIONS } from '../data/conditions';
import { inr, longDate, relativeMonths } from '../lib/format';
import { STORE } from '../config';
import { useStore } from '../store/context';

export default function Orders() {
  const { orders, photoRequests } = useStore();

  if (orders.length === 0 && photoRequests.length === 0) {
    return (
      <div className="container">
        <div className="empty">
          <h1>No orders yet</h1>
          <p className="muted">
            Orders are kept in this browser. If you ordered from another device, quote your order reference to
            us on WhatsApp and we will look it up.
          </p>
          <Link to="/shop" className="btn btn-primary">
            Browse phones
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="page-head">
        <h1>My orders</h1>
        <p className="muted">
          Stored in this browser only. Quote the order reference when you contact us at {STORE.email}.
        </p>
      </header>

      {orders.map((order) => (
        <article key={order.id} className="order-card">
          <header className="order-head">
            <div>
              <h2>{order.id}</h2>
              <p className="muted small">
                {longDate(order.date)} · {order.items.length} item{order.items.length === 1 ? '' : 's'} ·{' '}
                {order.paymentMode === 'cod' ? 'Cash on delivery' : 'Paid in full'}
              </p>
            </div>
            <div className="order-head-right">
              <strong>{inr(order.totals.total)}</strong>
              <span className={`status status-${order.status}`}>{order.status}</span>
            </div>
          </header>

          {order.paymentMode === 'cod' && order.totals.balanceDue > 0 && (
            <p className="note">
              {inr(order.totals.payNow)} paid online as the booking charge. Keep{' '}
              <strong>{inr(order.totals.balanceDue)}</strong> in cash ready for the courier.
            </p>
          )}

          <ul className="warranty-list">
            {order.items.map((item) => {
              const warranty = relativeMonths(order.date, item.warrantyMonths);
              return (
                <li key={item.listingId}>
                  <div>
                    <strong>{item.title}</strong>
                    <p className="muted small">
                      {CONDITIONS[item.condition].name} · unit {item.unitRef}
                    </p>
                  </div>
                  <div className={`warranty${warranty.expired ? ' is-expired' : ''}`}>
                    <span>{item.warrantyMonths}-month warranty</span>
                    <small>{warranty.label}</small>
                  </div>
                </li>
              );
            })}
          </ul>

          <Link to={`/order/${encodeURIComponent(order.id)}`} className="link-arrow">
            Order details
          </Link>
        </article>
      ))}

      {photoRequests.length > 0 && (
        <section className="section-block">
          <h2>Photo requests</h2>
          <p className="muted">
            Handsets you have asked us to photograph. Replies come to the WhatsApp number you gave.
          </p>
          <ul className="request-list">
            {photoRequests.map((request) => (
              <li key={request.id}>
                <div>
                  <strong>{request.title}</strong>
                  <p className="muted small">
                    Unit {request.unitRef} · requested {longDate(request.at)}
                  </p>
                </div>
                <Link to={`/phone/${request.listingId.split('--')[0]}`} className="link-arrow">
                  View phone
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
