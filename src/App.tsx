import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { STORE } from './config';
import { CONDITION_LIST } from './data/conditions';
import { BRANDS } from './data/catalog';
import { POPULAR_SEARCHES } from './lib/search';
import { useStore } from './store/context';
import Home from './pages/Home';
import Shop from './pages/Shop';
import BrandPage from './pages/BrandPage';
import ConditionPage from './pages/ConditionPage';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import Orders from './pages/Orders';
import Wishlist from './pages/Wishlist';
import Help from './pages/Help';

/** Every navigation should start at the top of the new page. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function SearchBar() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  const [focused, setFocused] = useState(false);

  // Keep the box in step with the URL when the user navigates with the back
  // button, without an effect: adjust the state during render instead.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/shop?q=${encodeURIComponent(trimmed)}` : '/shop');
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <form className="search" onSubmit={submit} role="search">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        placeholder="Search a model, colour or capacity"
        aria-label="Search phones"
      />
      <button type="submit" className="btn btn-primary">
        Search
      </button>

      {focused && query.trim().length === 0 && (
        <div className="search-suggest">
          <p className="muted small">Popular right now</p>
          <ul>
            {POPULAR_SEARCHES.map((term) => (
              <li key={term}>
                <button type="button" onMouseDown={() => navigate(`/shop?q=${encodeURIComponent(term)}`)}>
                  {term}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

export default function App() {
  const { cartCount, wishlist } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const [lastPath, setLastPath] = useState(pathname);

  // Collapse the mobile menu whenever the route changes.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  return (
    <div className="app">
      <ScrollToTop />

      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">
            <span className="logo-mark" aria-hidden="true">
              BPS
            </span>
            <span className="logo-text">
              <strong>{STORE.name}</strong>
              <small>
                {STORE.city}, {STORE.state}
              </small>
            </span>
          </Link>

          <SearchBar />

          <nav className="nav" aria-label="Main">
            <NavLink to="/shop">Shop</NavLink>
            <NavLink to="/help">How it works</NavLink>
            <NavLink to="/wishlist" className="nav-count">
              Saved{wishlist.length > 0 && <span className="pill">{wishlist.length}</span>}
            </NavLink>
            <NavLink to="/orders">Orders</NavLink>
            <NavLink to="/cart" className="nav-cart">
              Cart{cartCount > 0 && <span className="pill">{cartCount}</span>}
            </NavLink>
          </nav>

          <button
            type="button"
            className="menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>

        <div className={`subnav${menuOpen ? ' is-open' : ''}`}>
          <div className="container subnav-inner">
            <span className="subnav-label">Condition</span>
            {CONDITION_LIST.map((info) => (
              <NavLink
                key={info.id}
                to={`/condition/${info.id}`}
                style={{ '--accent': info.color } as React.CSSProperties}
              >
                {info.name}
              </NavLink>
            ))}
            <span className="subnav-divider" aria-hidden="true" />
            <span className="subnav-label">Brand</span>
            {BRANDS.slice(0, 8).map((brand) => (
              <NavLink key={brand.slug} to={`/brand/${brand.slug}`}>
                {brand.name}
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      <main className="main" id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/brand/:slug" element={<BrandPage />} />
          <Route path="/condition/:condition" element={<ConditionPage />} />
          <Route path="/phone/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:id" element={<OrderConfirmation />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/help" element={<Help />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <strong>{STORE.name}</strong>
            <p className="muted">{STORE.tagline}</p>
            <address>
              {STORE.addressLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
              <a href={`mailto:${STORE.email}`}>{STORE.email}</a>
              <span>{STORE.hours}</span>
            </address>
          </div>

          <div className="footer-col">
            <h2>Shop</h2>
            <ul>
              <li>
                <Link to="/shop">All phones</Link>
              </li>
              {BRANDS.slice(0, 5).map((brand) => (
                <li key={brand.slug}>
                  <Link to={`/brand/${brand.slug}`}>{brand.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h2>Condition</h2>
            <ul>
              {CONDITION_LIST.map((info) => (
                <li key={info.id}>
                  <Link to={`/condition/${info.id}`}>{info.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h2>Buying here</h2>
            <ul>
              <li>
                <Link to="/help">How we grade</Link>
              </li>
              <li>
                <Link to="/help">The booking charge</Link>
              </li>
              <li>
                <Link to="/help">Real photos on request</Link>
              </li>
              <li>
                <Link to="/help">Warranty and returns</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="container footer-bottom">
          <p className="muted small">
            © {new Date().getFullYear()} {STORE.name}, {STORE.city}. Online payments processed by Razorpay.
          </p>
        </div>
      </footer>
    </div>
  );
}
