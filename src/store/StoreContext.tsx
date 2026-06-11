import { useEffect, useState, type ReactNode } from 'react';
import type { CartItem, Order } from '../types';
import { PRODUCTS } from '../data/products';
import { StoreContext } from './context';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => load('bps_cart', []));
  const [wishlist, setWishlist] = useState<string[]>(() => load('bps_wishlist', []));
  const [orders, setOrders] = useState<Order[]>(() => load('bps_orders', []));

  useEffect(() => localStorage.setItem('bps_cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('bps_wishlist', JSON.stringify(wishlist)), [wishlist]);
  useEffect(() => localStorage.setItem('bps_orders', JSON.stringify(orders)), [orders]);

  const addToCart = (productId: string, qty = 1) => {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, qty: Math.min(i.qty + qty, product.stock) } : i,
        );
      }
      return [...prev, { productId, qty: Math.min(qty, product.stock) }];
    });
  };

  const setQty = (productId: string, qty: number) => {
    const product = PRODUCTS.find((p) => p.id === productId);
    const max = product ? product.stock : qty;
    setCart((prev) =>
      qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, qty: Math.min(qty, max) } : i)),
    );
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((i) => i.productId !== productId));

  const clearCart = () => setCart([]);

  const toggleWishlist = (productId: string) =>
    setWishlist((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );

  const placeOrder = (order: Order) => {
    setOrders((prev) => [order, ...prev]);
    setCart([]);
  };

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  return (
    <StoreContext.Provider
      value={{ cart, wishlist, orders, addToCart, setQty, removeFromCart, clearCart, toggleWishlist, placeOrder, cartCount }}
    >
      {children}
    </StoreContext.Provider>
  );
}
