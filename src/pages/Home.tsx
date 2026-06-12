import { Link } from 'react-router-dom';
import { GRADE_LIST } from '../data/grades';
import { discountPct, formatINR, productTitle } from '../data/products';
import { useStore } from '../store/context';
import ProductCard from '../components/ProductCard';
import ProductImage from '../components/ProductImage';
import GradeBadge from '../components/GradeBadge';

const BRAND_TILES = [
  { label: 'iPhone', sub: 'Apple, all grades', emoji: '', to: '/shop?brand=Apple', tone: '#1d2230' },
  { label: 'Samsung', sub: 'Galaxy S, A & M series', emoji: '🌌', to: '/shop?brand=Samsung', tone: '#12239e' },
  { label: 'Pixel', sub: 'Google camera magic', emoji: '📸', to: '/shop?brand=Google', tone: '#0f7d52' },
  { label: 'Nothing', sub: 'Glyph done different', emoji: '⚪', to: '/shop?brand=Nothing', tone: '#26282d' },
  { label: 'Other Androids', sub: 'OnePlus, Redmi, Moto…', emoji: '🤖', to: '/shop?brand=other', tone: '#7a3ba6' },
  { label: 'Accessories', sub: 'Chargers, cases, glass', emoji: '🔌', to: '/shop?category=accessory', tone: '#b4540a' },
];

export default function Home() {
  const { products } = useStore();

  const deals = [...products]
    .filter((p) => p.stock > 0 && p.category !== 'accessory')
    .sort((a, b) => discountPct(b) - discountPct(a))
    .slice(0, 8);

  const topRated = [...products]
    .filter((p) => p.category !== 'accessory' && p.stock > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);

  return (
    <div className="container">
      <section className="hero">
        <div className="hero-text">
          <h1>Certified refurbished. <span className="hero-accent">Up to 65% off.</span></h1>
          <p>
            Every phone passes a 32-point quality check, carries a real warranty,
            and is graded honestly — from "like new" to "needs repair".
          </p>
          <div className="hero-actions">
            <Link to="/shop?deals=1" className="btn btn-buy btn-lg">See Today's Deals</Link>
            <Link to="/shop" className="btn btn-ghost btn-lg">Browse All Phones</Link>
          </div>
        </div>
        <div className="hero-strip">
          <span>🔍 32-Point Check</span>
          <span>🛡️ Warranty on Every Grade</span>
          <span>↩️ 15-Day Money-Back</span>
          <span>🎥 Watch Before You Buy</span>
        </div>
      </section>

      <section className="deal-section">
        <div className="section-head">
          <h2>🔥 Today's Deals</h2>
          <Link to="/shop?deals=1">See all deals →</Link>
        </div>
        <div className="deal-row">
          {deals.map((p) => (
            <Link key={p.id} to={`/product/${p.id}`} className="deal-card">
              <div className="deal-img"><ProductImage product={p} /></div>
              <span className="deal-flag">{discountPct(p)}% off</span>
              <GradeBadge grade={p.grade} />
              <span className="deal-title">{productTitle(p)}</span>
              <span className="deal-price">{formatINR(p.price)} <s>{formatINR(p.mrp)}</s></span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Shop by Brand</h2>
        </div>
        <div className="brand-grid">
          {BRAND_TILES.map((b) => (
            <Link key={b.label} to={b.to} className="brand-tile" style={{ ['--tone' as string]: b.tone }}>
              <span className="brand-emoji">{b.emoji}</span>
              <strong>{b.label}</strong>
              <span className="brand-sub">{b.sub}</span>
              <span className="brand-cta">Shop now →</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Shop by Grade</h2>
          <span className="muted">Grade A is pristine. Grade E is honest about repairs needed.</span>
        </div>
        <div className="grade-grid">
          {GRADE_LIST.map((g) => (
            <Link key={g.grade} to={`/shop?grade=${g.grade}`} className="grade-card" style={{ borderTopColor: g.color }}>
              <span className="grade-badge" style={{ backgroundColor: g.color }}>Grade {g.grade}</span>
              <h3>{g.label}</h3>
              <p>{g.name}</p>
              <ul>
                <li>{g.discountRange}</li>
                <li>{g.warrantyNote}</li>
              </ul>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>⭐ Highest Rated</h2>
          <Link to="/shop">Browse all →</Link>
        </div>
        <div className="product-grid">
          {topRated.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="trust-section">
        <h2>Why buy from us?</h2>
        <div className="trust-grid">
          <div>
            <h3>🔍 32-Point Quality Check</h3>
            <p>Every phone is tested across display, battery, camera, audio, hardware, software, thermal and integrity checks before listing.</p>
          </div>
          <div>
            <h3>🎥 Watch Before You Buy</h3>
            <p>Most listings include a video of the actual phone — turning on, display, camera and physical condition. No surprises.</p>
          </div>
          <div>
            <h3>🛡️ Warranty at Every Grade</h3>
            <p>From 12 months on Grade A to a 1-month repair warranty even on Grade E. Plus a 15-day money-back guarantee on all phones.</p>
          </div>
          <div>
            <h3>🏠 Local Trust</h3>
            <p>We're Bongaigaon's own Budget Phone Store. Visit us in person, or order online with original invoice and IMEI verification.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
