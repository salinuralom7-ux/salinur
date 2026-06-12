import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catIco, catLabel, inr, type Review, type Vendor } from '../types';
import { createQuotation, getVendor, listReviews } from '../lib/api';
import { useSession } from '../sessionContext';

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [city, setCity] = useState('');
  const [requirements, setRequirements] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([getVendor(id), listReviews(id)])
      .then(([v, r]) => { setVendor(v); setReviews(r); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="container empty"><p>Loading…</p></div>;
  if (!vendor || vendor.status !== 'approved') {
    return (
      <div className="container empty">
        <p>Vendor not found or not yet approved.</p>
        <Link to="/vendors" className="btn btn-maroon">Browse vendors</Link>
      </div>
    );
  }

  const submit = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!eventDate || !city.trim()) { setError('Pick the event date and city'); return; }
    setBusy(true); setError('');
    try {
      await createQuotation(user, vendor, { eventDate, city: city.trim(), requirements: requirements.trim() });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <nav className="breadcrumb"><Link to="/vendors">← All vendors</Link></nav>
      <div className="vd-head card">
        <div className="vendor-avatar big">{vendor.photos[0] ? <img src={vendor.photos[0]} alt="" /> : catIco(vendor.category)}</div>
        <div>
          <h1>{vendor.businessName}</h1>
          <p className="muted">{catLabel(vendor.category)} · 📍 {vendor.city}</p>
          <p className="stars">
            {'★'.repeat(Math.round(vendor.rating))}{'☆'.repeat(5 - Math.round(vendor.rating))}
            <em> {vendor.rating > 0 ? `${vendor.rating} · ${vendor.reviewCount} verified reviews` : 'New on ShaadiSetu'}</em>
          </p>
          <p>{vendor.bio}</p>
        </div>
      </div>

      {vendor.photos.length > 1 && (
        <div className="card">
          <h2>Portfolio</h2>
          <div className="photo-strip">
            {vendor.photos.map((src, i) => <img key={i} src={src} alt={`Work ${i + 1}`} />)}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Packages</h2>
        {vendor.packages.map((p, i) => (
          <div key={i} className="package-row"><span>{p.title}</span><strong>{inr(p.price)}</strong></div>
        ))}
        <p className="muted">Final price comes as a personal quote for your date and requirements.</p>
        {!sent ? (
          !showForm ? (
            <button
              className="btn btn-gold btn-lg btn-block"
              onClick={() => (user ? setShowForm(true) : navigate('/auth'))}
            >
              {user ? 'Request a Quote — Free' : 'Sign in to Request a Quote'}
            </button>
          ) : (
            <div className="quote-form">
              <label>Event date<input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} /></label>
              <label>Event city<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Bongaigaon" /></label>
              <label>What do you need?
                <textarea rows={3} value={requirements} onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Guests, ceremonies to cover, style preferences…" />
              </label>
              <button className="btn btn-maroon btn-lg btn-block" disabled={busy} onClick={submit}>
                {busy ? 'Sending…' : 'Send Request'}
              </button>
              {error && <p className="err">{error}</p>}
            </div>
          )
        ) : (
          <div className="ok-box">
            ✅ Request sent! {vendor.businessName} has been notified and will reply with a price.
            Track it in <Link to="/my">My Wedding</Link>.
          </div>
        )}
      </div>

      <div className="card">
        <h2>Reviews</h2>
        {reviews.length === 0 ? (
          <p className="muted">No reviews yet. Reviews can only be written after a completed booking — so every star here is real.</p>
        ) : reviews.map((r) => (
          <div key={r.id} className="review-row">
            <span className="stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
            <strong> {r.customerName}</strong> <span className="verified">✔ verified booking</span>
            <p>{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
