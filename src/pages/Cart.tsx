import { Link } from 'react-router-dom';
import { CONDITIONS } from '../data/conditions';
import { formatStorage, getListing } from '../lib/inventory';
import { computeTotals } from '../lib/pricing';
import { inr } from '../lib/format';
import { POLICY } from '../config';
import { useStore } from '../store/context';
import PhoneRender from '../components/PhoneRender';

export default function Cart() {
  const { cart, setQty, removeFromCart, toggleWishlist } = useStore();

  const lines = cart.flatMap((item) => {
    const listing = getListing(item.listingId);
    return listing ? [{ item, listing }] : [];
  });

  if (lines.length === 0) {
    return (
      <div className="container">
        <div className="empty">
          <h1>Your cart is empty</h1>
          <p className="muted">Nothing here yet. There are phones from ₹4,900 on the shelf.</p>
          <Link to="/shop" className="btn btn-primary">
            Browse phones
          </Link>
        </div>
      </div>
    );
  }

  const totals = computeTotals({ items: cart, shippingMethod: 'standard', paymentMode: 'prepaid' });

  return (
    <div className="container cart">
      <header className="page-head">
        <h1>Your cart</h1>
        <p className="muted">
          {lines.length} item{lines.length === 1 ? '' : 's'}. Each one is a specific handset held for you.
        </p>
      </header>

      <div className="cart-layout">
        <div className="cart-lines">
          {lines.map(({ item, listing }) => (
            <article key={listing.id} className="cart-line">
              <Link to={`/phone/${listing.modelId}`} className="cart-line-media">
                <PhoneRender listing={listing} size="sm" />
              </Link>

              <div className="cart-line-body">
                <h2>
                  <Link to={`/phone/${listing.modelId}`}>{listing.model}</Link>
                </h2>
                <p className="muted small">
                  {formatStorage(listing.storageGb)} · {listing.color.name} ·{' '}
                  <span style={{ color: CONDITIONS[listing.condition].color }}>
                    {CONDITIONS[listing.condition].name}
                  </span>
                </p>
                <p className="muted small">
                  Unit {listing.unitRef} · battery {listing.batteryHealth}% · {listing.warrantyMonths}-month
                  warranty
                </p>

                {listing.stock <= 2 && (
                  <p className="stock-warning">
                    Only {listing.stock} left in this exact configuration
                  </p>
                )}

                <div className="cart-line-actions">
                  <div className="qty">
                    <button
                      type="button"
                      onClick={() => setQty(listing.id, item.qty - 1)}
                      aria-label="Reduce quantity"
                    >
                      −
                    </button>
                    <span aria-live="polite">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(listing.id, item.qty + 1)}
                      disabled={item.qty >= listing.stock}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <button type="button" className="link-btn" onClick={() => toggleWishlist(listing.id)}>
                    Save for later
                  </button>
                  <button type="button" className="link-btn danger" onClick={() => removeFromCart(listing.id)}>
                    Remove
                  </button>
                </div>
              </div>

              <div className="cart-line-price">
                <strong>{inr(listing.price * item.qty)}</strong>
                {item.qty > 1 && <span className="muted small">{inr(listing.price)} each</span>}
                <span className="mrp">{inr(listing.mrp * item.qty)}</span>
              </div>
            </article>
          ))}
        </div>

        <aside className="summary">
          <h2>Summary</h2>
          <dl className="summary-lines">
            <div>
              <dt>Subtotal</dt>
              <dd>{inr(totals.subtotal)}</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>{totals.shipping === 0 ? 'Free' : inr(totals.shipping)}</dd>
            </div>
            <div className="summary-total">
              <dt>Total</dt>
              <dd>{inr(totals.total)}</dd>
            </div>
          </dl>

          <p className="muted small">
            Choosing cash on delivery? You will pay a booking charge of {inr(totals.minBooking)} online — a
            tenth of the total — and {inr(totals.total - totals.minBooking)} to the courier.
          </p>

          <Link to="/checkout" className="btn btn-primary btn-block btn-lg">
            Checkout
          </Link>
          <Link to="/shop" className="btn btn-ghost btn-block">
            Keep shopping
          </Link>

          <ul className="assurance">
            <li>Free delivery above {inr(POLICY.freeShippingAbove)}</li>
            <li>{POLICY.inspectionWindowMinutes} minutes to check it at your door</li>
            <li>{POLICY.returnWindowDays}-day return if it does not match the listing</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
