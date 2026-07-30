import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { db, hashPassword, verifyPassword } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(here, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Every endpoint can be slowed down on purpose. Some of the UI calls below ask
// for a delay so that spinners, skeletons and stale elements are reproducible
// instead of being a race you win by accident.
app.use(async (req, _res, next) => {
  const requested = Number(req.query.delay || 0);
  const base = Number(process.env.BASE_LATENCY_MS || 120);
  await wait(Math.min(Math.max(requested, 0), 10000) + base);
  next();
});

/* ------------------------------------------------------------------ helpers */

const SHIPPING = {
  standard: { label: 'Standard (3-5 days)', cost: 4.99, freeOver: 100 },
  express: { label: 'Express (next day)', cost: 14.99, freeOver: Infinity },
  pickup: { label: 'Collect in store', cost: 0, freeOver: 0 }
};

const TAX_RATE = 0.08;

function money(value) {
  return Number(value.toFixed(2));
}

function rowToProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    slug: row.slug,
    brand: row.brand,
    category: row.category,
    categoryName: row.category_name,
    price: row.price,
    listPrice: row.list_price,
    stock: row.stock,
    rating: row.rating,
    reviewCount: row.review_count,
    colour: row.colour,
    shortDescription: row.short_description,
    description: row.description,
    specs: JSON.parse(row.specs),
    tags: JSON.parse(row.tags),
    featuredOrder: row.featured_order
  };
}

function currentUser(req) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  return db
    .prepare(
      `SELECT users.id, users.email, users.name, users.role
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`
    )
    .get(token) || null;
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: 'You need to sign in to do that.' });
    return null;
  }
  return user;
}

function cartId(req) {
  return req.get('x-cart-id') || req.query.cartId || null;
}

function cartRows(id) {
  if (!id) return [];
  return db
    .prepare(
      `SELECT cart_items.id, cart_items.quantity, products.*
       FROM cart_items JOIN products ON products.id = cart_items.product_id
       WHERE cart_items.cart_id = ?
       ORDER BY cart_items.added_at ASC, cart_items.id ASC`
    )
    .all(id)
    .map((row) => ({
      lineId: row.id,
      quantity: row.quantity,
      lineTotal: money(row.price * row.quantity),
      product: rowToProduct(row)
    }));
}

function cartSummary(id, couponCode = null, shippingMethod = 'standard') {
  const items = cartRows(id);
  const subtotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0));

  let discount = 0;
  let couponError = null;
  let coupon = null;

  if (couponCode) {
    const found = db.prepare('SELECT * FROM coupons WHERE code = ?').get(String(couponCode).toUpperCase());
    if (!found) couponError = 'That code is not recognised.';
    else if (!found.active) couponError = 'That code has expired.';
    else if (subtotal < found.minimum) couponError = `Spend at least ${found.minimum.toFixed(2)} to use this code.`;
    else {
      coupon = found.code;
      if (found.kind === 'percent') discount = money((subtotal * found.value) / 100);
      if (found.kind === 'fixed') discount = money(Math.min(found.value, subtotal));
    }
  }

  const method = SHIPPING[shippingMethod] ? shippingMethod : 'standard';
  const rule = SHIPPING[method];
  let shipping = subtotal >= rule.freeOver ? 0 : rule.cost;
  if (coupon === 'FREESHIP') shipping = 0;

  const taxed = Math.max(subtotal - discount, 0);
  const tax = money(taxed * TAX_RATE);
  const total = money(taxed + tax + shipping);

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    discount,
    shipping: money(shipping),
    shippingMethod: method,
    tax,
    total,
    coupon,
    couponError
  };
}

/* --------------------------------------------------------------------- auth */

app.post('/api/auth/register', (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Name, email and password are all required.' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'That email address does not look right.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Passwords must be at least 8 characters.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const info = db
    .prepare('INSERT INTO users (email, name, password) VALUES (?, ?, ?)')
    .run(email, name, hashPassword(password));
  const token = crypto.randomUUID();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, info.lastInsertRowid);
  res.status(201).json({
    token,
    user: { id: info.lastInsertRowid, email, name, role: 'customer' }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
  if (!user || !verifyPassword(password || '', user.password)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  if (user.role === 'locked') {
    return res.status(423).json({ error: 'This account is locked. Contact support.' });
  }
  const token = crypto.randomUUID();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(header.slice(7));
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  res.json({ user });
});

/* ----------------------------------------------------------------- catalogue */

app.get('/api/meta', (_req, res) => {
  const categories = db
    .prepare('SELECT category AS slug, category_name AS name, COUNT(*) AS count FROM products GROUP BY category, category_name ORDER BY category_name')
    .all();
  const brands = db
    .prepare('SELECT brand AS name, COUNT(*) AS count FROM products GROUP BY brand ORDER BY brand')
    .all();
  const bounds = db.prepare('SELECT MIN(price) AS min, MAX(price) AS max FROM products').get();
  res.json({ categories, brands, priceRange: { min: Math.floor(bounds.min), max: Math.ceil(bounds.max) } });
});

app.get('/api/products', (req, res) => {
  const {
    search = '',
    category = '',
    brand = '',
    minPrice,
    maxPrice,
    inStock,
    onSale,
    sort = 'relevance',
    page = '1',
    limit = '12'
  } = req.query;

  const clauses = [];
  const params = {};

  if (search) {
    clauses.push('(LOWER(name) LIKE @search OR LOWER(short_description) LIKE @search OR LOWER(brand) LIKE @search)');
    params.search = `%${String(search).toLowerCase()}%`;
  }

  const categories = String(category).split(',').filter(Boolean);
  if (categories.length) {
    clauses.push(`category IN (${categories.map((_, i) => `@category${i}`).join(', ')})`);
    categories.forEach((value, i) => {
      params[`category${i}`] = value;
    });
  }

  const brands = String(brand).split(',').filter(Boolean);
  if (brands.length) {
    clauses.push(`brand IN (${brands.map((_, i) => `@brand${i}`).join(', ')})`);
    brands.forEach((value, i) => {
      params[`brand${i}`] = value;
    });
  }

  if (minPrice !== undefined && minPrice !== '') {
    clauses.push('price >= @minPrice');
    params.minPrice = Number(minPrice);
  }
  if (maxPrice !== undefined && maxPrice !== '') {
    clauses.push('price <= @maxPrice');
    params.maxPrice = Number(maxPrice);
  }
  if (inStock === 'true') clauses.push('stock > 0');
  if (onSale === 'true') clauses.push('list_price IS NOT NULL');

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const orderBy = {
    relevance: 'featured_order IS NULL, featured_order ASC, rating DESC',
    'price-asc': 'price ASC',
    'price-desc': 'price DESC',
    'name-asc': 'name ASC',
    'name-desc': 'name DESC',
    rating: 'rating DESC, review_count DESC',
    newest: 'id DESC'
  }[sort] || 'id ASC';

  const perPage = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 60);
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (currentPage - 1) * perPage;

  const total = db.prepare(`SELECT COUNT(*) AS count FROM products ${where}`).get(params).count;
  const rows = db
    .prepare(`SELECT * FROM products ${where} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: perPage, offset });

  res.json({
    items: rows.map(rowToProduct),
    total,
    page: currentPage,
    pageSize: perPage,
    pageCount: Math.max(Math.ceil(total / perPage), 1)
  });
});

app.get('/api/suggest', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json({ suggestions: [] });
  const rows = db
    .prepare('SELECT name, slug, category_name FROM products WHERE LOWER(name) LIKE ? ORDER BY rating DESC LIMIT 8')
    .all(`%${q}%`);
  res.json({ suggestions: rows.map((row) => ({ name: row.name, slug: row.slug, category: row.category_name })) });
});

app.get('/api/featured', (_req, res) => {
  const rows = db
    .prepare('SELECT * FROM products WHERE featured_order IS NOT NULL ORDER BY featured_order ASC')
    .all();
  res.json({ items: rows.map(rowToProduct) });
});

app.put('/api/featured', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });

  const order = Array.isArray(req.body?.order) ? req.body.order : [];
  const clear = db.prepare('UPDATE products SET featured_order = NULL');
  const set = db.prepare('UPDATE products SET featured_order = ? WHERE id = ?');
  db.transaction(() => {
    clear.run();
    order.forEach((productId, index) => set.run(index + 1, productId));
  })();

  const rows = db.prepare('SELECT * FROM products WHERE featured_order IS NOT NULL ORDER BY featured_order ASC').all();
  return res.json({ items: rows.map(rowToProduct) });
});

app.get('/api/products/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE slug = ?').get(req.params.slug);
  if (!row) return res.status(404).json({ error: 'No such product.' });
  const related = db
    .prepare('SELECT * FROM products WHERE category = ? AND id != ? ORDER BY rating DESC LIMIT 4')
    .all(row.category, row.id);
  return res.json({ product: rowToProduct(row), related: related.map(rowToProduct) });
});

app.get('/api/products/:slug/reviews', (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE slug = ?').get(req.params.slug);
  if (!product) return res.status(404).json({ error: 'No such product.' });
  const reviews = db
    .prepare('SELECT id, author, rating, title, body, created_at AS createdAt FROM reviews WHERE product_id = ? ORDER BY id DESC')
    .all(product.id);
  return res.json({ reviews });
});

app.post('/api/products/:slug/reviews', (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE slug = ?').get(req.params.slug);
  if (!product) return res.status(404).json({ error: 'No such product.' });

  const { author, rating, title, body } = req.body || {};
  const errors = {};
  if (!author) errors.author = 'Tell us your name.';
  if (!rating) errors.rating = 'Pick a star rating.';
  if (!title) errors.title = 'A short headline is required.';
  if (!body || String(body).length < 10) errors.body = 'Reviews need at least 10 characters.';
  if (Object.keys(errors).length) return res.status(422).json({ errors });

  const info = db
    .prepare('INSERT INTO reviews (product_id, author, rating, title, body) VALUES (?, ?, ?, ?, ?)')
    .run(product.id, author, Number(rating), title, body);
  db.prepare('UPDATE products SET review_count = review_count + 1 WHERE id = ?').run(product.id);

  return res.status(201).json({
    review: db
      .prepare('SELECT id, author, rating, title, body, created_at AS createdAt FROM reviews WHERE id = ?')
      .get(info.lastInsertRowid)
  });
});

/* --------------------------------------------------------------------- cart */

app.get('/api/cart', (req, res) => {
  const id = cartId(req);
  res.json(cartSummary(id, req.query.coupon, req.query.shipping));
});

app.post('/api/cart', (req, res) => {
  const id = cartId(req);
  if (!id) return res.status(400).json({ error: 'Missing cart identifier.' });

  const productId = Number(req.body?.productId);
  const quantity = Math.max(Number(req.body?.quantity) || 1, 1);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'No such product.' });
  if (product.stock <= 0) return res.status(409).json({ error: `${product.name} is out of stock.` });

  const existing = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?').get(id, productId);
  const nextQuantity = Math.min((existing?.quantity || 0) + quantity, product.stock);
  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(nextQuantity, existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)').run(id, productId, nextQuantity);
  }

  return res.status(201).json(cartSummary(id));
});

app.patch('/api/cart/:lineId', (req, res) => {
  const id = cartId(req);
  const line = db.prepare('SELECT * FROM cart_items WHERE id = ? AND cart_id = ?').get(req.params.lineId, id);
  if (!line) return res.status(404).json({ error: 'That line is no longer in your basket.' });

  const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(line.product_id);
  const quantity = Number(req.body?.quantity);
  if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ error: 'Quantity must be a positive number.' });

  if (quantity === 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(line.id);
  } else {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(Math.min(quantity, product.stock), line.id);
  }
  return res.json(cartSummary(id));
});

app.delete('/api/cart/:lineId', (req, res) => {
  const id = cartId(req);
  db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?').run(req.params.lineId, id);
  res.json(cartSummary(id));
});

app.delete('/api/cart', (req, res) => {
  const id = cartId(req);
  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(id);
  res.json(cartSummary(id));
});

app.post('/api/coupons/validate', (req, res) => {
  const id = cartId(req);
  const summary = cartSummary(id, req.body?.code, req.body?.shipping);
  if (summary.couponError) return res.status(422).json({ error: summary.couponError, summary });
  return res.json({ summary });
});

/* ------------------------------------------------------------------- orders */

app.post('/api/orders', (req, res) => {
  const id = cartId(req);
  const user = currentUser(req);
  const payload = req.body || {};

  const required = ['fullName', 'email', 'address', 'city', 'postcode', 'country', 'paymentMethod'];
  const errors = {};
  required.forEach((field) => {
    if (!payload[field]) errors[field] = 'This field is required.';
  });
  if (payload.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (payload.postcode && !/^[a-z0-9 -]{3,10}$/i.test(payload.postcode)) {
    errors.postcode = 'Postcodes are 3 to 10 letters or digits.';
  }
  if (!payload.termsAccepted) {
    errors.termsAccepted = 'You must accept the terms before ordering.';
  }
  if (Object.keys(errors).length) return res.status(422).json({ errors });

  const summary = cartSummary(id, payload.coupon, payload.shippingMethod);
  if (!summary.items.length) return res.status(409).json({ error: 'Your basket is empty.' });

  const reference = `AP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000) + 100000)}`;

  const insertOrder = db.prepare(`
    INSERT INTO orders (reference, user_id, cart_id, email, full_name, address, city, postcode, country,
      region, delivery_date, shipping_method, payment_method, coupon, subtotal, discount, shipping, tax, total)
    VALUES (@reference, @userId, @cartId, @email, @fullName, @address, @city, @postcode, @country,
      @region, @deliveryDate, @shippingMethod, @paymentMethod, @coupon, @subtotal, @discount, @shipping, @tax, @total)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, name, sku, unit_price, quantity)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const orderId = db.transaction(() => {
    const info = insertOrder.run({
      reference,
      userId: user?.id ?? null,
      cartId: id,
      email: payload.email,
      fullName: payload.fullName,
      address: payload.address,
      city: payload.city,
      postcode: payload.postcode,
      country: payload.country,
      region: payload.region || null,
      deliveryDate: payload.deliveryDate || null,
      shippingMethod: summary.shippingMethod,
      paymentMethod: payload.paymentMethod,
      coupon: summary.coupon,
      subtotal: summary.subtotal,
      discount: summary.discount,
      shipping: summary.shipping,
      tax: summary.tax,
      total: summary.total
    });

    summary.items.forEach((item) => {
      insertItem.run(info.lastInsertRowid, item.product.id, item.product.name, item.product.sku, item.product.price, item.quantity);
      db.prepare('UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?').run(item.quantity, item.product.id);
    });

    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(id);
    return info.lastInsertRowid;
  })();

  return res.status(201).json({ order: loadOrder(orderId) });
});

function loadOrder(idOrReference) {
  const order = Number.isInteger(idOrReference)
    ? db.prepare('SELECT * FROM orders WHERE id = ?').get(idOrReference)
    : db.prepare('SELECT * FROM orders WHERE reference = ?').get(idOrReference);
  if (!order) return null;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  return {
    id: order.id,
    reference: order.reference,
    email: order.email,
    fullName: order.full_name,
    address: order.address,
    city: order.city,
    postcode: order.postcode,
    country: order.country,
    region: order.region,
    deliveryDate: order.delivery_date,
    shippingMethod: order.shipping_method,
    paymentMethod: order.payment_method,
    coupon: order.coupon,
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    tax: order.tax,
    total: order.total,
    status: order.status,
    createdAt: order.created_at,
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
      sku: item.sku,
      unitPrice: item.unit_price,
      quantity: item.quantity
    }))
  };
}

app.get('/api/orders', (req, res) => {
  const user = currentUser(req);
  const id = cartId(req);
  const sort = ['reference', 'created_at', 'total', 'status'].includes(req.query.sort) ? req.query.sort : 'created_at';
  const direction = String(req.query.direction).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const perPage = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 50);
  const currentPage = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const where = user ? 'WHERE user_id = @userId' : 'WHERE cart_id = @cartId';
  const params = { userId: user?.id ?? -1, cartId: id ?? '' };

  const total = db.prepare(`SELECT COUNT(*) AS count FROM orders ${where}`).get(params).count;
  const rows = db
    .prepare(`SELECT reference FROM orders ${where} ORDER BY ${sort} ${direction} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: perPage, offset: (currentPage - 1) * perPage });

  res.json({
    items: rows.map((row) => loadOrder(row.reference)),
    total,
    page: currentPage,
    pageCount: Math.max(Math.ceil(total / perPage), 1)
  });
});

app.get('/api/orders/:reference', (req, res) => {
  const order = loadOrder(req.params.reference);
  if (!order) return res.status(404).json({ error: 'No order with that reference.' });
  return res.json({ order });
});

app.get('/api/orders/:reference/invoice', (req, res) => {
  const order = loadOrder(req.params.reference);
  if (!order) return res.status(404).json({ error: 'No order with that reference.' });

  const lines = [
    'Reference,Item,SKU,Unit price,Quantity,Line total',
    ...order.items.map((item) =>
      [order.reference, `"${item.name}"`, item.sku, item.unitPrice, item.quantity, money(item.unitPrice * item.quantity)].join(',')
    ),
    `${order.reference},Subtotal,,,,${order.subtotal}`,
    `${order.reference},Discount,,,,-${order.discount}`,
    `${order.reference},Shipping,,,,${order.shipping}`,
    `${order.reference},Tax,,,,${order.tax}`,
    `${order.reference},Total,,,,${order.total}`
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.reference}.csv"`);
  return res.send(lines.join('\n'));
});

/* ------------------------------------------------------------------ uploads */

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, '_')}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.post('/api/uploads', upload.single('document'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file was received.' });
  const info = db
    .prepare('INSERT INTO uploads (original_name, stored_name, size, mime, cart_id) VALUES (?, ?, ?, ?, ?)')
    .run(req.file.originalname, req.file.filename, req.file.size, req.file.mimetype, cartId(req));
  return res.status(201).json({
    upload: {
      id: info.lastInsertRowid,
      name: req.file.originalname,
      size: req.file.size,
      mime: req.file.mimetype
    }
  });
});

/* ------------------------------------------------- generated product imagery */

app.get('/api/placeholder/:seed', (req, res) => {
  const seed = String(req.params.seed).replace('.svg', '');
  const colour = req.query.colour || '#33556b';
  const label = String(req.query.label || seed).slice(0, 22);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colour}"/>
      <stop offset="100%" stop-color="#11161c"/>
    </linearGradient>
  </defs>
  <rect width="480" height="360" fill="url(#g)"/>
  <circle cx="368" cy="86" r="120" fill="#ffffff" opacity="0.06"/>
  <rect x="48" y="132" width="240" height="96" rx="10" fill="#ffffff" opacity="0.12"/>
  <text x="48" y="286" font-family="Georgia, serif" font-size="26" fill="#ffffff" opacity="0.86">${label}</text>
</svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

/* ----------------------------------------------- serve the built client app */

const clientDist = path.join(here, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Something went wrong on our side.' });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
