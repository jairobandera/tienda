import { query } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/http-error.js';
import { toProduct } from '../products/products.service.js';

export async function getCart(userId) {
  const { rows } = await query(
    `SELECT ci.quantity, v.* FROM cart_items ci
     JOIN v_products v ON v.id = ci.product_id
     WHERE ci.user_id = $1 ORDER BY ci.added_at`,
    [userId],
  );
  const items = rows.map((r) => {
    const product = toProduct(r);
    const available = product.active && product.stock > 0;
    return { product, quantity: Math.min(r.quantity, Math.max(product.stock, 0)) || r.quantity, available };
  });
  const totals = items
    .filter((i) => i.available)
    .reduce(
      (acc, i) => {
        acc.count += i.quantity;
        acc.subtotal += i.product.price * i.quantity;
        acc.total += i.product.finalPrice * i.quantity;
        return acc;
      },
      { count: 0, subtotal: 0, total: 0 },
    );
  totals.discount = Math.round((totals.subtotal - totals.total) * 100) / 100;
  return { items, totals };
}

async function checkProduct(productId, quantity) {
  const { rows } = await query('SELECT stock, active FROM products WHERE id = $1', [productId]);
  if (!rows[0] || !rows[0].active) throw notFound('Producto no disponible');
  if (rows[0].stock < 1) throw badRequest('Producto sin stock');
  return Math.min(quantity, rows[0].stock);
}

export async function setItem(userId, productId, quantity) {
  if (quantity <= 0) {
    await query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);
  } else {
    const q = await checkProduct(productId, quantity);
    await query(
      `INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [userId, productId, q],
    );
  }
  return getCart(userId);
}

export async function addItem(userId, productId, quantity) {
  const { rows } = await query('SELECT quantity FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);
  return setItem(userId, productId, (rows[0]?.quantity || 0) + quantity);
}

/** Fusiona el carrito local (invitado) con el del servidor al iniciar sesión. */
export async function mergeCart(userId, items) {
  for (const { productId, quantity } of items) {
    try {
      await addItem(userId, productId, quantity);
    } catch {
      /* producto inexistente o sin stock: se ignora */
    }
  }
  return getCart(userId);
}

export async function clearCart(userId) {
  await query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
}
