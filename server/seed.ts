import type { Product } from '../src/types';
import { PRODUCTS, REVIEWS } from '../src/data/products';
import { BRANCH_SEED } from './data/branches';
import { db, initSchema } from './db';

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Split a product's total stock across branches deterministically. */
function distribute(product: Product): Record<string, number> {
  if (product.branchStock) return product.branchStock;
  const dist: Record<string, number> = {};
  for (const b of BRANCH_SEED) dist[b.id] = 0;
  for (let unit = 0; unit < product.stock; unit++) {
    const idx = hashStr(`${product.id}:${unit}`) % BRANCH_SEED.length;
    dist[BRANCH_SEED[idx].id]++;
  }
  return dist;
}

export function seed(): void {
  initSchema();

  const wipe = db.transaction(() => {
    db.exec('DELETE FROM branches; DELETE FROM products; DELETE FROM reviews;');

    const insBranch = db.prepare('INSERT INTO branches (id, sort, json) VALUES (?, ?, ?)');
    BRANCH_SEED.forEach((b, i) => insBranch.run(b.id, i, JSON.stringify(b)));

    const insProduct = db.prepare(
      'INSERT INTO products (id, sort, brand, category, grade, price, stock, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    PRODUCTS.forEach((p, i) => {
      const withStock: Product = { ...p, branchStock: distribute(p) };
      insProduct.run(p.id, i, p.brand, p.category, p.grade, p.price, p.stock, JSON.stringify(withStock));
    });

    const insReview = db.prepare(
      'INSERT INTO reviews (product_id, author, rating, verified, text, date) VALUES (?, ?, ?, ?, ?, ?)',
    );
    REVIEWS.forEach((r) =>
      insReview.run(r.productId, r.author, r.rating, r.verified ? 1 : 0, r.text, r.date),
    );
  });
  wipe();

  console.log(
    `Seeded ${BRANCH_SEED.length} branches, ${PRODUCTS.length} products, ${REVIEWS.length} reviews.`,
  );
}

// Allow running directly: `tsx server/seed.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}
