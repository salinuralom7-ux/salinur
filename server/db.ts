import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH ?? join(here, 'data.sqlite');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id       TEXT PRIMARY KEY,
      sort     INTEGER NOT NULL,
      json     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id       TEXT PRIMARY KEY,
      sort     INTEGER NOT NULL,
      brand    TEXT NOT NULL,
      category TEXT NOT NULL,
      grade    TEXT NOT NULL,
      price    INTEGER NOT NULL,
      stock    INTEGER NOT NULL,
      json     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      product_id TEXT NOT NULL,
      author     TEXT NOT NULL,
      rating     INTEGER NOT NULL,
      verified   INTEGER NOT NULL,
      text       TEXT NOT NULL,
      date       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
  `);
}

export function isEmpty(): boolean {
  const row = db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number };
  return row.n === 0;
}
