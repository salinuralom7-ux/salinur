import { useState } from 'react';
import { clearSupabaseConfig, getSupabaseConfig, isSupabaseConfigured, saveSupabaseConfig } from '../../lib/supabaseClient';
import { getSupabase } from '../../lib/supabaseClient';

export default function AdminSettings() {
  const initial = getSupabaseConfig();
  const [url, setUrl] = useState(initial.url);
  const [key, setKey] = useState(initial.key);
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const connected = isSupabaseConfigured();

  const save = async () => {
    saveSupabaseConfig(url, key);
    setTesting(true);
    setStatus('');
    try {
      const sb = getSupabase();
      if (!sb) throw new Error('Invalid URL or key format');
      const { error } = await sb.from('products').select('id').limit(1);
      if (error) throw new Error(error.message);
      setStatus('✓ Connected! The store now loads from your Supabase database. Reload the page to see it.');
    } catch (e) {
      setStatus('✗ Connection failed: ' + (e instanceof Error ? e.message : 'unknown error') +
        '. Check that you ran the setup SQL and copied the values correctly.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card">
      <h2>Connect your Supabase database</h2>
      <p className="muted">
        {connected
          ? 'Connected — your products and orders are stored in Supabase.'
          : 'The store is in demo mode. Follow these one-time steps to go live (about 10 minutes):'}
      </p>
      {!connected && (
        <ol className="setup-steps">
          <li>Go to <strong>supabase.com</strong> → create a free account → "New project" (any name, choose the <strong>Mumbai</strong> region, set a database password and keep it safe).</li>
          <li>In the left menu open <strong>SQL Editor</strong>, paste the contents of the file <code>supabase/migrations/001_init.sql</code> (in the project; ask Claude to show it), and press <strong>Run</strong>.</li>
          <li>In the left menu open <strong>Project Settings → API</strong>. Copy the <strong>Project URL</strong> and the <strong>anon public</strong> key into the boxes below.</li>
          <li>Press Save &amp; Test, then register the first admin account on this page — that account becomes the store admin automatically.</li>
        </ol>
      )}
      <div className="form-grid">
        <label className="span2">Project URL
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
        </label>
        <label className="span2">Anon public key
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi..." />
        </label>
      </div>
      <div className="step-nav">
        <button
          className="link-btn danger"
          onClick={() => { clearSupabaseConfig(); setUrl(''); setKey(''); setStatus('Disconnected — back to demo mode.'); }}
        >
          Disconnect
        </button>
        <button className="btn btn-primary btn-lg" disabled={testing || !url || !key} onClick={save}>
          {testing ? 'Testing…' : 'Save & Test Connection'}
        </button>
      </div>
      {status && <p className={status.startsWith('✓') ? 'promo-ok' : 'promo-err'}>{status}</p>}
      <p className="muted">
        The anon key is designed to be public — all protection is enforced by database security rules
        (only the admin account can change products or read customer orders).
      </p>
    </div>
  );
}
