import { useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useStore } from './store/context';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import Orders from './pages/Orders';
import Wishlist from './pages/Wishlist';
import Admin from './pages/admin/Admin';
import Legal from './pages/Legal';

const CATEGORY_LINKS = [
  { label: 'All', to: '/shop' },
  { label: "🔥 Today's Deals", to: '/shop?deals=1' },
  { label: 'iPhone', to: '/shop?brand=Apple' },
  { label: 'Samsung', to: '/shop?brand=Samsung' },
  { label: 'Pixel', to: '/shop?brand=Google' },
  { label: 'Nothing', to: '/shop?brand=Nothing' },
  { label: 'Other Androids', to: '/shop?brand=other' },
  { label: 'Accessories', to: '/shop?category=accessory' },
];

export default function App() {
  const { cartCount, wishlist } = useStore();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">
            <span className="logo-mark">📱 Budget<span className="logo-accent">Phone</span>Store</span>
            <span className="logo-sub">Bongaigaon · Refurbished &amp; Certified</span>
          </Link>
          <form className="search" onSubmit={submitSearch} role="search">
            <input
              type="search"
              placeholder="Search phones, brands, accessories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search products"
            />
            <button type="submit" className="search-btn" aria-label="Search">🔍</button>
          </form>
          <nav className="nav">
            <NavLink to="/orders"><small>Returns</small><strong>&amp; Orders</strong></NavLink>
            <NavLink to="/wishlist"><small>Your</small><strong>Wishlist {wishlist.length > 0 && <span className="pill">{wishlist.length}</span>}</strong></NavLink>
            <NavLink to="/cart" className="cart-link">
              🛒 <strong>Cart</strong> {cartCount > 0 && <span className="pill">{cartCount}</span>}
            </NavLink>
          </nav>
        </div>
        <nav className="header-cats">
          <div className="container header-cats-inner">
            {CATEGORY_LINKS.map((c) => (
              <Link key={c.label} to={c.to}>{c.label}</Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-confirmed/:id" element={<OrderConfirmation />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/legal/:page" element={<Legal />} />
        </Routes>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <strong>Budget Phone Store</strong> — Bongaigaon, Assam
            <p>Refurbished phones with honest grading, real warranties and 15-day money-back guarantee.</p>
          </div>
          <div className="footer-badges">
            <span>✅ 32-Point Quality Check</span>
            <span>✅ Warranty on Every Grade</span>
            <span>✅ 15-Day Money-Back</span>
            <span>✅ Watch Before You Buy</span>
          </div>
          <div className="footer-links">
            <Link to="/legal/terms">Terms &amp; Conditions</Link>
            <Link to="/legal/returns">Returns &amp; Refunds</Link>
            <Link to="/legal/privacy">Privacy Policy</Link>
            <Link to="/legal/contact">Contact &amp; Grievance Officer</Link>
            <Link to="/admin">Store Owner Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
