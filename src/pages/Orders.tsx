import { Link } from 'react-router-dom';
import { useStore } from '../store/context';
import { formatINR } from '../data/products';

export default function Orders() {
  const { orders } = useStore();

  if (orders.length === 0) {
    return (
      <div className="container empty-state">
        <h1>No orders yet</h1>
        <p className="muted">Your orders and active warranty cards will appear here.</p>
        <Link to="/shop" className="btn btn-primary btn-lg">Shop Phones</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>My Orders &amp; Warranties</h1>
      {orders.map((order) => (
        <div key={order.id} className="card order-card">
          <div className="order-head">
            <div>
              <strong>{order.id}</strong>
              <span className="muted"> · {new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <strong>{formatINR(order.total)}</strong>
          </div>
          {order.items.map((item) => {
            const expiry = new Date(order.date);
            expiry.setMonth(expiry.getMonth() + item.warrantyMonths);
            const active = expiry > new Date();
            return (
              <div key={item.productId} className="order-item">
                <div>
                  <Link to={`/product/${item.productId}`}>{item.title}</Link> × {item.qty}
                  <div className="muted">Grade {item.grade}</div>
                </div>
                <div className={`warranty-chip ${active ? 'active' : 'expired'}`}>
                  🛡️ Warranty {active ? 'active' : 'expired'} —{' '}
                  {active ? 'until' : 'ended'} {expiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            );
          })}
          <div className="muted order-foot">
            Paid via {order.paymentMethod} · Delivered to {order.address.city}, {order.address.state} ·
            15-day return window from delivery · To file a warranty claim, contact the store with your order ID.
          </div>
        </div>
      ))}
    </div>
  );
}
