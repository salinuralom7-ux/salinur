import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { discountPct, formatINR, productTitle } from '../data/products';
import { stockAt, whatsappLink } from '../data/branches';
import { GRADES, QUALITY_CHECKS } from '../data/grades';
import { api } from '../lib/api';
import type { Review } from '../types';
import { useStore } from '../store/context';
import { useData } from '../store/dataContext';
import GradeBadge from '../components/GradeBadge';
import PhoneImage from '../components/PhoneImage';
import Stars from '../components/Stars';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, wishlist, branchId, branch } = useStore();
  const { products, branches, productById } = useData();
  const [showChecks, setShowChecks] = useState(false);
  const [showGrade, setShowGrade] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let active = true;
    if (id) api.reviews(id).then((r) => active && setReviews(r)).catch(() => active && setReviews([]));
    return () => {
      active = false;
    };
  }, [id]);

  const product = productById(id);
  if (!product) {
    return (
      <div className="container">
        <p>Product not found.</p>
        <Link to="/shop" className="btn btn-primary">Back to Shop</Link>
      </div>
    );
  }

  const grade = GRADES[product.grade];
  const similar = products.filter(
    (p) => p.id !== product.id && p.category === product.category && stockAt(p, branchId) > 0,
  ).slice(0, 3);
  const gradeUp = products.find(
    (p) => p.model === product.model && p.grade < product.grade && stockAt(p, branchId) > 0,
  );
  const stock = stockAt(product, branchId);
  const out = stock === 0;
  const distribution = product.branchStock ?? {};

  const buyNow = () => {
    addToCart(product.id);
    navigate('/cart');
  };

  return (
    <div className="container">
      <nav className="breadcrumb">
        <Link to="/">Home</Link> / <Link to="/shop">Shop</Link> / {product.model}
      </nav>

      <div className="detail-layout">
        <div className="detail-gallery">
          <PhoneImage product={product} large />
          {product.hasVideo && (
            <div className="video-placeholder">
              ▶ Dekho Aur Khareedo — 45-sec video of this exact unit
              <small>(Video player will appear here once unit videos are uploaded)</small>
            </div>
          )}
        </div>

        <div className="detail-info">
          <GradeBadge grade={product.grade} full />
          <h1>{productTitle(product)}</h1>
          <Stars rating={product.rating} count={product.reviewCount} />

          <div className="price-block">
            <span className="price-big">{formatINR(product.price)}</span>
            <span className="mrp">MRP {formatINR(product.mrp)}</span>
            <span className="discount-big">{discountPct(product)}% off</span>
            <div className="savings">You save {formatINR(product.mrp - product.price)}</div>
          </div>

          {stock > 0 && stock <= 3 && (
            <div className="stock-warn">Only {stock} left{branch ? ` at ${branch.city}` : ''}</div>
          )}
          {out && (
            <div className="stock-out">
              Out of stock{branch ? ` at ${branch.city}` : ''} — check availability at other branches below
            </div>
          )}

          <div className="branch-availability">
            <h4>📍 Availability by branch</h4>
            <ul>
              {branches.map((b) => {
                const n = distribution[b.id] ?? 0;
                return (
                  <li key={b.id} className={branchId === b.id ? 'active' : ''}>
                    <span className="ba-city">{b.city}</span>
                    <span className={`ba-stock ${n === 0 ? 'zero' : ''}`}>
                      {n === 0 ? 'Out of stock' : n <= 3 ? `${n} in stock` : 'In stock'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {product.grade === 'E' && (
            <div className="grade-e-alert">
              ⚠️ This phone <strong>needs repair before use</strong>. Read the condition notes carefully —
              you'll be asked to confirm you understand this at checkout.
            </div>
          )}

          <div className="trust-badges">
            <span>🔍 32-Point Quality Check Certified</span>
            <span>🛡️ {grade.warrantyNote}</span>
            <span>↩️ 15-Day Money-Back Guarantee</span>
            <span>🚚 Free shipping</span>
          </div>

          <div className="detail-actions">
            <button className="btn btn-primary btn-lg" disabled={out} onClick={() => addToCart(product.id)}>
              Add to Cart
            </button>
            <button className="btn btn-buy btn-lg" disabled={out} onClick={buyNow}>
              Buy Now
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => toggleWishlist(product.id)}>
              {wishlist.includes(product.id) ? '♥ Wishlisted' : '♡ Wishlist'}
            </button>
          </div>

          {branch && (
            <a
              className="btn btn-whatsapp btn-lg btn-block"
              href={whatsappLink(
                branch,
                out
                  ? `Hi ${branch.name}, is the ${productTitle(product)} (Grade ${product.grade}) available, or coming back in stock?`
                  : `Hi ${branch.name}, I'd like to reserve the ${productTitle(product)} (Grade ${product.grade}) at ${formatINR(product.price)}.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              💬 {out ? 'Enquire on WhatsApp' : `Reserve at ${branch.city} on WhatsApp`}
            </a>
          )}

          {gradeUp && (
            <div className="grade-up">
              💡 Grade up option: this model is also available in{' '}
              <Link to={`/product/${gradeUp.id}`}>
                Grade {gradeUp.grade} at {formatINR(gradeUp.price)}
              </Link>
            </div>
          )}
        </div>
      </div>

      <section className="detail-section">
        <button className="expander" onClick={() => setShowGrade(!showGrade)}>
          {showGrade ? '▾' : '▸'} Grade {product.grade}: {grade.name}
        </button>
        {showGrade && (
          <div className="expander-body">
            <p>{grade.description}</p>
            <ul>
              {grade.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
            <table className="kv-table">
              <tbody>
                {product.batteryHealth !== undefined && (
                  <tr><th>Battery health</th><td>{product.batteryHealth}%</td></tr>
                )}
                <tr><th>Condition notes</th><td>{product.conditionNotes}</td></tr>
                {product.repairs && <tr><th>Repair history</th><td>{product.repairs}</td></tr>}
                <tr>
                  <th>What's included</th>
                  <td>{product.accessories.length > 0 ? product.accessories.join(', ') : 'Phone only — no accessories'}</td>
                </tr>
                <tr><th>Warranty</th><td>{grade.warrantyNote} + 15-day money-back guarantee</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="detail-section">
        <h2>Specifications</h2>
        <table className="kv-table">
          <tbody>
            {Object.entries(product.specs).map(([k, v]) => (
              <tr key={k}><th>{k}</th><td>{v}</td></tr>
            ))}
            {product.ram && <tr><th>RAM</th><td>{product.ram}</td></tr>}
            {product.storage && <tr><th>Storage</th><td>{product.storage}</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="detail-section">
        <button className="expander" onClick={() => setShowChecks(!showChecks)}>
          {showChecks ? '▾' : '▸'} 32-Point Quality Check — inspected at Phone Factory{branch ? `, ${branch.city}` : ''}
        </button>
        {showChecks && (
          <div className="expander-body check-grid">
            {QUALITY_CHECKS.map((area) => (
              <div key={area.area}>
                <h4>{area.area}</h4>
                <ul>
                  {area.items.map((item) => (
                    <li key={item}>✓ {item}</li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="muted">
              IMEI verification and original invoice (soft + physical copy) provided with every phone.
            </p>
          </div>
        )}
      </section>

      <section className="detail-section">
        <h2>Ratings &amp; Reviews</h2>
        {reviews.length === 0 ? (
          <p className="muted">No reviews yet for this listing. Reviews from verified buyers appear here.</p>
        ) : (
          <div className="reviews">
            {reviews.map((r, i) => (
              <div key={i} className="review">
                <div className="review-head">
                  <Stars rating={r.rating} />
                  <strong>{r.author}</strong>
                  {r.verified && <span className="verified">✔ Verified Purchase</span>}
                  <span className="muted">{r.date}</span>
                </div>
                <p>{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {similar.length > 0 && (
        <section className="detail-section">
          <h2>Similar products</h2>
          <div className="similar-row">
            {similar.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="similar-card">
                <PhoneImage product={p} />
                <GradeBadge grade={p.grade} />
                <span>{productTitle(p)}</span>
                <strong>{formatINR(p.price)}</strong>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
