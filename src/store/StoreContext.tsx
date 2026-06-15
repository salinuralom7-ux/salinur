import { useEffect, useState, type ReactNode } from 'react';
import type { CartItem, Order } from '../types';
import { getBranch, stockAt } from '../data/branches';
import { useData } from './dataContext';
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
  const { products, branches } = useData();
  const [cart, setCart] = useState<CartItem[]>(() => load('bps_cart', []));
  const [wishlist, setWishlist] = useState<string[]>(() => load('bps_wishlist', []));
  const [orders, setOrders] = useState<Order[]>(() => load('bps_orders', []));
  const [storedBranchId, setStoredBranchId] = useState<string | null>(() => load<string | null>('bps_branch', null));

  // A stored branch that no longer exists (e.g. after branches change) is
  // treated as "not chosen", so the picker reopens instead of showing an
  // empty catalog. Derived rather than reset-in-effect to avoid extra renders.
  const branchKnown =
    storedBranchId === 'all' || (branches.length > 0 && branches.some((b) => b.id === storedBranchId));
  const branchId = storedBranchId && branchKnown ? storedBranchId : null;

  useEffect(() => localStorage.setItem('bps_cart', JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem('bps_wishlist', JSON.stringify(wishlist)), [wishlist]);
  useEffect(() => localStorage.setItem('bps_orders', JSON.stringify(orders)), [orders]);
  useEffect(() => {
    if (branchId) localStorage.setItem('bps_branch', JSON.stringify(branchId));
  }, [branchId]);

  const setBranch = (id: string) => setStoredBranchId(id);
  const branch = getBranch(branches, branchId) ?? null;

  const addToCart = (productId: string, qty = 1) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const max = stockAt(product, branchId);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, qty: Math.min(i.qty + qty, max) } : i,
        );
      }
      return [...prev, { productId, qty: Math.min(qty, max) }];
    });
  };

  const setQty = (productId: string, qty: number) => {
    const product = products.find((p) => p.id === productId);
    const max = product ? stockAt(product, branchId) : qty;
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
      value={{ cart, wishlist, orders, branchId, branch, setBranch, addToCart, setQty, removeFromCart, clearCart, toggleWishlist, placeOrder, cartCount }}
    >
      {children}
    </StoreContext.Provider>
  );
}
