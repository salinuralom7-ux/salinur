import { Link, useParams } from 'react-router-dom';
import { useStore } from '../store/context';
import { formatINR } from '../data/products';

export default function OrderConfirmation() {
  const { id } = useParams();
  const { orders } = useStore();
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <div className="container empty-state">
        <h1>Order not found</h1>
        <Link to="/shop" className="btn btn-primary">Back to Shop</Link>
      </div>
    );
  }

  const eta = new Date(order.date);
  eta.setDate(eta.getDate() + (order.shippingMethod === 'express' ? 3 : 7));

  return (
    <div className="container empty-state">
      <div className="confirm-card">
        <div className="confirm-tick">✓</div>
        <h1>Order placed!</h1>
        <p>
          Order ID: <strong>{order.id}</strong>
        </p>
        <p className="muted">
          A confirmation with your invoice and tracking link will be sent by email &amp; SMS.
          Estimated delivery by <strong>{eta.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</strong>.
        </p>
        <div className="confirm-items">
          {order.items.map((i) => (
            <div key={i.productId} className="review-line">
              <span>{i.title} × {i.qty} <small className="muted">({i.warrantyMonths}-month warranty)</small></span>
              <span>{formatINR(i.price * i.qty)}</span>
            </div>
          ))}
          <div className="review-line total"><span>Paid ({order.paymentMethod})</span><span>{formatINR(order.total)}</span></div>
        </div>
        <p className="muted">🛡️ Warranty cards for each device are now active in <Link to="/orders">My Orders</Link>.</p>
        <div className="hero-actions">
          <Link to="/orders" className="btn btn-primary btn-lg">View My Orders</Link>
          <Link to="/shop" className="btn btn-outline btn-lg">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
