import { useEffect, useState } from 'react';
import type { Order, OrderStatus } from '../../types';
import { fetchAllOrders, updateOrderStatus } from '../../lib/api';
import { formatINR } from '../../data/products';

const STATUSES: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '🕐 New — awaiting confirmation',
  confirmed: '✅ Confirmed',
  shipped: '🚚 Shipped',
  delivered: '📦 Delivered',
  cancelled: '✖ Cancelled',
  returned: '↩ Returned',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () =>
    fetchAllOrders()
      .then((list) => {
        setOrders(list);
        setError('');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load orders'))
      .finally(() => setLoading(false));

  useEffect(() => {
    void load();
  }, []);

  const refresh = () => {
    setLoading(true);
    void load();
  };

  const setStatus = async (order: Order, status: OrderStatus) => {
    try {
      await updateOrderStatus(order.id, status);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  if (loading) return <p className="muted">Loading orders…</p>;
  if (error) return <p className="promo-err">{error}</p>;
  if (orders.length === 0) {
    return <p className="muted">No orders yet. When a customer places an order it will appear here instantly.</p>;
  }

  return (
    <div>
      <div className="admin-toolbar">
        <span className="muted">{orders.length} orders · {orders.filter((o) => (o.status ?? 'pending') === 'pending').length} new</span>
        <button className="btn btn-outline" onClick={refresh}>↻ Refresh</button>
      </div>
      {orders.map((order) => (
        <div key={order.id} className="card order-card">
          <div className="order-head">
            <div>
              <strong>{order.id}</strong>
              <span className="muted"> · {new Date(order.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <strong>{formatINR(order.total)}</strong>
          </div>
          {order.items.map((item) => (
            <div key={item.productId} className="review-line">
              <span>{item.title} × {item.qty} <small className="muted">(Grade {item.grade})</small></span>
              <span>{formatINR(item.price * item.qty)}</span>
            </div>
          ))}
          <div className="order-meta">
            <div>
              <strong>{order.address.name}</strong> · 📞 {order.address.phone}
              <div className="muted">
                {order.address.line1}, {order.address.city}, {order.address.state} – {order.address.pincode}
              </div>
              <div className="muted">
                {order.paymentMethod} · {order.shippingMethod === 'express' ? 'Express' : 'Standard'} shipping
                {order.promoCode && ` · promo ${order.promoCode} (−${formatINR(order.discount)})`}
                {order.gradeEAck && ' · Grade E acknowledged ✓'}
              </div>
            </div>
            <label className="status-select">
              Status
              <select value={order.status ?? 'pending'} onChange={(e) => setStatus(order, e.target.value as OrderStatus)}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
