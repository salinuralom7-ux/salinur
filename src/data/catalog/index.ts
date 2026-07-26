import type { PhoneModel } from '../../types';
import { APPLE } from './apple';
import { SAMSUNG } from './samsung';
import { XIAOMI } from './xiaomi';
import { ANDROID } from './android';

/** Every model we deal in, newest first. */
export const MODELS: PhoneModel[] = [...APPLE, ...SAMSUNG, ...XIAOMI, ...ANDROID].sort(
  (a, b) => b.year - a.year || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name),
);

export const MODELS_BY_ID: Map<string, PhoneModel> = new Map(MODELS.map((m) => [m.id, m]));

export interface BrandInfo {
  name: string;
  slug: string;
  modelCount: number;
  /** Cheapest Superb price across the brand, used for "from ₹x" on brand tiles. */
  fromPrice: number;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export const BRANDS: BrandInfo[] = (() => {
  const map = new Map<string, { count: number; from: number }>();
  for (const model of MODELS) {
    const cheapest = Math.min(...model.storage.map(([, , price]) => price));
    const entry = map.get(model.brand);
    if (entry) {
      entry.count += 1;
      entry.from = Math.min(entry.from, cheapest);
    } else {
      map.set(model.brand, { count: 1, from: cheapest });
    }
  }
  return [...map.entries()]
    .map(([name, { count, from }]) => ({
      name,
      slug: slug(name),
      modelCount: count,
      fromPrice: from,
    }))
    .sort((a, b) => b.modelCount - a.modelCount || a.name.localeCompare(b.name));
})();

export const BRANDS_BY_SLUG: Map<string, BrandInfo> = new Map(BRANDS.map((b) => [b.slug, b]));

export function brandSlug(brand: string): string {
  return slug(brand);
}
