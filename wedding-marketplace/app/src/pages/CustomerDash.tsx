import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { catIco, inr, type Booking, type Quotation } from '../types';
import { acceptQuote, listBookings, listQuotations, submitReview } from '../lib/api';
import { useSession } from '../sessionContext';
import ChatPanel from '../components/ChatPanel';

export default function CustomerDash() {
  const { user } = useSession();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  const refresh = useCallback(() => {
    if (!user) return;
    void listQuotations(user).then(setQuotes).catch((e) => setError(String(e.message ?? e)));
    void listBookings(user).then(setBookings).catch(() => {});
  }, [user]);

  useEffect(refresh, [refresh]);

  if (!user) return null;

  const accept = async (q: Quotation) => {
    setBusy(q.id); setError('');
    try {
      await acceptQuote(q.id);
      setNotice(`Booking created with ${q.vendorName}! Pay the booking advance to lock your date (instructions below).`);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy('');
    }
  };

  const sendReview = async (bookingId: string) => {
    setBusy(bookingId); setError('');
    try {
      await submitReview(user, bookingId, rating, reviewText);
      setReviewFor(null); setReviewText('');
      setNotice('Review posted — thank you! It will show on the vendor profile.');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy('');
    }
  };

  const statusLabel: Record<string, string> = {
    open: '🕐 Waiting for quote', quoted: '💸 Quote received', accepted: '✅ Accepted', declined: '✖ Declined',
    advance_pending: '⏳ Advance pending', confirmed: '🔒 Confirmed', completed: '🎉 Completed', cancelled: '✖ Cancelled',
  };

  return (
    <div className="container">
      <h1>My Wedding</h1>
      {notice && <p className="ok-box">{notice}</p>}
      {error && <p className="err">{error}</p>}

      <h2>My bookings</h2>
      {bookings.length === 0 ? (
        <p className="muted">No bookings yet — accept a vendor's quote to create one.</p>
      ) : bookings.map((b) => (
        <div key={b.id} className="card">
          <div className="row-head">
            <strong>{catIco(b.category)} {b.vendorName}</strong>
            <span className="status">{statusLabel[b.status]}</span>
          </div>
          <p className="muted">{b.eventDate} · {inr(b.amount)}</p>
          {b.status === 'advance_pending' && (
            <div className="pay-box">
              <strong>Lock your date — pay the booking advance ({inr(Math.round(b.amount * 0.2))}, 20%)</strong>
              <p className="muted">
                Pay by UPI to <strong>shaadisetu@upi</strong> with note <strong>{b.id.slice(0, 8).toUpperCase()}</strong>,
                or in cash at our Bongaigaon office. We confirm within a few hours and your date is locked.
                Online payment (Razorpay) is coming soon.
              </p>
            </div>
          )}
          {b.status === 'completed' && (
            reviewFor === b.id ? (
              <div className="quote-form">
                <label>Rating
                  <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
                  </select>
                </label>
                <label>Your review
                  <textarea rows={3} value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
                </label>
                <button className="btn btn-gold" disabled={busy === b.id} onClick={() => void sendReview(b.id)}>Post Review</button>
              </div>
            ) : (
              <button className="btn btn-line" onClick={() => setReviewFor(b.id)}>⭐ Write a review</button>
            )
          )}
        </div>
      ))}

      <h2>My quote requests</h2>
      {quotes.length === 0 ? (
        <p className="muted">
          No requests yet. <Link to="/vendors">Browse vendors</Link> and ask for quotes — it's free.
        </p>
      ) : quotes.map((q) => (
        <div key={q.id} className="card">
          <div className="row-head">
            <strong>{catIco(q.category)} {q.vendorName}</strong>
            <span className="status">{statusLabel[q.status]}</span>
          </div>
          <p className="muted">{q.eventDate} · {q.city} · “{q.requirements}”</p>
          {q.status === 'quoted' && (
            <div className="pay-box">
              <div className="row-head"><span>Vendor's quote</span><strong>{inr(q.price!)}</strong></div>
              {q.note && <p className="muted">“{q.note}”</p>}
              <button className="btn btn-gold btn-lg" disabled={busy === q.id} onClick={() => void accept(q)}>
                {busy === q.id ? 'Creating booking…' : 'Accept Quote & Book'}
              </button>
            </div>
          )}
          <button className="link-btn" onClick={() => setOpenChat(openChat === q.id ? null : q.id)}>
            💬 {openChat === q.id ? 'Hide chat' : 'Chat with vendor'}
          </button>
          {openChat === q.id && <ChatPanel quotationId={q.id} user={user} />}
        </div>
      ))}
    </div>
  );
}
