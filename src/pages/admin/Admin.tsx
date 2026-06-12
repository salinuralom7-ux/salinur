import { useEffect, useState } from 'react';
import { adminSignIn, adminSignOut, adminSignUp, getAdminSession, inDemoMode, type AdminSession } from '../../lib/api';
import AdminProducts from './AdminProducts';
import AdminOrders from './AdminOrders';
import AdminSettings from './AdminSettings';

type Tab = 'products' | 'orders' | 'settings';

const PIN_HASH_KEY = 'bps_admin_pin_hash';
const PIN_UNLOCKED_KEY = 'bps_admin_unlocked';

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode('bps-pin:' + pin);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>('products');
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [pinUnlocked, setPinUnlocked] = useState(() => sessionStorage.getItem(PIN_UNLOCKED_KEY) === '1');
  const demo = inDemoMode();

  useEffect(() => {
    getAdminSession()
      .then(setSession)
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <div className="container empty-state"><p className="muted">Loading…</p></div>;

  // Demo mode: gate the panel behind the owner's PIN.
  if (demo && !pinUnlocked) {
    return (
      <div className="container">
        <PinGate onUnlocked={() => { sessionStorage.setItem(PIN_UNLOCKED_KEY, '1'); setPinUnlocked(true); }} />
      </div>
    );
  }

  // Connected to Supabase but not signed in as admin → show login.
  if (!demo && (!session || !session.isAdmin)) {
    return (
      <div className="container">
        {session && !session.isAdmin && (
          <div className="admin-banner warn">
            Signed in as {session.email}, but this account is not an admin. The first account
            registered after setup becomes admin automatically.
            <button className="link-btn" onClick={() => adminSignOut().then(() => setSession(null))}>Sign out</button>
          </div>
        )}
        {!session && <AdminLogin onSignedIn={setSession} />}
        <div style={{ marginTop: 24 }}>
          <AdminSettings />
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="admin-head">
        <h1>Store Admin</h1>
        {demo ? (
          <span className="admin-banner warn">
            Demo mode — changes are saved only on this device. Connect Supabase in Settings to go live.
          </span>
        ) : (
          <span className="muted">
            {session?.email}{' '}
            <button className="link-btn" onClick={() => adminSignOut().then(() => setSession(null))}>Sign out</button>
          </span>
        )}
      </div>
      <div className="admin-tabs">
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>📦 Products</button>
        <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>🧾 Orders</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>⚙️ Settings</button>
      </div>
      {tab === 'products' && <AdminProducts />}
      {tab === 'orders' && <AdminOrders />}
      {tab === 'settings' && <AdminSettings />}
    </div>
  );
}

function AdminLogin({ onSignedIn }: { onSignedIn: (s: AdminSession) => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const action = mode === 'signin' ? adminSignIn : adminSignUp;
    action(email, password)
      .then(onSignedIn)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed'))
      .finally(() => setBusy(false));
  };

  return (
    <div className="card admin-login">
      <h2>{mode === 'signin' ? 'Admin Sign In' : 'Create Admin Account'}</h2>
      <p className="muted">
        {mode === 'signup'
          ? 'The first account registered becomes the store admin automatically.'
          : 'Sign in with your admin email and password.'}
      </p>
      <form onSubmit={submit} className="form-grid">
        <label className="span2">Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="span2">Password
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <div className="span2">
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Register'}
          </button>{' '}
          <button type="button" className="link-btn" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'First time? Create the admin account' : 'Already registered? Sign in'}
          </button>
        </div>
        {error && <p className="promo-err span2">{error}</p>}
      </form>
    </div>
  );
}

function PinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const hasPin = !!localStorage.getItem(PIN_HASH_KEY);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!hasPin) {
        if (!/^\d{6}$/.test(pin)) throw new Error('PIN must be exactly 6 digits');
        if (pin !== confirm) throw new Error('PINs do not match');
        localStorage.setItem(PIN_HASH_KEY, await hashPin(pin));
        onUnlocked();
      } else {
        const stored = localStorage.getItem(PIN_HASH_KEY);
        if ((await hashPin(pin)) !== stored) throw new Error('Wrong PIN');
        onUnlocked();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card admin-login">
      <h2>🔒 {hasPin ? 'Store Admin is locked' : 'Protect the Store Admin'}</h2>
      <p className="muted">
        {hasPin
          ? 'Enter your 6-digit owner PIN to open the admin panel.'
          : 'Set a 6-digit PIN so only you can open the admin panel on this device. Once you connect Supabase, the panel is protected by your email + password login instead.'}
      </p>
      <form onSubmit={submit} className="form-grid">
        <label className="span2">{hasPin ? 'Owner PIN' : 'Choose a 6-digit PIN'}
          <input
            type="password" inputMode="numeric" maxLength={6} autoFocus
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        {!hasPin && (
          <label className="span2">Repeat the PIN
            <input
              type="password" inputMode="numeric" maxLength={6}
              value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
            />
          </label>
        )}
        <div className="span2">
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy || pin.length !== 6}>
            {hasPin ? 'Unlock' : 'Set PIN & Open Admin'}
          </button>
        </div>
        {error && <p className="promo-err span2">{error}</p>}
      </form>
    </div>
  );
}
