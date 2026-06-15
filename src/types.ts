export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

export type Category = 'iphone' | 'android' | 'accessory';

export interface Branch {
  id: string;
  name: string;
  city: string;
  area: string;
  address: string;
  /** Tel-dialable number, e.g. +919876500001 */
  phone: string;
  /** Digits only for wa.me links, e.g. 919876500001 */
  whatsapp: string;
  hours: string;
  /** Google Maps directions link */
  mapUrl: string;
  landmark?: string;
}

export interface Product {
  id: string;
  brand: string;
  model: string;
  storage?: string;
  ram?: string;
  color: string;
  colorHex: string;
  category: Category;
  grade: Grade;
  mrp: number;
  price: number;
  batteryHealth?: number;
  /** Total stock across all branches. */
  stock: number;
  /**
   * Optional explicit stock per branch id. When omitted, the total `stock`
   * is split across branches deterministically (see stockAt in data/branches).
   */
  branchStock?: Record<string, number>;
  rating: number;
  reviewCount: number;
  accessories: string[];
  conditionNotes: string;
  repairs?: string;
  hasVideo: boolean;
  specs: Record<string, string>;
}

export interface GradeInfo {
  grade: Grade;
  name: string;
  label: string;
  color: string;
  warrantyMonths: number;
  warrantyNote: string;
  discountRange: string;
  description: string;
  points: string[];
}

export interface CartItem {
  productId: string;
  qty: number;
}

export interface Review {
  productId: string;
  author: string;
  rating: number;
  verified: boolean;
  text: string;
  date: string;
}

export interface Address {
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderItem {
  productId: string;
  qty: number;
  price: number;
  grade: Grade;
  title: string;
  warrantyMonths: number;
}

export interface Order {
  id: string;
  date: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  promoCode?: string;
  shippingMethod: 'standard' | 'express';
  paymentMethod: string;
  address: Address;
}
