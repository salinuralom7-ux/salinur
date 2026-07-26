import { Link } from 'react-router-dom';
import { CONDITIONS } from '../data/conditions';
import { formatStorage, getListing } from '../lib/inventory';
import { inr } from '../lib/format';
import { useStore } from '../store/context';
import PhoneRender from '../components/PhoneRender';

export default function Wishlist() {
  const { wishlist, toggleWishlist, addToCart } = useStore();

  const saved = wishlist.flatMap((id) => {
    const listing = getListing(id);
    return listing ? [listing] : [];
  });

  if (saved.length === 0) {
    return (
      <div className="container">
        <div className="empty">
          <h1>Nothing saved yet</h1>
          <p className="muted">
            Tap the heart on any phone to keep it here while you decide. Saved handsets are held in this
            browser, and stock can move quickly.
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
        <h1>Saved phones</h1>
        <p className="muted">
          {saved.length} handset{saved.length === 1 ? '' : 's'}. Each is a specific unit — if it sells, it
          disappears from here.
        </p>
      </header>

      <div className="cart-lines">
        {saved.map((listing) => (
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
                Unit {listing.unitRef} · battery {listing.batteryHealth}% · {listing.stock} in stock
              </p>

              <div className="cart-line-actions">
                <button type="button" className="btn btn-secondary" onClick={() => addToCart(listing.id)}>
                  Add to cart
                </button>
                <button type="button" className="link-btn danger" onClick={() => toggleWishlist(listing.id)}>
                  Remove
                </button>
              </div>
            </div>

            <div className="cart-line-price">
              <strong>{inr(listing.price)}</strong>
              <span className="mrp">{inr(listing.mrp)}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
