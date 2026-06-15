import type { Branch, Product, Review } from '../types';
import { EMBEDDED_BRANCHES, EMBEDDED_PRODUCTS, EMBEDDED_REVIEWS } from '../data/embedded';

// Standalone single-file build (no backend): serve the baked-in snapshot.
// In the normal build this constant folds to false and the embedded data is
// tree-shaken out of the bundle.
const STANDALONE = import.meta.env.VITE_STANDALONE === 'true';

// Same-origin in production (Express serves the app) and via Vite's /api proxy
// in dev. Override with VITE_API_BASE if the API lives elsewhere.
const BASE = import.meta.env.VITE_API_BASE ?? '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${path} (${res.status})`);
  return (await res.json()) as T;
}

export const api = {
  branches: (): Promise<Branch[]> =>
    STANDALONE ? Promise.resolve(EMBEDDED_BRANCHES) : get<Branch[]>('/api/branches'),
  products: (): Promise<Product[]> =>
    STANDALONE ? Promise.resolve(EMBEDDED_PRODUCTS) : get<Product[]>('/api/products'),
  product: (id: string): Promise<Product> =>
    STANDALONE
      ? Promise.resolve(EMBEDDED_PRODUCTS.find((p) => p.id === id) as Product)
      : get<Product>(`/api/products/${id}`),
  reviews: (id: string): Promise<Review[]> =>
    STANDALONE
      ? Promise.resolve(EMBEDDED_REVIEWS.filter((r) => r.productId === id))
      : get<Review[]>(`/api/products/${id}/reviews`),
};
