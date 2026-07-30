import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { buildProducts, COUPONS, REVIEW_SEEDS } from './catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt] = stored.split(':');
  const candidate = Buffer.from(hashPassword(password, salt));
  const expected = Buffer.from(stored);
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      brand TEXT NOT NULL,
      category TEXT NOT NULL,
      category_name TEXT NOT NULL,
      price REAL NOT NULL,
      list_price REAL,
      stock INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      colour TEXT NOT NULL,
      short_description TEXT NOT NULL,
      description TEXT NOT NULL,
      specs TEXT NOT NULL,
      tags TEXT NOT NULL,
      featured_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      rating INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (cart_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      value REAL NOT NULL,
      minimum REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      cart_id TEXT,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      postcode TEXT NOT NULL,
      country TEXT NOT NULL,
      region TEXT,
      delivery_date TEXT,
      shipping_method TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      coupon TEXT,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      shipping REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Processing',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime TEXT,
      cart_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function seed() {
  const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  if (productCount > 0) return;

  const products = buildProducts();
  const insertProduct = db.prepare(`
    INSERT INTO products (id, sku, name, slug, brand, category, category_name, price, list_price,
      stock, rating, review_count, colour, short_description, description, specs, tags, featured_order)
    VALUES (@id, @sku, @name, @slug, @brand, @category, @categoryName, @price, @listPrice,
      @stock, @rating, @reviewCount, @colour, @shortDescription, @description, @specs, @tags, @featuredOrder)
  `);

  const insertReview = db.prepare(
    'INSERT INTO reviews (product_id, author, rating, title, body) VALUES (?, ?, ?, ?, ?)'
  );

  const insertCoupon = db.prepare(
    'INSERT OR REPLACE INTO coupons (code, kind, value, minimum, active) VALUES (@code, @kind, @value, @minimum, @active)'
  );

  const insertUser = db.prepare(
    'INSERT OR IGNORE INTO users (email, name, password, role) VALUES (?, ?, ?, ?)'
  );

  const runSeed = db.transaction(() => {
    products.forEach((product, index) => {
      insertProduct.run({
        ...product,
        specs: JSON.stringify(product.specs),
        tags: JSON.stringify(product.tags),
        featuredOrder: index < 6 ? index + 1 : null
      });

      // Every product gets two or three reviews so the reviews tab is never empty.
      const howMany = 2 + (product.id % 2);
      for (let i = 0; i < howMany; i += 1) {
        const seedReview = REVIEW_SEEDS[(product.id + i) % REVIEW_SEEDS.length];
        insertReview.run(product.id, seedReview.author, seedReview.rating, seedReview.title, seedReview.body);
      }
    });

    COUPONS.forEach((coupon) => insertCoupon.run(coupon));

    insertUser.run('demo@practice.dev', 'Demo Shopper', hashPassword('Password123!'), 'customer');
    insertUser.run('admin@practice.dev', 'Site Admin', hashPassword('Admin123!'), 'admin');
    insertUser.run('locked@practice.dev', 'Locked Account', hashPassword('Password123!'), 'locked');
  });

  runSeed();
}

createSchema();
seed();

export default db;
