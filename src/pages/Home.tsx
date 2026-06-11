import { Link } from 'react-router-dom';
import { GRADE_LIST } from '../data/grades';
import { PRODUCTS } from '../data/products';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const featured = [...PRODUCTS]
    .filter((p) => p.category !== 'accessory' && p.stock > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);

  return (
    <div className="container">
      <section className="hero">
        <h1>Buy Refurbished Phones. Save 40–65%. Same Quality Guarantee.</h1>
        <p className="hero-badges">
          ✅ 32-Point Quality Check &nbsp;|&nbsp; ✅ Warranty on Every Grade &nbsp;|&nbsp; ✅ 15-Day
          Money-Back &nbsp;|&nbsp; ✅ Watch Before You Buy
        </p>
        <div className="hero-actions">
          <Link to="/shop" className="btn btn-primary btn-lg">Shop All Phones</Link>
          <Link to="/shop?category=accessory" className="btn btn-outline btn-lg">Accessories</Link>
        </div>
        <p className="hero-trust">2,000+ happy customers · 98% positive reviews · 300+ phones sold in 6 months</p>
      </section>

      <section>
        <h2>Shop by Grade</h2>
        <p className="muted">
          Each grade is transparent. Grade A is pristine. Grade E is honest about repairs needed.
          Choose what fits your budget and trust level.
        </p>
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
        <h2>Featured Deals</h2>
        <div className="product-grid">
          {featured.map((p) => (
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
