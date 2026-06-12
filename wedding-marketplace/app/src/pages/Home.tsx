import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, type Vendor } from '../types';
import { listApprovedVendors } from '../lib/api';
import VendorCard from '../components/VendorCard';

export default function Home() {
  const [top, setTop] = useState<Vendor[]>([]);

  useEffect(() => {
    listApprovedVendors().then((v) => setTop(v.slice(0, 4))).catch(() => setTop([]));
  }, []);

  return (
    <div className="container">
      <section className="hero">
        <div className="hero-text">
          <h1>Plan your wedding with <span>verified local vendors</span></h1>
          <p>
            Photographers, caterers, decorators and more across Assam &amp; the Northeast.
            Compare real quotes, chat directly, and book with protection.
          </p>
          <div className="hero-actions">
            <Link to="/vendors" className="btn btn-gold btn-lg">Find Vendors</Link>
            <Link to="/auth?role=vendor" className="btn btn-ghost btn-lg">List Your Business — Free</Link>
          </div>
        </div>
        <div className="hero-strip">
          <span>✅ Every vendor verified</span>
          <span>💬 Chat before you book</span>
          <span>🛡️ Booking protection</span>
          <span>⭐ Reviews from real bookings only</span>
        </div>
      </section>

      <section>
        <h2>Browse by category</h2>
        <div className="cat-grid">
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/vendors?category=${c.id}`} className="cat-tile">
              <span className="ico">{c.ico}</span>{c.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Top rated vendors</h2>
          <Link to="/vendors">See all →</Link>
        </div>
        <div className="vendor-grid">
          {top.map((v) => <VendorCard key={v.id} vendor={v} />)}
        </div>
      </section>

      <section className="how">
        <h2>How it works</h2>
        <div className="how-grid">
          <div><span className="step">1</span><h3>Request quotes</h3><p>Tell vendors your date, city and needs — free, no obligation.</p></div>
          <div><span className="step">2</span><h3>Compare &amp; chat</h3><p>Vendors reply with real prices. Chat to finalise the details.</p></div>
          <div><span className="step">3</span><h3>Book with protection</h3><p>Pay the booking advance through ShaadiSetu — your date is locked and protected.</p></div>
        </div>
      </section>
    </div>
  );
}
