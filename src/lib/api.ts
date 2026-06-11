import type { Order, OrderStatus, Product } from '../types';
import { PRODUCTS as SEED_PRODUCTS } from '../data/products';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

// Single data layer for the whole app.
// Connected mode: reads/writes the Supabase database + storage.
// Demo mode (Supabase not connected yet): products live in this browser's
// localStorage, seeded from the bundled demo catalog, so the owner can try
// everything before creating a Supabase account.

const LS_PRODUCTS = 'bps_demo_products';
const LS_ORDERS = 'bps_demo_orders';

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ---------------- row mapping ---------------- */

interface ProductRow {
  id: string;
  brand: string;
  model: string;
  storage: string | null;
  ram: string | null;
  color: string;
  color_hex: string;
  category: string;
  grade: string;
  mrp: number;
  price: number;
  battery_health: number | null;
  stock: number;
  rating: number;
  review_count: number;
  accessories: string[] | null;
  condition_notes: string;
  repairs: string | null;
  has_video: boolean;
  specs: Record<string, string> | null;
  images: string[] | null;
  video_url: string | null;
  imei: string | null;
}

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    brand: r.brand,
    model: r.model,
    storage: r.storage ?? undefined,
    ram: r.ram ?? undefined,
    color: r.color,
    colorHex: r.color_hex,
    category: r.category as Product['category'],
    grade: r.grade as Product['grade'],
    mrp: r.mrp,
    price: r.price,
    batteryHealth: r.battery_health ?? undefined,
    stock: r.stock,
    rating: r.rating,
    reviewCount: r.review_count,
    accessories: r.accessories ?? [],
    conditionNotes: r.condition_notes,
    repairs: r.repairs ?? undefined,
    hasVideo: r.has_video || !!r.video_url,
    specs: r.specs ?? {},
    images: r.images ?? undefined,
    videoUrl: r.video_url ?? undefined,
    imei: r.imei ?? undefined,
  };
}

function productToRow(p: Product): Omit<ProductRow, 'id'> {
  return {
    brand: p.brand,
    model: p.model,
    storage: p.storage ?? null,
    ram: p.ram ?? null,
    color: p.color,
    color_hex: p.colorHex,
    category: p.category,
    grade: p.grade,
    mrp: p.mrp,
    price: p.price,
    battery_health: p.batteryHealth ?? null,
    stock: p.stock,
    rating: p.rating,
    review_count: p.reviewCount,
    accessories: p.accessories,
    condition_notes: p.conditionNotes,
    repairs: p.repairs ?? null,
    has_video: p.hasVideo,
    specs: p.specs,
    images: p.images ?? null,
    video_url: p.videoUrl ?? null,
    imei: p.imei ?? null,
  };
}

/* ---------------- products ---------------- */

export async function fetchProducts(): Promise<Product[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw new Error('Could not load products: ' + error.message);
    return (data as ProductRow[]).map(rowToProduct);
  }
  return loadLocal<Product[]>(LS_PRODUCTS, SEED_PRODUCTS);
}

export async function saveProduct(p: Product): Promise<Product> {
  const sb = getSupabase();
  if (sb) {
    const row = productToRow(p);
    if (p.id && !p.id.startsWith('new-')) {
      const { data, error } = await sb.from('products').update(row).eq('id', p.id).select().single();
      if (error) throw new Error('Could not save: ' + error.message);
      return rowToProduct(data as ProductRow);
    }
    const { data, error } = await sb.from('products').insert(row).select().single();
    if (error) throw new Error('Could not add: ' + error.message);
    return rowToProduct(data as ProductRow);
  }
  const list = loadLocal<Product[]>(LS_PRODUCTS, SEED_PRODUCTS);
  let saved = p;
  let next: Product[];
  if (p.id && !p.id.startsWith('new-') && list.some((x) => x.id === p.id)) {
    next = list.map((x) => (x.id === p.id ? p : x));
  } else {
    saved = { ...p, id: 'local-' + Date.now().toString(36) };
    next = [saved, ...list];
  }
  localStorage.setItem(LS_PRODUCTS, JSON.stringify(next));
  return saved;
}

export async function deleteProduct(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    // Soft delete keeps the listing in past orders' history.
    const { error } = await sb.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw new Error('Could not delete: ' + error.message);
    return;
  }
  const list = loadLocal<Product[]>(LS_PRODUCTS, SEED_PRODUCTS);
  localStorage.setItem(LS_PRODUCTS, JSON.stringify(list.filter((x) => x.id !== id)));
}

/* ---------------- images ---------------- */

export async function uploadProductImage(file: File): Promise<string> {
  const sb = getSupabase();
  if (sb) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from('product-images').upload(path, file, { upsert: false });
    if (error) throw new Error('Image upload failed: ' + error.message);
    return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  }
  // Demo mode: compress to a small data URL stored with the product.
  return compressToDataUrl(file, 800, 0.8);
}

function compressToDataUrl(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image file'));
    };
    img.src = url;
  });
}

/* ---------------- orders ---------------- */

export async function submitOrder(order: Order): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('orders').insert({
      order_code: order.id,
      customer_name: order.address.name,
      phone: order.address.phone,
      address: order.address,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount,
      shipping: order.shipping,
      total: order.total,
      promo_code: order.promoCode ?? null,
      shipping_method: order.shippingMethod,
      payment_method: order.paymentMethod,
      status: 'pending',
      grade_e_ack: order.gradeEAck ?? false,
    });
    if (error) throw new Error('Could not place order: ' + error.message);
    // Decrement stock for each purchased item (best effort).
    for (const item of order.items) {
      await sb.rpc('decrement_stock', { p_id: item.productId, p_qty: item.qty });
    }
    return;
  }
  const list = loadLocal<Order[]>(LS_ORDERS, []);
  localStorage.setItem(LS_ORDERS, JSON.stringify([{ ...order, status: 'pending' }, ...list]));
}

export async function fetchAllOrders(): Promise<Order[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw new Error('Could not load orders: ' + error.message);
    return data.map((r) => ({
      id: r.order_code as string,
      date: r.created_at as string,
      items: r.items,
      subtotal: r.subtotal,
      discount: r.discount,
      shipping: r.shipping,
      total: r.total,
      promoCode: r.promo_code ?? undefined,
      shippingMethod: r.shipping_method,
      paymentMethod: r.payment_method,
      address: r.address,
      status: r.status as OrderStatus,
      gradeEAck: r.grade_e_ack,
    }));
  }
  return loadLocal<Order[]>(LS_ORDERS, []);
}

export async function updateOrderStatus(orderCode: string, status: OrderStatus): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from('orders').update({ status }).eq('order_code', orderCode);
    if (error) throw new Error('Could not update order: ' + error.message);
    return;
  }
  const list = loadLocal<Order[]>(LS_ORDERS, []);
  localStorage.setItem(
    LS_ORDERS,
    JSON.stringify(list.map((o) => (o.id === orderCode ? { ...o, status } : o))),
  );
}

/* ---------------- admin auth ---------------- */

export interface AdminSession {
  email: string;
  isAdmin: boolean;
}

export async function adminSignIn(email: string, password: string): Promise<AdminSession> {
  const sb = getSupabase();
  if (!sb) throw new Error('Connect Supabase first (Admin → Settings)');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return checkAdmin(data.user.id, data.user.email ?? email);
}

export async function adminSignUp(email: string, password: string): Promise<AdminSession> {
  const sb = getSupabase();
  if (!sb) throw new Error('Connect Supabase first (Admin → Settings)');
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Check your email to confirm the account, then sign in.');
  return checkAdmin(data.user.id, email);
}

async function checkAdmin(userId: string, email: string): Promise<AdminSession> {
  const sb = getSupabase()!;
  const { data } = await sb.from('profiles').select('is_admin').eq('id', userId).maybeSingle();
  return { email, isAdmin: !!data?.is_admin };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  if (!data.session) return null;
  return checkAdmin(data.session.user.id, data.session.user.email ?? '');
}

export async function adminSignOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

export function inDemoMode(): boolean {
  return !isSupabaseConfigured();
}
