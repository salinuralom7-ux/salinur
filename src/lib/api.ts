import type { Branch, Product, Review } from '../types';

// Same-origin in production (Express serves the app) and via Vite's /api proxy
// in dev. Override with VITE_API_BASE if the API lives elsewhere.
const BASE = import.meta.env.VITE_API_BASE ?? '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${path} (${res.status})`);
  return (await res.json()) as T;
}

export const api = {
  branches: () => get<Branch[]>('/api/branches'),
  products: () => get<Product[]>('/api/products'),
  product: (id: string) => get<Product>(`/api/products/${id}`),
  reviews: (id: string) => get<Review[]>(`/api/products/${id}/reviews`),
};
