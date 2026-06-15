import type { Branch, Product } from '../types';

/**
 * Store branches. Edit this list to add, remove or update branches.
 *
 * `phone`     — tel-dialable, keep the country code (+91…).
 * `whatsapp`  — digits only (no +, spaces or dashes) for wa.me links.
 * `mapUrl`    — paste a Google Maps share link for the branch.
 *
 * The numbers below are placeholders — replace them with your real
 * branch phone/WhatsApp numbers before going live.
 */
export const BRANCHES: Branch[] = [
  {
    id: 'bongaigaon',
    name: 'Budget Phone Store — Bongaigaon (Main)',
    city: 'Bongaigaon',
    area: 'Main Branch',
    address: 'Barpara Main Road, near Ganesh Mandir, Bongaigaon, Assam 783380',
    phone: '+919876500001',
    whatsapp: '919876500001',
    hours: 'Mon–Sat 10:00 AM – 8:00 PM · Sun 11:00 AM – 6:00 PM',
    mapUrl: 'https://maps.google.com/?q=Bongaigaon+Assam',
    landmark: 'Opposite SBI main branch',
  },
  {
    id: 'guwahati',
    name: 'Budget Phone Store — Guwahati',
    city: 'Guwahati',
    area: 'Fancy Bazar',
    address: 'HB Road, Fancy Bazar, Guwahati, Assam 781001',
    phone: '+919876500002',
    whatsapp: '919876500002',
    hours: 'Mon–Sat 10:30 AM – 8:30 PM · Sun closed',
    mapUrl: 'https://maps.google.com/?q=Fancy+Bazar+Guwahati+Assam',
    landmark: 'Near Fancy Bazar bus stop',
  },
  {
    id: 'barpeta',
    name: 'Budget Phone Store — Barpeta Road',
    city: 'Barpeta Road',
    area: 'Town Centre',
    address: 'Station Road, Barpeta Road, Assam 781315',
    phone: '+919876500003',
    whatsapp: '919876500003',
    hours: 'Mon–Sat 10:00 AM – 7:30 PM · Sun 11:00 AM – 5:00 PM',
    mapUrl: 'https://maps.google.com/?q=Barpeta+Road+Assam',
    landmark: 'Beside the railway station gate',
  },
];

/** Sentinel meaning "show inventory pooled across every branch". */
export const ALL_BRANCHES = 'all';

export function getBranch(id: string | null | undefined): Branch | undefined {
  if (!id) return undefined;
  return BRANCHES.find((b) => b.id === id);
}

export function isAllBranches(id: string | null | undefined): boolean {
  return id === ALL_BRANCHES || !id;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const distCache = new Map<string, Record<string, number>>();

/**
 * Stock for a product at every branch. Uses an explicit `branchStock` map
 * when the product provides one; otherwise deterministically distributes the
 * total `stock` across branches so the per-branch numbers always sum to it.
 */
export function branchDistribution(product: Product): Record<string, number> {
  if (product.branchStock) return product.branchStock;
  const cached = distCache.get(product.id);
  if (cached) return cached;

  const dist: Record<string, number> = {};
  for (const b of BRANCHES) dist[b.id] = 0;
  for (let unit = 0; unit < product.stock; unit++) {
    const idx = hashStr(`${product.id}:${unit}`) % BRANCHES.length;
    dist[BRANCHES[idx].id]++;
  }
  distCache.set(product.id, dist);
  return dist;
}

/**
 * Stock for a product at the given branch. `null`/`undefined`/`'all'` returns
 * the pooled total across every branch.
 */
export function stockAt(product: Product, branchId: string | null | undefined): number {
  if (isAllBranches(branchId)) return product.stock;
  return branchDistribution(product)[branchId as string] ?? 0;
}

/** Branches (other than the active one) that currently carry this product. */
export function otherBranchesWithStock(product: Product, branchId: string | null | undefined): Branch[] {
  const dist = branchDistribution(product);
  return BRANCHES.filter((b) => b.id !== branchId && (dist[b.id] ?? 0) > 0);
}

export function telLink(branch: Branch): string {
  return `tel:${branch.phone}`;
}

export function whatsappLink(branch: Branch, message: string): string {
  return `https://wa.me/${branch.whatsapp}?text=${encodeURIComponent(message)}`;
}
