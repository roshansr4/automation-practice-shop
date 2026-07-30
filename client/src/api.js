const BASE = import.meta.env.VITE_API_URL || '';

const TOKEN_KEY = 'nw.token';
const CART_KEY = 'nw.cartId';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getCartId() {
  let id = localStorage.getItem(CART_KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || `cart-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(CART_KEY, id);
  }
  return id;
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload || {};
  }
}

async function request(pathname, options = {}) {
  const headers = { 'x-cart-id': getCartId(), ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });

  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (isJson && (payload.error || Object.values(payload.errors || {})[0])) || 'Request failed';
    throw new ApiError(message, response.status, payload);
  }
  return payload;
}

function query(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  });
  const asString = search.toString();
  return asString ? `?${asString}` : '';
}

export const api = {
  meta: () => request('/api/meta'),
  products: (params) => request(`/api/products${query(params)}`),
  product: (slug) => request(`/api/products/${slug}`),
  reviews: (slug) => request(`/api/products/${slug}/reviews`),
  addReview: (slug, body) => request(`/api/products/${slug}/reviews`, { method: 'POST', body }),
  suggest: (q) => request(`/api/suggest${query({ q, delay: 350 })}`),
  featured: () => request('/api/featured'),
  saveFeatured: (order) => request('/api/featured', { method: 'PUT', body: { order } }),

  cart: (params) => request(`/api/cart${query(params)}`),
  addToCart: (productId, quantity = 1) => request('/api/cart', { method: 'POST', body: { productId, quantity } }),
  updateLine: (lineId, quantity) => request(`/api/cart/${lineId}?delay=600`, { method: 'PATCH', body: { quantity } }),
  removeLine: (lineId) => request(`/api/cart/${lineId}`, { method: 'DELETE' }),
  emptyCart: () => request('/api/cart', { method: 'DELETE' }),
  applyCoupon: (code, shipping) => request('/api/coupons/validate?delay=1200', { method: 'POST', body: { code, shipping } }),

  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/auth/login?delay=700', { method: 'POST', body }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),

  placeOrder: (body) => request('/api/orders?delay=1500', { method: 'POST', body }),
  orders: (params) => request(`/api/orders${query(params)}`),
  order: (reference) => request(`/api/orders/${reference}`),
  invoiceUrl: (reference) => `${BASE}/api/orders/${reference}/invoice`,

  uploadDocument: (file) => {
    const form = new FormData();
    form.append('document', file);
    return request('/api/uploads', { method: 'POST', body: form });
  },

  imageUrl: (product, size = 'card') =>
    `${BASE}/api/placeholder/${product.slug}-${size}.svg${query({ colour: product.colour, label: product.name })}`
};

export default api;
