export type Role = 'customer' | 'vendor' | 'admin';

export type Category = 'photography' | 'catering' | 'decor' | 'makeup' | 'venue' | 'music' | 'mehndi' | 'other';

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email?: string;
}

export interface VendorPackage {
  title: string;
  price: number; // rupees
}

export interface Vendor {
  id: string; // = owner user id
  businessName: string;
  category: Category;
  city: string;
  phone: string;
  bio: string;
  packages: VendorPackage[];
  photos: string[];
  rating: number;
  reviewCount: number;
  status: 'pending' | 'approved' | 'suspended';
  createdAt: string;
}

export type QuoteStatus = 'open' | 'quoted' | 'accepted' | 'declined';

export interface Quotation {
  id: string;
  customerId: string;
  customerName: string;
  vendorId: string;
  vendorName: string;
  category: Category;
  eventDate: string; // YYYY-MM-DD
  city: string;
  requirements: string;
  status: QuoteStatus;
  price?: number;
  note?: string;
  createdAt: string;
}

export type BookingStatus = 'advance_pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  quotationId: string;
  customerId: string;
  customerName: string;
  vendorId: string;
  vendorName: string;
  category: Category;
  eventDate: string;
  amount: number;
  commissionRate: number;
  commission: number;
  vendorPayout: number;
  status: BookingStatus;
  createdAt: string;
}

export interface Message {
  id: string;
  quotationId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface Review {
  id: string; // = bookingId
  vendorId: string;
  customerId: string;
  customerName: string;
  rating: number;
  text: string;
  createdAt: string;
}

export const CATEGORIES: { id: Category; label: string; ico: string }[] = [
  { id: 'photography', label: 'Photography', ico: '📷' },
  { id: 'catering', label: 'Catering', ico: '🍛' },
  { id: 'decor', label: 'Decor', ico: '🌸' },
  { id: 'makeup', label: 'Makeup', ico: '💄' },
  { id: 'venue', label: 'Venue', ico: '🏛️' },
  { id: 'music', label: 'Music & DJ', ico: '🥁' },
  { id: 'mehndi', label: 'Mehndi', ico: '🤲' },
  { id: 'other', label: 'Other', ico: '✨' },
];

export const COMMISSION_RATE = 0.15;

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN');

export const catLabel = (c: Category) => CATEGORIES.find((x) => x.id === c)?.label ?? c;
export const catIco = (c: Category) => CATEGORIES.find((x) => x.id === c)?.ico ?? '✨';
