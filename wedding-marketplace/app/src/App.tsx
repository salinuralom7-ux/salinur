import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './sessionContext';
import { inDemoMode, signOut } from './lib/api';
import Home from './pages/Home';
import Browse from './pages/Browse';
import VendorDetail from './pages/VendorDetail';
import Auth from './pages/Auth';
import CustomerDash from './pages/CustomerDash';
import VendorDash from './pages/VendorDash';
import AdminDash from './pages/AdminDash';
import Legal from './pages/Legal';

export default function App() {
  const { user, loading, setUser } = useSession();

  const dashPath = user?.role === 'vendor' ? '/vendor' : user?.role === 'admin' ? '/admin' : '/my';

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">💍 Shaadi<span>Setu</span><small>Assam's wedding marketplace</small></Link>
          <nav className="nav">
            <NavLink to="/vendors">Find Vendors</NavLink>
            {user ? (
              <>
                <NavLink to={dashPath}>
                  {user.role === 'vendor' ? 'Vendor Dashboard' : user.role === 'admin' ? 'Owner Dashboard' : 'My Wedding'}
                </NavLink>
                <button
                  className="link-btn nav-signout"
                  onClick={() => { void signOut().then(() => setUser(null)); }}
                >
                  Sign out ({user.name.split(' ')[0]})
                </button>
              </>
            ) : (
              <NavLink to="/auth" className="nav-cta">Sign In / Join</NavLink>
            )}
          </nav>
        </div>
        {inDemoMode() && (
          <div className="demo-strip">
            Demo mode — data stays on this device. The owner connects Supabase from the Owner Dashboard to go live.
          </div>
        )}
      </header>

      <main className="main">
        {loading ? (
          <div className="container empty"><p>Loading…</p></div>
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/vendors" element={<Browse />} />
            <Route path="/vendor/:id" element={<VendorDetail />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/my" element={user?.role === 'customer' ? <CustomerDash /> : <Navigate to="/auth" />} />
            <Route path="/vendor" element={user?.role === 'vendor' ? <VendorDash /> : <Navigate to="/auth" />} />
            <Route path="/admin" element={user?.role === 'admin' ? <AdminDash /> : <Navigate to="/auth" />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="/legal/:page" element={<Legal />} />
          </Routes>
        )}
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <strong>ShaadiSetu</strong> — Bongaigaon, Assam
            <p>Verified wedding vendors · transparent quotes · booking protection.</p>
          </div>
          <div className="footer-links">
            <Link to="/legal/terms">Terms &amp; Conditions</Link>
            <Link to="/legal/privacy">Privacy Policy</Link>
            <Link to="/legal/refunds">Cancellations &amp; Refunds</Link>
            <Link to="/legal/contact">Contact &amp; Grievance Officer</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
