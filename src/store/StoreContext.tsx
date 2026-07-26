import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem, Order, PhotoRequest } from '../types';
import { getListing } from '../lib/inventory';
import { clampQty } from '../lib/pricing';
import { StoreContext, type StoreState } from './context';

/**
 * Cart, wishlist, orders and photo requests live in localStorage. There is no
 * account system yet — everything is tied to the browser, which is why order
 * references matter: they are how a customer identifies an order to us on
 * WhatsApp from a different device.
 */

const KEYS = {
  cart: 'bps.cart.v2',
  wishlist: 'bps.wishlist.v2',
  orders: 'bps.orders.v2',
  photos: 'bps.photoRequests.v1',
} as const;

function load<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or disabled storage must not take the checkout down with it.
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // Listings that have since gone out of stock are dropped on load rather than
  // left to fail silently at checkout.
  const [cart, setCart] = useState<CartItem[]>(() =>
    load<CartItem[]>(KEYS.cart, []).filter((item) => getListing(item.listingId)),
  );
  const [wishlist, setWishlist] = useState<string[]>(() =>
    load<string[]>(KEYS.wishlist, []).filter((id) => getListing(id)),
  );
  const [orders, setOrders] = useState<Order[]>(() => load<Order[]>(KEYS.orders, []));
  const [photoRequests, setPhotoRequests] = useState<PhotoRequest[]>(() =>
    load<PhotoRequest[]>(KEYS.photos, []),
  );

  useEffect(() => save(KEYS.cart, cart), [cart]);
  useEffect(() => save(KEYS.wishlist, wishlist), [wishlist]);
  useEffect(() => save(KEYS.orders, orders), [orders]);
  useEffect(() => save(KEYS.photos, photoRequests), [photoRequests]);

  const addToCart = useCallback((listingId: string, qty = 1) => {
    const listing = getListing(listingId);
    if (!listing) return;

    setCart((prev) => {
      const existing = prev.find((i) => i.listingId === listingId);
      if (!existing) return [...prev, { listingId, qty: clampQty(qty, listing.stock) }];
      return prev.map((i) =>
        i.listingId === listingId ? { ...i, qty: clampQty(i.qty + qty, listing.stock) } : i,
      );
    });
  }, []);

  const setQty = useCallback((listingId: string, qty: number) => {
    const listing = getListing(listingId);
    const stock = listing?.stock ?? 0;

    setCart((prev) =>
      qty <= 0
        ? prev.filter((i) => i.listingId !== listingId)
        : prev.map((i) => (i.listingId === listingId ? { ...i, qty: clampQty(qty, stock) } : i)),
    );
  }, []);

  const removeFromCart = useCallback((listingId: string) => {
    setCart((prev) => prev.filter((i) => i.listingId !== listingId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWishlist = useCallback((listingId: string) => {
    setWishlist((prev) =>
      prev.includes(listingId) ? prev.filter((id) => id !== listingId) : [listingId, ...prev],
    );
  }, []);

  const placeOrder = useCallback((order: Order) => {
    setOrders((prev) => [order, ...prev]);
    setCart([]);
  }, []);

  const addPhotoRequest = useCallback((request: PhotoRequest) => {
    setPhotoRequests((prev) => [request, ...prev]);
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const value = useMemo<StoreState>(
    () => ({
      cart,
      wishlist,
      orders,
      photoRequests,
      addToCart,
      setQty,
      removeFromCart,
      clearCart,
      toggleWishlist,
      inWishlist: (id: string) => wishlist.includes(id),
      placeOrder,
      addPhotoRequest,
      cartCount,
    }),
    [
      cart,
      wishlist,
      orders,
      photoRequests,
      addToCart,
      setQty,
      removeFromCart,
      clearCart,
      toggleWishlist,
      placeOrder,
      addPhotoRequest,
      cartCount,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
