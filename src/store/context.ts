import { createContext, useContext } from 'react';
import type { CartItem, Order, PhotoRequest } from '../types';

export interface StoreState {
  cart: CartItem[];
  wishlist: string[];
  orders: Order[];
  photoRequests: PhotoRequest[];

  addToCart: (listingId: string, qty?: number) => void;
  setQty: (listingId: string, qty: number) => void;
  removeFromCart: (listingId: string) => void;
  clearCart: () => void;

  toggleWishlist: (listingId: string) => void;
  inWishlist: (listingId: string) => boolean;

  placeOrder: (order: Order) => void;
  addPhotoRequest: (request: PhotoRequest) => void;

  cartCount: number;
}

export const StoreContext = createContext<StoreState | null>(null);

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/** Order references are shown to the customer and quoted back to us on WhatsApp. */
export function newOrderRef(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const salt = Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, '0');
  return `BPS-${stamp}-${salt}`;
}
