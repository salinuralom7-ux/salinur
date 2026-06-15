import type { Branch, Product } from '../types';

/**
 * Branch helpers. The branch list and per-branch stock now come from the
 * backend API (see src/lib/api.ts and src/store/DataContext.tsx); these are
 * pure functions that operate on that fetched data.
 */

/** Sentinel meaning "show inventory pooled across every branch". */
export const ALL_BRANCHES = 'all';

export function isAllBranches(id: string | null | undefined): boolean {
  return id === ALL_BRANCHES || !id;
}

export function getBranch(branches: Branch[], id: string | null | undefined): Branch | undefined {
  if (!id) return undefined;
  return branches.find((b) => b.id === id);
}

/**
 * Stock for a product at the given branch. `null`/`undefined`/`'all'` returns
 * the pooled total across every branch. Reads the `branchStock` map the API
 * provides for each product.
 */
export function stockAt(product: Product, branchId: string | null | undefined): number {
  if (isAllBranches(branchId)) return product.stock;
  return product.branchStock?.[branchId as string] ?? 0;
}

/** Branches (other than the active one) that currently carry this product. */
export function otherBranchesWithStock(
  branches: Branch[],
  product: Product,
  branchId: string | null | undefined,
): Branch[] {
  return branches.filter((b) => b.id !== branchId && (product.branchStock?.[b.id] ?? 0) > 0);
}

export function telLink(branch: Branch): string {
  return `tel:${branch.phone}`;
}

export function whatsappLink(branch: Branch, message: string): string {
  return `https://wa.me/${branch.whatsapp}?text=${encodeURIComponent(message)}`;
}
