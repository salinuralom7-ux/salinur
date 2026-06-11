import { createContext, useContext } from 'react';
import type { CartItem, Order } from '../types';

export interface StoreState {
  cart: CartItem[];
  wishlist: string[];
  orders: Order[];
  addToCart: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  placeOrder: (order: Order) => void;
  cartCount: number;
}

export const StoreContext = createContext<StoreState | null>(null);

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function newOrderId(): string {
  return 'BPS' + Date.now().toString(36).toUpperCase();
}
