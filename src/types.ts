/** Cosmetic and functional condition of a used handset, best to worst. */
export type Condition = 'superb' | 'excellent' | 'good' | 'moderate';

export interface ConditionInfo {
  id: Condition;
  name: string;
  headline: string;
  /** Rank used for sorting — 0 is the best condition we sell. */
  rank: number;
  color: string;
  /** Multiplier applied to a model's reference price to get this condition's price. */
  priceFactor: number;
  warrantyMonths: number;
  batteryRange: [number, number];
  description: string;
  points: string[];
  accessories: string;
}

export interface ColorOption {
  /** Slug used in listing ids and URLs. */
  id: string;
  name: string;
  hex: string;
  /** Second hex for two-tone or gradient finishes. */
  hex2?: string;
}

/**
 * One storage tier of a model.
 * Tuple form keeps the catalog readable: [capacity in GB, original MRP, our reference price].
 * The reference price is what we charge for that capacity in Superb condition.
 */
export type StorageTier = [gb: number, mrp: number, referencePrice: number];

export interface PhoneModel {
  id: string;
  brand: string;
  name: string;
  /** Marketing family, e.g. 'iPhone 15 Series' — used for grouping on brand pages. */
  series: string;
  /** Year of Indian launch. */
  year: number;
  /** Colour names as the manufacturer sold them. */
  colors: string[];
  storage: StorageTier[];
  ram: string;
  specs: Record<string, string>;
  /** Short editorial line shown on the product page. */
  blurb: string;
  fiveG: boolean;
}

/**
 * A concrete thing a customer can put in the cart: one model, in one storage
 * capacity, one colour and one condition. Generated from the catalog rather
 * than hand-written, because the combinations run into the tens of thousands.
 */
export interface Listing {
  id: string;
  modelId: string;
  brand: string;
  model: string;
  series: string;
  year: number;
  storageGb: number;
  color: ColorOption;
  condition: Condition;
  mrp: number;
  price: number;
  batteryHealth: number;
  /** Units of this exact configuration currently on the shelf. */
  stock: number;
  warrantyMonths: number;
  rating: number;
  reviewCount: number;
  conditionNotes: string;
  repairs?: string;
  accessories: string[];
  ram: string;
  fiveG: boolean;
  /** Stable per-unit reference the shop uses when pulling the handset off the shelf. */
  unitRef: string;
}

export interface CartItem {
  listingId: string;
  qty: number;
}

export type PaymentMode = 'prepaid' | 'cod';

export interface Address {
  name: string;
  phone: string;
  email: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface OrderItem {
  listingId: string;
  title: string;
  qty: number;
  price: number;
  condition: Condition;
  warrantyMonths: number;
  unitRef: string;
}

/** Everything money-related about an order, computed in one place. */
export interface OrderTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  /** Paid online now. Equals total for prepaid orders. */
  payNow: number;
  /** Collected in cash on delivery. Zero for prepaid orders. */
  balanceDue: number;
  /** Minimum online booking charge allowed for this order under COD. */
  minBooking: number;
}

export interface PaymentRecord {
  provider: 'razorpay' | 'test';
  orderId: string;
  paymentId: string;
  signature?: string;
  amount: number;
  verified: boolean;
  at: string;
}

export type OrderStatus = 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  date: string;
  items: OrderItem[];
  totals: OrderTotals;
  promoCode?: string;
  shippingMethod: 'standard' | 'express';
  paymentMode: PaymentMode;
  payment: PaymentRecord;
  address: Address;
  status: OrderStatus;
}

/** A customer asking to see photographs of the actual handset before buying. */
export interface PhotoRequest {
  id: string;
  listingId: string;
  title: string;
  unitRef: string;
  name: string;
  phone: string;
  note?: string;
  at: string;
}

export interface Review {
  modelId: string;
  author: string;
  city: string;
  rating: number;
  condition: Condition;
  verified: boolean;
  text: string;
  date: string;
}
