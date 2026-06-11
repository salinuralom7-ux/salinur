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
            📱 Budget Phone Store
            <span className="logo-sub">Bongaigaon, Assam</span>
          </Link>
          <form className="search" onSubmit={submitSearch} role="search">
            <input
              type="search"
              placeholder='Search "iPhone 12 64GB black"…'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search products"
            />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
          <nav className="nav">
            <NavLink to="/shop">Shop</NavLink>
            <NavLink to="/orders">My Orders</NavLink>
            <NavLink to="/wishlist">Wishlist {wishlist.length > 0 && <span className="pill">{wishlist.length}</span>}</NavLink>
            <NavLink to="/cart" className="cart-link">
              🛒 Cart {cartCount > 0 && <span className="pill">{cartCount}</span>}
            </NavLink>
          </nav>
        </div>
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
            <Link to="/admin">Store Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
