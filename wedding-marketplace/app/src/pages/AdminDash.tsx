import { useCallback, useEffect, useState } from 'react';
import { catIco, catLabel, inr, type Booking, type Vendor } from '../types';
import { listAllVendors, listBookings, setBookingStatus, setVendorStatus } from '../lib/api';
import { clearConfig, getConfig, getSupabase, isConfigured, saveConfig } from '../lib/supabase';
import { useSession } from '../sessionContext';

type Tab = 'vendors' | 'bookings' | 'settings';

export default function AdminDash() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>('vendors');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(() => {
    if (!user) return;
    void listAllVendors().then(setVendors).catch(() => {});
    void listBookings(user).then(setBookings).catch(() => {});
  }, [user]);

  useEffect(refresh, [refresh]);

  if (!user) return null;

  const pending = vendors.filter((v) => v.status === 'pending');
  const totalCommission = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'completed')
    .reduce((s, b) => s + b.commission, 0);
  const gmv = bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((s, b) => s + b.amount, 0);

  return (
    <div className="container">
      <h1>Owner Dashboard</h1>
      {notice && <p className="ok-box">{notice}</p>}

      <div className="stat-row">
        <div className="stat"><strong>{vendors.filter((v) => v.status === 'approved').length}</strong><span>live vendors</span></div>
        <div className="stat"><strong>{pending.length}</strong><span>awaiting approval</span></div>
        <div className="stat"><strong>{inr(gmv)}</strong><span>booking value (GMV)</span></div>
        <div className="stat"><strong>{inr(totalCommission)}</strong><span>your commission</span></div>
      </div>

      <div className="tabs-row">
        <button className={tab === 'vendors' ? 'active' : ''} onClick={() => setTab('vendors')}>
          🏪 Vendors {pending.length > 0 && <span className="dot">{pending.length}</span>}
        </button>
        <button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}>📒 Bookings</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>⚙️ Settings</button>
      </div>

      {tab === 'vendors' && vendors.map((v) => (
        <div key={v.id} className="card">
          <div className="row-head">
            <strong>{catIco(v.category)} {v.businessName}</strong>
            <span className="status">{v.status.toUpperCase()}</span>
          </div>
          <p className="muted">{catLabel(v.category)} · {v.city} · {v.phone || 'no phone'} · ⭐ {v.rating || '—'} ({v.reviewCount})</p>
          <p className="muted">{v.bio}</p>
          <div className="btn-row">
            {v.status !== 'approved' && (
              <button className="btn btn-gold" onClick={() => void setVendorStatus(v.id, 'approved').then(() => { setNotice(`${v.businessName} approved & live.`); refresh(); })}>
                ✓ Approve
              </button>
            )}
            {v.status !== 'suspended' && (
              <button className="btn btn-line" onClick={() => void setVendorStatus(v.id, 'suspended').then(refresh)}>Suspend</button>
            )}
            {v.status === 'suspended' && (
              <button className="btn btn-gold" onClick={() => void setVendorStatus(v.id, 'approved').then(refresh)}>Re-activate</button>
            )}
          </div>
        </div>
      ))}

      {tab === 'bookings' && (
        bookings.length === 0 ? <p className="muted">No bookings yet.</p>
        : bookings.map((b) => (
          <div key={b.id} className="card">
            <div className="row-head">
              <strong>{b.customerName} → {b.vendorName}</strong>
              <span className="status">{b.status.replace('_', ' ').toUpperCase()}</span>
            </div>
            <p className="muted">{b.eventDate} · {inr(b.amount)} · your commission {inr(b.commission)} · ref {b.id.slice(0, 8).toUpperCase()}</p>
            <div className="btn-row">
              {b.status === 'advance_pending' && (
                <button className="btn btn-gold" onClick={() => void setBookingStatus(b.id, 'confirmed').then(() => { setNotice('Advance received — booking confirmed. Both parties see it locked.'); refresh(); })}>
                  ✓ Advance received — confirm
                </button>
              )}
              {b.status !== 'cancelled' && b.status !== 'completed' && (
                <button className="btn btn-line" onClick={() => void setBookingStatus(b.id, 'cancelled').then(refresh)}>Cancel</button>
              )}
            </div>
          </div>
        ))
      )}

      {tab === 'settings' && <Settings />}
    </div>
  );
}

function Settings() {
  const initial = getConfig();
  const [url, setUrl] = useState(initial.url);
  const [key, setKey] = useState(initial.key);
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);

  const save = async () => {
    saveConfig(url, key);
    setTesting(true); setStatus('');
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Invalid URL or key');
      const { error } = await sb.from('vendors').select('id').limit(1);
      if (error) throw new Error(error.message);
      setStatus('✓ Connected! Reload the page — the platform now runs on your Supabase database.');
    } catch (e) {
      setStatus('✗ ' + (e instanceof Error ? e.message : 'Connection failed') + ' — check that you ran supabase/001_init.sql');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card">
      <h2>Connect Supabase (go live)</h2>
      <p className="muted">
        {isConfigured() ? 'Connected — the platform runs on your database.' : 'In demo mode everything stays on this device. To go live (~10 min):'}
      </p>
      {!isConfigured() && (
        <ol className="muted setup-list">
          <li>Create a free project at <strong>supabase.com</strong> (region: Mumbai).</li>
          <li>SQL Editor → paste the whole file <code>wedding-marketplace/app/supabase/001_init.sql</code> → Run.</li>
          <li>Project Settings → API → copy the URL and anon key below.</li>
          <li>Save, reload, then <strong>register the first account — it becomes the platform admin automatically.</strong></li>
        </ol>
      )}
      <div className="quote-form">
        <label>Project URL<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></label>
        <label>Anon public key<input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJ..." /></label>
        <div className="btn-row">
          <button className="btn btn-gold" disabled={testing || !url || !key} onClick={() => void save()}>
            {testing ? 'Testing…' : 'Save & Test'}
          </button>
          <button className="link-btn danger" onClick={() => { clearConfig(); setUrl(''); setKey(''); setStatus('Disconnected — demo mode.'); }}>
            Disconnect
          </button>
        </div>
        {status && <p className={status.startsWith('✓') ? 'ok-box' : 'err'}>{status}</p>}
      </div>
    </div>
  );
}
