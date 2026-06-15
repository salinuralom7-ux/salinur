import { useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useStore } from './store/context';
import { BRANCHES, isAllBranches, whatsappLink } from './data/branches';
import BranchPicker from './components/BranchPicker';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import Orders from './pages/Orders';
import Wishlist from './pages/Wishlist';
import Branches from './pages/Branches';

export default function App() {
  const { cartCount, wishlist, branchId, branch } = useStore();
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const navigate = useNavigate();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
  };

  const branchLabel = branch ? branch.city : isAllBranches(branchId) ? 'All branches' : 'Choose store';
  // Floating WhatsApp uses the active branch, or the main branch as a fallback.
  const waBranch = branch ?? BRANCHES[0];

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">
            📱 Budget Phone Store
            <span className="logo-sub">Refurbished phones · Assam</span>
          </Link>
          <button className="branch-chip" onClick={() => setPickerOpen(true)} aria-label="Change branch">
            📍 <span className="branch-chip-label">{branchLabel}</span>
            <span className="branch-chip-change">Change</span>
          </button>
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
            <NavLink to="/branches">Stores</NavLink>
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
          <Route path="/branches" element={<Branches />} />
        </Routes>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <strong>Budget Phone Store</strong> — Bongaigaon · Guwahati · Barpeta Road
            <p>Refurbished phones with honest grading, real warranties and 15-day money-back guarantee.</p>
            <p><Link to="/branches">Find a store near you →</Link></p>
          </div>
          <div className="footer-badges">
            <span>✅ 32-Point Quality Check</span>
            <span>✅ Warranty on Every Grade</span>
            <span>✅ 15-Day Money-Back</span>
            <span>✅ Watch Before You Buy</span>
          </div>
        </div>
      </footer>

      <a
        className="whatsapp-fab"
        href={whatsappLink(waBranch, `Hi ${waBranch.name}, I have a question about a refurbished phone.`)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
      >
        💬
      </a>

      <BranchPicker open={pickerOpen || branchId === null} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
