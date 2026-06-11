import { Link, useNavigate } from 'react-router-dom';
import { PRODUCTS, formatINR, productTitle } from '../data/products';
import { GRADES } from '../data/grades';
import { useStore } from '../store/context';
import GradeBadge from '../components/GradeBadge';
import PhoneImage from '../components/PhoneImage';

export default function Cart() {
  const { cart, setQty, removeFromCart, toggleWishlist } = useStore();
  const navigate = useNavigate();

  const lines = cart
    .map((item) => ({ item, product: PRODUCTS.find((p) => p.id === item.productId)! }))
    .filter((l) => l.product);

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.item.qty, 0);

  if (lines.length === 0) {
    return (
      <div className="container empty-state">
        <h1>Your cart is empty</h1>
        <p className="muted">Browse our graded refurbished phones — every grade carries a warranty.</p>
        <Link to="/shop" className="btn btn-primary btn-lg">Shop Phones</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Shopping Cart</h1>
      <div className="cart-layout">
        <div className="cart-items">
          {lines.map(({ item, product }) => (
            <div key={product.id} className="cart-item">
              <Link to={`/product/${product.id}`}>
                <PhoneImage product={product} />
              </Link>
              <div className="cart-item-info">
                <GradeBadge grade={product.grade} />
                <Link to={`/product/${product.id}`} className="cart-item-title">
                  {productTitle(product)}
                </Link>
                <div className="muted">{GRADES[product.grade].warrantyNote}</div>
                {product.stock <= 3 && <div className="stock-warn">Only {product.stock} left in stock</div>}
                <div className="cart-item-actions">
                  <div className="qty-control">
                    <button onClick={() => setQty(product.id, item.qty - 1)} aria-label="Decrease quantity">−</button>
                    <span>{item.qty}</span>
                    <button
                      onClick={() => setQty(product.id, item.qty + 1)}
                      disabled={item.qty >= product.stock}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button className="link-btn" onClick={() => { toggleWishlist(product.id); removeFromCart(product.id); }}>
                    Move to wishlist
                  </button>
                  <button className="link-btn danger" onClick={() => removeFromCart(product.id)}>
                    Remove
                  </button>
                </div>
              </div>
              <div className="cart-item-price">{formatINR(product.price * item.qty)}</div>
            </div>
          ))}
        </div>

        <aside className="cart-summary">
          <h3>Order Summary</h3>
          <div className="summary-row"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>Calculated at checkout</span></div>
          <div className="summary-row total"><span>Total</span><span>{formatINR(subtotal)}</span></div>
          <p className="muted">Promo codes can be applied at checkout. Estimated delivery: 5–7 days (standard).</p>
          <button className="btn btn-buy btn-block btn-lg" onClick={() => navigate('/checkout')}>
            Proceed to Checkout
          </button>
        </aside>
      </div>
    </div>
  );
}
