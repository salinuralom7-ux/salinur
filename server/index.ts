import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Product, Review } from '../src/types';
import { db, initSchema, isEmpty } from './db';
import { seed } from './seed';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'dist');
const PORT = Number(process.env.PORT ?? 3001);

initSchema();
if (isEmpty()) seed();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/branches', (_req, res) => {
  const rows = db.prepare('SELECT json FROM branches ORDER BY sort').all() as { json: string }[];
  res.json(rows.map((r) => JSON.parse(r.json)));
});

app.get('/api/products', (_req, res) => {
  const rows = db.prepare('SELECT json FROM products ORDER BY sort').all() as { json: string }[];
  res.json(rows.map((r) => JSON.parse(r.json) as Product));
});

app.get('/api/products/:id', (req, res) => {
  const row = db.prepare('SELECT json FROM products WHERE id = ?').get(req.params.id) as
    | { json: string }
    | undefined;
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json(JSON.parse(row.json) as Product);
});

app.get('/api/products/:id/reviews', (req, res) => {
  const rows = db
    .prepare('SELECT product_id, author, rating, verified, text, date FROM reviews WHERE product_id = ? ORDER BY date DESC')
    .all(req.params.id) as Array<Omit<Review, 'verified'> & { product_id: string; verified: number }>;
  const reviews: Review[] = rows.map((r) => ({
    productId: r.product_id,
    author: r.author,
    rating: r.rating,
    verified: r.verified === 1,
    text: r.text,
    date: r.date,
  }));
  res.json(reviews);
});

// Serve the built SPA (production). In dev, Vite serves the frontend and proxies /api here.
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback for any non-API GET (Express 5: avoid bare '*' route patterns).
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      return res.sendFile(join(distDir, 'index.html'));
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`API + app listening on http://localhost:${PORT}`);
});
