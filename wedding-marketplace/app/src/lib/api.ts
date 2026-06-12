import type {
  Booking, Category, Message, Quotation, Review, Role, SessionUser, Vendor,
} from '../types';
import { COMMISSION_RATE } from '../types';
import { getSupabase, isConfigured } from './supabase';
import { SEED_VENDORS } from './seed';

/* ====================================================================
   Single data layer.
   Connected mode: Supabase (auth + tables + RLS + RPCs).
   Demo mode: localStorage, seeded — so the owner can explore everything
   before creating a Supabase account.
==================================================================== */

export const inDemoMode = () => !isConfigured();

const LS = {
  vendors: 'ss_vendors',
  quotes: 'ss_quotes2',
  bookings: 'ss_bookings',
  messages: 'ss_messages2',
  reviews: 'ss_reviews',
  session: 'ss_demo_session',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const save = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v));
const newId = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------------- row mapping (snake_case <-> camelCase) ---------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
const vendorFromRow = (r: any): Vendor => ({
  id: r.id, businessName: r.business_name, category: r.category, city: r.city,
  phone: r.phone ?? '', bio: r.bio ?? '', packages: r.packages ?? [], photos: r.photos ?? [],
  rating: Number(r.rating ?? 0), reviewCount: r.review_count ?? 0, status: r.status,
  createdAt: r.created_at,
});
const quoteFromRow = (r: any): Quotation => ({
  id: r.id, customerId: r.customer_id, customerName: r.customer_name,
  vendorId: r.vendor_id, vendorName: r.vendor_name, category: r.category,
  eventDate: r.event_date, city: r.city, requirements: r.requirements,
  status: r.status, price: r.price ?? undefined, note: r.note ?? undefined,
  createdAt: r.created_at,
});
const bookingFromRow = (r: any): Booking => ({
  id: r.id, quotationId: r.quotation_id, customerId: r.customer_id, customerName: r.customer_name,
  vendorId: r.vendor_id, vendorName: r.vendor_name, category: r.category, eventDate: r.event_date,
  amount: r.amount, commissionRate: Number(r.commission_rate), commission: r.commission,
  vendorPayout: r.vendor_payout, status: r.status, createdAt: r.created_at,
});
const messageFromRow = (r: any): Message => ({
  id: r.id, quotationId: r.quotation_id, senderId: r.sender_id,
  senderName: r.sender_name, text: r.text, createdAt: r.created_at,
});
const reviewFromRow = (r: any): Review => ({
  id: r.id, vendorId: r.vendor_id, customerId: r.customer_id, customerName: r.customer_name,
  rating: r.rating, text: r.text ?? '', createdAt: r.created_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ---------------- auth / session ---------------- */

export function setDemoUser(role: Role): SessionUser {
  const user: SessionUser =
    role === 'customer' ? { id: 'demo-customer', role, name: 'Priya & Rohit' }
    : role === 'vendor' ? { id: 'demo-vendor', role, name: 'Arjun Photography' }
    : { id: 'demo-admin', role, name: 'Platform Owner' };
  save(LS.session, user);
  return user;
}

export async function getSession(): Promise<SessionUser | null> {
  const sb = getSupabase();
  if (!sb) return load<SessionUser | null>(LS.session, null);
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;
  const uid = data.session.user.id;
  const { data: profile } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (!profile) return null;
  return { id: uid, role: profile.role, name: profile.name, email: data.session.user.email ?? undefined };
}

const LS_PENDING_PROFILE = 'ss_pending_profile';

export async function signUp(email: string, password: string, role: Role, name: string): Promise<SessionUser> {
  const sb = getSupabase();
  if (!sb) throw new Error('Connect Supabase first (demo mode uses the demo accounts)');
  if (role === 'admin') throw new Error('Admin role cannot be self-assigned');
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Check your email to confirm, then sign in.');
  // If email confirmation is on, there is no session yet and RLS blocks the
  // profile insert — remember the choice and finish it at first sign-in.
  save(LS_PENDING_PROFILE, { role, name });
  if (data.session) {
    await ensureProfile(role, name);
    const session = await getSession();
    if (session) return session;
  }
  throw new Error('Account created — check your email to confirm it, then sign in here.');
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const sb = getSupabase();
  if (!sb) throw new Error('Connect Supabase first (demo mode uses the demo accounts)');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  // Complete the profile if sign-up happened before email confirmation.
  const pending = load<{ role: Role; name: string } | null>(LS_PENDING_PROFILE, null);
  await ensureProfile(pending?.role ?? 'customer', pending?.name ?? email.split('@')[0]);
  localStorage.removeItem(LS_PENDING_PROFILE);
  const session = await getSession();
  if (!session) throw new Error('Profile missing — contact support');
  return session;
}

async function ensureProfile(role: Role, name: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  if (!data.user) return;
  const { data: existing } = await sb.from('profiles').select('id').eq('id', data.user.id).maybeSingle();
  if (existing) return;
  const { error } = await sb.from('profiles').insert({ id: data.user.id, role, name });
  if (error && !error.message.includes('duplicate')) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
  localStorage.removeItem(LS.session);
}

/* ---------------- vendors ---------------- */

export async function listApprovedVendors(filter?: { category?: Category; city?: string; q?: string }): Promise<Vendor[]> {
  const sb = getSupabase();
  let vendors: Vendor[];
  if (sb) {
    const { data, error } = await sb.from('vendors').select('*').eq('status', 'approved');
    if (error) throw new Error(error.message);
    vendors = data.map(vendorFromRow);
  } else {
    vendors = load<Vendor[]>(LS.vendors, SEED_VENDORS).filter((v) => v.status === 'approved');
  }
  if (filter?.category) vendors = vendors.filter((v) => v.category === filter.category);
  if (filter?.city) vendors = vendors.filter((v) => v.city.toLowerCase().includes(filter.city!.toLowerCase()));
  if (filter?.q) {
    const q = filter.q.toLowerCase();
    vendors = vendors.filter((v) => `${v.businessName} ${v.city} ${v.category} ${v.bio}`.toLowerCase().includes(q));
  }
  return vendors.sort((a, b) => b.rating - a.rating);
}

export async function getVendor(id: string): Promise<Vendor | null> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from('vendors').select('*').eq('id', id).maybeSingle();
    return data ? vendorFromRow(data) : null;
  }
  return load<Vendor[]>(LS.vendors, SEED_VENDORS).find((v) => v.id === id) ?? null;
}

export async function saveVendorProfile(user: SessionUser, v: Omit<Vendor, 'id' | 'rating' | 'reviewCount' | 'status' | 'createdAt'>): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const existing = await getVendor(user.id);
    const row = {
      id: user.id, business_name: v.businessName, category: v.category, city: v.city,
      phone: v.phone, bio: v.bio, packages: v.packages, photos: v.photos,
    };
    const { error } = existing
      ? await sb.from('vendors').update(row).eq('id', user.id)
      : await sb.from('vendors').insert({ ...row, status: 'pending' });
    if (error) throw new Error(error.message);
    return;
  }
  const vendors = load<Vendor[]>(LS.vendors, SEED_VENDORS);
  const existing = vendors.find((x) => x.id === user.id);
  if (existing) {
    Object.assign(existing, v);
  } else {
    vendors.unshift({
      ...v, id: user.id, rating: 0, reviewCount: 0,
      status: 'pending', createdAt: new Date().toISOString(),
    });
  }
  save(LS.vendors, vendors);
}

/* ---------------- quotations ---------------- */

export async function createQuotation(
  user: SessionUser, vendor: Vendor,
  q: { eventDate: string; city: string; requirements: string },
): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('quotations').insert({
      customer_id: user.id, customer_name: user.name,
      vendor_id: vendor.id, vendor_name: vendor.businessName, category: vendor.category,
      event_date: q.eventDate, city: q.city, requirements: q.requirements, status: 'open',
    });
    if (error) throw new Error(error.message);
    return;
  }
  const quotes = load<Quotation[]>(LS.quotes, []);
  quotes.unshift({
    id: newId('q'), customerId: user.id, customerName: user.name,
    vendorId: vendor.id, vendorName: vendor.businessName, category: vendor.category,
    eventDate: q.eventDate, city: q.city, requirements: q.requirements,
    status: 'open', createdAt: new Date().toISOString(),
  });
  save(LS.quotes, quotes);
}

export async function listQuotations(user: SessionUser): Promise<Quotation[]> {
  const sb = getSupabase();
  if (sb) {
    const col = user.role === 'vendor' ? 'vendor_id' : 'customer_id';
    const query = user.role === 'admin'
      ? sb.from('quotations').select('*')
      : sb.from('quotations').select('*').eq(col, user.id);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(quoteFromRow);
  }
  const all = load<Quotation[]>(LS.quotes, []);
  if (user.role === 'admin') return all;
  return all.filter((q) => (user.role === 'vendor' ? q.vendorId === user.id : q.customerId === user.id));
}

export async function sendQuote(quoteId: string, price: number, note: string): Promise<void> {
  if (!price || price < 100) throw new Error('Enter a valid price (₹100 minimum)');
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('quotations')
      .update({ price, note, status: 'quoted' })
      .eq('id', quoteId).eq('status', 'open');
    if (error) throw new Error(error.message);
    return;
  }
  const quotes = load<Quotation[]>(LS.quotes, []);
  const q = quotes.find((x) => x.id === quoteId);
  if (!q || q.status !== 'open') throw new Error('This enquiry is no longer open');
  q.price = price; q.note = note; q.status = 'quoted';
  save(LS.quotes, quotes);
}

export async function declineQuote(quoteId: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('quotations').update({ status: 'declined' }).eq('id', quoteId);
    if (error) throw new Error(error.message);
    return;
  }
  const quotes = load<Quotation[]>(LS.quotes, []);
  const q = quotes.find((x) => x.id === quoteId);
  if (q) { q.status = 'declined'; save(LS.quotes, quotes); }
}

/* ---------------- bookings ---------------- */

export async function acceptQuote(quoteId: string): Promise<Booking> {
  const sb = getSupabase();
  if (sb) {
    // Server-side RPC validates the transition and computes the commission.
    const { data, error } = await sb.rpc('accept_quote', { p_quote_id: quoteId });
    if (error) throw new Error(error.message);
    return bookingFromRow(data);
  }
  const quotes = load<Quotation[]>(LS.quotes, []);
  const q = quotes.find((x) => x.id === quoteId);
  if (!q || q.status !== 'quoted' || !q.price) throw new Error('Quote is not acceptable');
  q.status = 'accepted';
  save(LS.quotes, quotes);
  const commission = Math.round(q.price * COMMISSION_RATE);
  const booking: Booking = {
    id: newId('b'), quotationId: q.id,
    customerId: q.customerId, customerName: q.customerName,
    vendorId: q.vendorId, vendorName: q.vendorName,
    category: q.category, eventDate: q.eventDate, amount: q.price,
    commissionRate: COMMISSION_RATE, commission, vendorPayout: q.price - commission,
    status: 'advance_pending', createdAt: new Date().toISOString(),
  };
  const bookings = load<Booking[]>(LS.bookings, []);
  bookings.unshift(booking);
  save(LS.bookings, bookings);
  return booking;
}

export async function listBookings(user: SessionUser): Promise<Booking[]> {
  const sb = getSupabase();
  if (sb) {
    const base = sb.from('bookings').select('*');
    const query = user.role === 'admin' ? base
      : base.eq(user.role === 'vendor' ? 'vendor_id' : 'customer_id', user.id);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(bookingFromRow);
  }
  const all = load<Booking[]>(LS.bookings, []);
  if (user.role === 'admin') return all;
  return all.filter((b) => (user.role === 'vendor' ? b.vendorId === user.id : b.customerId === user.id));
}

export async function setBookingStatus(bookingId: string, status: Booking['status']): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('bookings').update({ status }).eq('id', bookingId);
    if (error) throw new Error(error.message);
    return;
  }
  const bookings = load<Booking[]>(LS.bookings, []);
  const b = bookings.find((x) => x.id === bookingId);
  if (b) { b.status = status; save(LS.bookings, bookings); }
}

/* ---------------- messages ---------------- */

export async function listMessages(quotationId: string): Promise<Message[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('messages').select('*')
      .eq('quotation_id', quotationId).order('created_at');
    if (error) throw new Error(error.message);
    return data.map(messageFromRow);
  }
  return load<Message[]>(LS.messages, []).filter((m) => m.quotationId === quotationId);
}

export async function sendMessage(user: SessionUser, quotationId: string, text: string): Promise<void> {
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return;
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('messages').insert({
      quotation_id: quotationId, sender_id: user.id, sender_name: user.name, text: trimmed,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const messages = load<Message[]>(LS.messages, []);
  messages.push({
    id: newId('m'), quotationId, senderId: user.id, senderName: user.name,
    text: trimmed, createdAt: new Date().toISOString(),
  });
  save(LS.messages, messages);
}

export function subscribeMessages(quotationId: string, onNew: () => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const channel = sb.channel('msgs-' + quotationId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `quotation_id=eq.${quotationId}` },
      onNew)
    .subscribe();
  return () => { void sb.removeChannel(channel); };
}

/* ---------------- reviews ---------------- */

export async function listReviews(vendorId: string): Promise<Review[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('reviews').select('*')
      .eq('vendor_id', vendorId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(reviewFromRow);
  }
  return load<Review[]>(LS.reviews, []).filter((r) => r.vendorId === vendorId);
}

export async function submitReview(user: SessionUser, bookingId: string, rating: number, text: string): Promise<void> {
  if (rating < 1 || rating > 5) throw new Error('Rating must be 1–5');
  const sb = getSupabase();
  if (sb) {
    // RPC validates the completed booking + updates the vendor's average.
    const { error } = await sb.rpc('submit_review', {
      p_booking_id: bookingId, p_rating: rating, p_text: text.slice(0, 2000),
    });
    if (error) throw new Error(error.message);
    return;
  }
  const bookings = load<Booking[]>(LS.bookings, []);
  const b = bookings.find((x) => x.id === bookingId);
  if (!b || b.customerId !== user.id) throw new Error('Not your booking');
  if (b.status !== 'completed') throw new Error('You can review after the event is completed');
  const reviews = load<Review[]>(LS.reviews, []);
  if (reviews.some((r) => r.id === bookingId)) throw new Error('Already reviewed');
  reviews.unshift({
    id: bookingId, vendorId: b.vendorId, customerId: user.id, customerName: user.name,
    rating, text: text.slice(0, 2000), createdAt: new Date().toISOString(),
  });
  save(LS.reviews, reviews);
  const vendors = load<Vendor[]>(LS.vendors, SEED_VENDORS);
  const v = vendors.find((x) => x.id === b.vendorId);
  if (v) {
    const newCount = v.reviewCount + 1;
    v.rating = Math.round(((v.rating * v.reviewCount + rating) / newCount) * 10) / 10;
    v.reviewCount = newCount;
    save(LS.vendors, vendors);
  }
}

/* ---------------- admin ---------------- */

export async function listAllVendors(): Promise<Vendor[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('vendors').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(vendorFromRow);
  }
  return load<Vendor[]>(LS.vendors, SEED_VENDORS);
}

export async function setVendorStatus(vendorId: string, status: Vendor['status']): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('vendors').update({ status }).eq('id', vendorId);
    if (error) throw new Error(error.message);
    return;
  }
  const vendors = load<Vendor[]>(LS.vendors, SEED_VENDORS);
  const v = vendors.find((x) => x.id === vendorId);
  if (v) { v.status = status; save(LS.vendors, vendors); }
}
