import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Role } from '../types';
import { inDemoMode, setDemoUser, signIn, signUp } from '../lib/api';
import { useSession } from '../sessionContext';

export default function Auth() {
  const { setUser } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup'>(params.get('role') ? 'signup' : 'signin');
  const [role, setRole] = useState<Role>((params.get('role') as Role) === 'vendor' ? 'vendor' : 'customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const goHome = (r: Role) => navigate(r === 'vendor' ? '/vendor' : r === 'admin' ? '/admin' : '/my');

  const demoLogin = (r: Role) => {
    const u = setDemoUser(r);
    setUser(u);
    goHome(r);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const user = mode === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, role, name.trim() || email.split('@')[0]);
      setUser(user);
      goHome(user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container auth-page">
      {inDemoMode() ? (
        <div className="card auth-card">
          <h1>Try the demo</h1>
          <p className="muted">
            The platform is in demo mode (no database connected yet). Pick a role to explore —
            all three see the same data on this device, so you can play the whole journey.
          </p>
          <button className="btn btn-gold btn-lg btn-block" onClick={() => demoLogin('customer')}>👰 Enter as Customer (Priya &amp; Rohit)</button>
          <button className="btn btn-maroon btn-lg btn-block" onClick={() => demoLogin('vendor')}>📦 Enter as Vendor (Arjun Photography)</button>
          <button className="btn btn-line btn-lg btn-block" onClick={() => demoLogin('admin')}>🛠️ Enter as Platform Owner</button>
        </div>
      ) : (
        <div className="card auth-card">
          <h1>{mode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
          <form onSubmit={submit}>
            {mode === 'signup' && (
              <>
                <div className="role-pick">
                  <button type="button" className={role === 'customer' ? 'active' : ''} onClick={() => setRole('customer')}>👰 I'm planning a wedding</button>
                  <button type="button" className={role === 'vendor' ? 'active' : ''} onClick={() => setRole('vendor')}>📦 I'm a wedding vendor</button>
                </div>
                <label>{role === 'vendor' ? 'Business name' : 'Your name'}
                  <input required value={name} onChange={(e) => setName(e.target.value)} />
                </label>
              </>
            )}
            <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="btn btn-gold btn-lg btn-block" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
            {error && <p className="err">{error}</p>}
          </form>
          <button className="link-btn" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
        </div>
      )}
    </div>
  );
}
