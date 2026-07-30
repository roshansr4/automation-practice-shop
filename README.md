# Northwind Supply Co. — an automation practice shop

A full-stack ecommerce site built for one purpose: giving Selenium and Playwright something realistic to
automate. It looks and behaves like a production storefront, and it contains **no `data-testid` attributes
anywhere**. Every element has to be found the way you would find it on a real site — by role, label, text,
structure, or CSS that was never written with you in mind.

```
React 18 + Vite   ->  client/
Express + SQLite  ->  server/
```

## Running it

```bash
git clone https://github.com/roshansr4/automation-practice-shop.git
cd automation-practice-shop
npm install          # installs both workspaces
npm run dev          # API on :4000, storefront on :5173
```

Open http://localhost:5173. The database file is created and seeded on first boot
(60 products, 3 users, 5 coupon codes) at `server/data/app.db`. Delete that file to reset everything.

For a single-process production build:

```bash
npm run build        # builds client/dist
npm start            # Express serves the API and the built client on :4000
```

## Seeded accounts

| Email | Password | Behaviour |
| --- | --- | --- |
| `demo@practice.dev` | `Password123!` | Ordinary customer |
| `admin@practice.dev` | `Admin123!` | Unlocks `/admin` |
| `locked@practice.dev` | `Password123!` | Always fails with HTTP 423 |

## Coupon codes

| Code | Effect |
| --- | --- |
| `SAVE10` | 10% off |
| `SAVE25` | 25% off, minimum spend €400 |
| `FLAT50` | €50 off, minimum spend €200 |
| `FREESHIP` | Free delivery |
| `EXPIRED` | Always rejected |

## What there is to practise on

The `/challenges` page in the running app lists every scenario and where to find it. In short:

**Locators** — hashed class names that change on every page load, ids generated from the product slug, an
open shadow root around the star rating, an iframe for card payment, spec tables addressed by header cell,
and text that deliberately repeats across the grid.

**Waits** — skeleton loaders, a 450 ms debounced autocomplete, stale rows after a 600 ms cart update,
toasts that remove themselves after four seconds, infinite scroll driven by an `IntersectionObserver`, and
a checkout that takes about 1.5 s to respond. Any API call also accepts `?delay=3000` if you want it slower.

**Forms** — a three-step checkout wizard, client and server validation, a country select that populates the
region select, a native multi-select for brands, a hand-rolled calendar with disabled past dates, a
password visibility toggle, and a review form with star radios.

**Browser-level** — `alert`, `confirm` and `prompt`, `target="_blank"` links, a sized popup via
`window.open`, real multipart file upload, a CSV download served with `Content-Disposition: attachment`,
HTML5 drag-and-drop reordering, a canvas signature pad, and hover-only menus.

**Data** — a sortable and paginated order table with expandable rows, all filter state kept in the URL,
guest carts tracked by a `localStorage` id, and every price, tax and discount calculated server-side so you
cannot cheat by reading the DOM.

## API reference

Base URL `http://localhost:4000`. Every endpoint accepts `?delay=<ms>` to slow it down.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/auth/register` | `{ name, email, password }` |
| `POST` | `/api/auth/login` | Returns a bearer token |
| `POST` | `/api/auth/logout` | |
| `GET` | `/api/auth/me` | Requires `Authorization: Bearer <token>` |
| `GET` | `/api/meta` | Categories, brands, price bounds |
| `GET` | `/api/products` | `search, category, brand, minPrice, maxPrice, inStock, onSale, sort, page, limit` |
| `GET` | `/api/products/:slug` | Product plus related items |
| `GET` `POST` | `/api/products/:slug/reviews` | |
| `GET` | `/api/suggest?q=` | Autocomplete |
| `GET` `PUT` | `/api/featured` | `PUT` is admin-only |
| `GET` `POST` `DELETE` | `/api/cart` | Identified by the `x-cart-id` header |
| `PATCH` `DELETE` | `/api/cart/:lineId` | |
| `POST` | `/api/coupons/validate` | |
| `GET` `POST` | `/api/orders` | |
| `GET` | `/api/orders/:reference` | |
| `GET` | `/api/orders/:reference/invoice` | CSV download |
| `POST` | `/api/uploads` | Multipart, field name `document` |
| `GET` | `/api/health` | |

## Layout

```
server/
  src/
    index.js      Express app and every route
    db.js         Schema, seeding, password hashing
    catalog.js    Deterministic product data
client/
  public/
    payment-widget.html   The iframe payment panel
  src/
    App.jsx       Layout, header, footer, routes
    store.jsx     Auth, cart and toast state
    api.js        Fetch wrapper
    components.jsx  Shared widgets (date picker, shadow rating, drop zone…)
    pages/        Home, Product, Cart, Checkout, Orders, Auth, Admin, Challenges
```

## Deliberate rough edges

These are features, not bugs:

- Product card class names are randomised per page load.
- Cart updates round-trip to the server, so rows go stale mid-interaction.
- Toasts disappear on a timer.
- The region select stays disabled until a country is chosen.
- The payment iframe waits 1.4 s before confirming.
- Placing an order pops a native `confirm` first.

## Licence

MIT. Nothing here is for sale, and the shop is fictional.
