/**
 * Carrito: en el servidor si hay sesión; en localStorage para invitados.
 * Al iniciar sesión el carrito local se fusiona con el del servidor.
 */
import { api } from './api.js';
import { getMe } from './session.js';

const KEY = 'kairos_cart';
const listeners = new Set();

function readLocal() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}
function writeLocal(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch { /* almacenamiento no disponible */ }
}

function emit(count) {
  for (const fn of listeners) fn(count);
}
export const onCartChange = (fn) => listeners.add(fn);

/** Carrito con datos completos de productos (para la página del carrito). */
export async function loadCart() {
  if (await getMe()) {
    const cart = await api.get('/cart');
    emit(cart.totals.count);
    return cart;
  }
  const local = readLocal();
  if (!local.length) {
    emit(0);
    return { items: [], totals: { count: 0, subtotal: 0, total: 0, discount: 0 } };
  }
  const ids = local.map((i) => i.productId);
  const { items: products } = await api.get(`/products?limit=60&ids=${ids.join(',')}`).catch(() => ({ items: [] }));
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = local
    .filter((i) => byId.has(i.productId))
    .map((i) => {
      const product = byId.get(i.productId);
      return { product, quantity: Math.min(i.quantity, Math.max(product.stock, 1)), available: product.active !== false && product.stock > 0 };
    });
  const totals = items.filter((i) => i.available).reduce(
    (a, i) => ({ count: a.count + i.quantity, subtotal: a.subtotal + i.product.price * i.quantity, total: a.total + i.product.finalPrice * i.quantity }),
    { count: 0, subtotal: 0, total: 0 },
  );
  totals.discount = totals.subtotal - totals.total;
  emit(totals.count);
  return { items, totals };
}

export async function cartCount() {
  if (await getMe()) {
    const c = await api.get('/cart').catch(() => null);
    return c?.totals.count || 0;
  }
  return readLocal().reduce((s, i) => s + i.quantity, 0);
}

export async function addToCart(productId, quantity = 1) {
  if (await getMe()) {
    const cart = await api.post(`/cart/items/${productId}`, { quantity });
    emit(cart.totals.count);
    return cart;
  }
  const items = readLocal();
  const found = items.find((i) => i.productId === productId);
  if (found) found.quantity = Math.min(found.quantity + quantity, 999);
  else items.push({ productId, quantity });
  writeLocal(items);
  emit(items.reduce((s, i) => s + i.quantity, 0));
}

export async function setQuantity(productId, quantity) {
  if (await getMe()) {
    const cart = await api.put(`/cart/items/${productId}`, { quantity });
    emit(cart.totals.count);
    return cart;
  }
  let items = readLocal();
  if (quantity <= 0) items = items.filter((i) => i.productId !== productId);
  else {
    const it = items.find((i) => i.productId === productId);
    if (it) it.quantity = quantity;
  }
  writeLocal(items);
  emit(items.reduce((s, i) => s + i.quantity, 0));
}

/** Llamar justo después de iniciar sesión / registrarse. */
export async function mergeLocalCart() {
  const items = readLocal();
  if (!items.length) return;
  await api.post('/cart/merge', { items }).catch(() => {});
  writeLocal([]);
}
