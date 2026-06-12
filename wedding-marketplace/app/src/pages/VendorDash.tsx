import { useCallback, useEffect, useState } from 'react';
import {
  CATEGORIES, catIco, inr,
  type Booking, type Category, type Quotation, type Vendor, type VendorPackage,
} from '../types';
import { getVendor, listBookings, listQuotations, saveVendorProfile, sendQuote, declineQuote, setBookingStatus } from '../lib/api';
import { useSession } from '../sessionContext';
import ChatPanel from '../components/ChatPanel';

type Tab = 'leads' | 'bookings' | 'profile';

export default function VendorDash() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>('leads');
  const [vendor, setVendor] = useState<Vendor | null | 'loading'>('loading');
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [priceInput, setPriceInput] = useState<Record<string, string>>({});
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    if (!user) return;
    void getVendor(user.id).then(setVendor);
    void listQuotations(user).then(setQuotes).catch(() => {});
    void listBookings(user).then(setBookings).catch(() => {});
  }, [user]);

  useEffect(refresh, [refresh]);

  if (!user) return null;
  if (vendor === 'loading') return <div className="container empty"><p>Loading…</p></div>;

  // No profile yet → onboarding form first.
  if (!vendor) {
    return (
      <div className="container">
        <h1>Welcome! Set up your vendor profile</h1>
        <p className="muted">Your listing goes live after a quick review by the ShaadiSetu team (usually same day).</p>
        <ProfileForm
          initial={null}
          onSaved={() => { setNotice('Profile submitted for approval!'); refresh(); }}
        />
      </div>
    );
  }

  const quote = async (q: Quotation) => {
    setBusy(q.id); setError('');
    try {
      await sendQuote(q.id, Number(priceInput[q.id] ?? 0), noteInput[q.id] ?? '');
      setNotice('Quote sent — the customer has been notified.');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy('');
    }
  };

  const earnings = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((s, b) => s + b.vendorPayout, 0);
  const newLeads = quotes.filter((q) => q.status === 'open').length;

  return (
    <div className="container">
      <div className="row-head">
        <h1>Vendor Dashboard</h1>
        <span className={`status ${vendor.status === 'approved' ? 'ok' : ''}`}>
          {vendor.status === 'approved' ? '✅ Live on ShaadiSetu' : vendor.status === 'pending' ? '🕐 Awaiting approval' : '⛔ Suspended'}
        </span>
      </div>
      {notice && <p className="ok-box">{notice}</p>}
      {error && <p className="err">{error}</p>}

      <div className="stat-row">
        <div className="stat"><strong>{newLeads}</strong><span>new leads</span></div>
        <div className="stat"><strong>{bookings.length}</strong><span>bookings</span></div>
        <div className="stat"><strong>{inr(earnings)}</strong><span>earnings (after 15% fee)</span></div>
        <div className="stat"><strong>{vendor.rating > 0 ? vendor.rating : '—'}</strong><span>rating ({vendor.reviewCount})</span></div>
      </div>

      <div className="tabs-row">
        <button className={tab === 'leads' ? 'active' : ''} onClick={() => setTab('leads')}>📨 Leads {newLeads > 0 && <span className="dot">{newLeads}</span>}</button>
        <button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}>📅 Bookings</button>
        <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>👤 Profile</button>
      </div>

      {tab === 'leads' && (
        quotes.length === 0 ? <p className="muted">No leads yet. Approved profiles with photos and clear packages get the most enquiries.</p>
        : quotes.map((q) => (
          <div key={q.id} className="card">
            <div className="row-head">
              <strong>{q.customerName}</strong>
              <span className="status">{q.status === 'open' ? '🆕 NEW' : q.status.toUpperCase()}</span>
            </div>
            <p className="muted">{q.eventDate} · {q.city}</p>
            <p>“{q.requirements}”</p>
            {q.status === 'open' && (
              <div className="quote-form">
                <label>Your price (₹)
                  <input type="number" min={100} value={priceInput[q.id] ?? ''}
                    onChange={(e) => setPriceInput({ ...priceInput, [q.id]: e.target.value })} />
                </label>
                <label>Note (what's included)
                  <input value={noteInput[q.id] ?? ''}
                    onChange={(e) => setNoteInput({ ...noteInput, [q.id]: e.target.value })} />
                </label>
                <div className="btn-row">
                  <button className="btn btn-gold" disabled={busy === q.id} onClick={() => void quote(q)}>Send Quote</button>
                  <button className="btn btn-line" onClick={() => void declineQuote(q.id).then(refresh)}>Decline</button>
                </div>
              </div>
            )}
            {q.status === 'quoted' && <p className="muted">You quoted <strong>{inr(q.price!)}</strong> — waiting for the customer.</p>}
            <button className="link-btn" onClick={() => setOpenChat(openChat === q.id ? null : q.id)}>
              💬 {openChat === q.id ? 'Hide chat' : 'Chat with customer'}
            </button>
            {openChat === q.id && <ChatPanel quotationId={q.id} user={user} />}
          </div>
        ))
      )}

      {tab === 'bookings' && (
        bookings.length === 0 ? <p className="muted">No bookings yet.</p>
        : bookings.map((b) => (
          <div key={b.id} className="card">
            <div className="row-head">
              <strong>{catIco(b.category)} {b.customerName}</strong>
              <span className="status">{b.status.replace('_', ' ').toUpperCase()}</span>
            </div>
            <p className="muted">{b.eventDate}</p>
            <div className="pay-box">
              <div className="row-head"><span>Customer pays</span><span>{inr(b.amount)}</span></div>
              <div className="row-head"><span>Platform fee ({Math.round(b.commissionRate * 100)}%)</span><span>− {inr(b.commission)}</span></div>
              <div className="row-head total"><span>Your payout</span><strong>{inr(b.vendorPayout)}</strong></div>
            </div>
            {b.status === 'confirmed' && (
              <button className="btn btn-line" onClick={() => void setBookingStatus(b.id, 'completed').then(refresh)}>
                Mark event completed
              </button>
            )}
          </div>
        ))
      )}

      {tab === 'profile' && (
        <ProfileForm initial={vendor} onSaved={() => { setNotice('Profile updated.'); refresh(); }} />
      )}
    </div>
  );
}

function ProfileForm({ initial, onSaved }: { initial: Vendor | null; onSaved: () => void }) {
  const { user } = useSession();
  const [businessName, setBusinessName] = useState(initial?.businessName ?? user?.name ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'photography');
  const [city, setCity] = useState(initial?.city ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [packages, setPackages] = useState<VendorPackage[]>(
    initial?.packages?.length ? initial.packages : [{ title: '', price: 0 }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const setPkg = (i: number, patch: Partial<VendorPackage>) =>
    setPackages(packages.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const submit = async () => {
    if (!user) return;
    const cleanPkgs = packages.filter((p) => p.title.trim() && p.price > 0);
    if (!businessName.trim() || !city.trim() || cleanPkgs.length === 0) {
      setError('Business name, city and at least one package with a price are required');
      return;
    }
    setBusy(true); setError('');
    try {
      await saveVendorProfile(user, {
        businessName: businessName.trim(), category, city: city.trim(), phone: phone.trim(),
        bio: bio.trim(), packages: cleanPkgs, photos: initial?.photos ?? [],
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="quote-form">
        <label>Business name<input value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></label>
        <label>Category
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.ico} {c.label}</option>)}
          </select>
        </label>
        <label>City<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Bongaigaon" /></label>
        <label>Phone / WhatsApp<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label>About your service<textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></label>
        <h3>Packages</h3>
        {packages.map((p, i) => (
          <div key={i} className="pkg-edit">
            <input placeholder="Package name (e.g. Full day photo + video)" value={p.title} onChange={(e) => setPkg(i, { title: e.target.value })} />
            <input type="number" placeholder="₹" value={p.price || ''} onChange={(e) => setPkg(i, { price: Number(e.target.value) })} />
            <button className="link-btn danger" onClick={() => setPackages(packages.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="link-btn" onClick={() => setPackages([...packages, { title: '', price: 0 }])}>+ Add another package</button>
        <button className="btn btn-gold btn-lg" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Saving…' : initial ? 'Save Changes' : 'Submit for Approval'}
        </button>
        {error && <p className="err">{error}</p>}
      </div>
    </div>
  );
}
