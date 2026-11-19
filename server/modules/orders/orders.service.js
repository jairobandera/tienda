import { query, withTransaction } from '../../config/db.js';
import { badRequest, notFound, round2 } from '../../utils/http-error.js';
import { getSettings, computeShipping } from '../settings/settings.service.js';
import { saveDefaultAddress } from '../auth/auth.service.js';

export const ORDER_STATUSES = ['pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'rejected', 'refunded'];
const PAID_STATUSES = ['paid', 'preparing', 'shipped', 'delivered'];

async function loadItems(orderIds, db = { query }) {
  if (!orderIds.length) return {};
  const { rows } = await db.query('SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id', [orderIds]);
  return rows.reduce((acc, it) => ((acc[it.order_id] ||= []).push(it), acc), {});
}

/**
 * Crea un pedido a partir del carrito del usuario.
 * Los precios se recalculan en el servidor (nunca se confía en el cliente).
 */
export async function createOrderFromCart(userId, data) {
  const settings = await getSettings();
  if (data.paymentMethod === 'cash' && !settings.cash_enabled) throw badRequest('El pago en efectivo no está habilitado');
  if (data.shippingMethod === 'pickup' && !settings.pickup_enabled) throw badRequest('El retiro en local no está habilitado');

  return withTransaction(async (db) => {
    const { rows: cart } = await db.query(
      `SELECT ci.quantity, v.id, v.title, v.price, v.final_price, v.stock, v.active, v.images
       FROM cart_items ci JOIN v_products v ON v.id = ci.product_id
       WHERE ci.user_id = $1`,
      [userId],
    );
    if (!cart.length) throw badRequest('Tu carrito está vacío');

    for (const it of cart) {
      if (!it.active) throw badRequest(`"${it.title}" ya no está disponible`);
      if (it.stock < it.quantity) throw badRequest(`Stock insuficiente de "${it.title}" (disponible: ${it.stock})`);
    }

    const subtotal = round2(cart.reduce((s, i) => s + i.price * i.quantity, 0));
    const itemsTotal = round2(cart.reduce((s, i) => s + i.final_price * i.quantity, 0));
    const shippingCost = computeShipping(settings, itemsTotal, data.shippingMethod);
    const total = round2(itemsTotal + shippingCost);
    const a = data.address || {};
    const isDelivery = data.shippingMethod === 'delivery';

    const { rows: [order] } = await db.query(
      `INSERT INTO orders (user_id, payment_provider, payment_method, subtotal, discount_total, shipping_cost, total,
         shipping_method, ship_name, ship_phone, ship_street, ship_number, ship_apartment, ship_city, ship_department,
         ship_postal_code, ship_notes, customer_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [
        userId,
        data.paymentMethod === 'cash' ? 'cash' : 'mercadopago',
        data.paymentMethod === 'cash' ? 'efectivo' : null,
        subtotal, round2(subtotal - itemsTotal), shippingCost, total,
        data.shippingMethod, data.name, data.phone,
        isDelivery ? a.street : null, isDelivery ? a.number || null : null, isDelivery ? a.apartment || null : null,
        isDelivery ? a.city : null, isDelivery ? a.department : null, isDelivery ? a.postalCode || null : null,
        isDelivery ? a.notes || null : null, data.notes || null,
      ],
    );

    for (const it of cart) {
      await db.query(
        `INSERT INTO order_items (order_id, product_id, title, image, original_price, unit_price, quantity)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.id, it.id, it.title, it.images?.[0] || null, it.price, it.final_price, it.quantity],
      );
    }

    if (isDelivery && data.saveAddress) await saveDefaultAddress(db, userId, a);
    if (data.phone) await db.query('UPDATE users SET phone = COALESCE(phone, $2) WHERE id = $1', [userId, data.phone]);

    // En efectivo el pedido queda reservado: vaciamos el carrito ya.
    if (data.paymentMethod === 'cash') await db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    const items = (await loadItems([order.id], db))[order.id];
    return { ...order, items };
  });
}

export async function getOrder(id, { userId } = {}) {
  const { rows } = await query(
    `SELECT o.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
     FROM orders o JOIN users u ON u.id = o.user_id
     WHERE o.id = $1 ${userId ? 'AND o.user_id = $2' : ''}`,
    userId ? [id, userId] : [id],
  );
  if (!rows[0]) throw notFound('Pedido no encontrado');
  const items = await loadItems([id]);
  return { ...rows[0], items: items[id] || [] };
}

export async function listUserOrders(userId) {
  const { rows } = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [userId]);
  const items = await loadItems(rows.map((o) => o.id));
  return rows.map((o) => ({ ...o, items: items[o.id] || [] }));
}

export async function setPreference(orderId, preferenceId) {
  await query('UPDATE orders SET mp_preference_id = $2, updated_at = now() WHERE id = $1', [orderId, preferenceId]);
}

/**
 * Marca un pedido como pagado de forma idempotente: descuenta stock, suma ventas y limpia el carrito
 * solo la primera vez. Devuelve true si el pedido pasó a pagado en esta llamada.
 */
export async function markPaid(orderId, payment = {}) {
  return withTransaction(async (db) => {
    const { rows } = await db.query(
      `UPDATE orders SET status = 'paid', paid_at = now(), updated_at = now(),
         payment_status = COALESCE($2, payment_status), payment_method = COALESCE($3, payment_method),
         payment_type = COALESCE($4, payment_type), installments = COALESCE($5, installments),
         mp_payment_id = COALESCE($6, mp_payment_id)
       WHERE id = $1 AND paid_at IS NULL AND status IN ('pending', 'rejected', 'cancelled')
       RETURNING id, user_id`,
      [orderId, payment.status ?? null, payment.method ?? null, payment.type ?? null, payment.installments ?? null, payment.id ?? null],
    );
    if (!rows[0]) return false;
    await db.query(
      `UPDATE products p SET stock = GREATEST(p.stock - oi.quantity, 0), sold_count = p.sold_count + oi.quantity, updated_at = now()
       FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`,
      [orderId],
    );
    await db.query(
      `DELETE FROM cart_items WHERE user_id = $1 AND product_id IN (SELECT product_id FROM order_items WHERE order_id = $2)`,
      [rows[0].user_id, orderId],
    );
    return true;
  });
}

/** Devuelve el stock si un pedido pagado se cancela o reembolsa. */
async function restoreStock(db, orderId) {
  const { rows } = await db.query(
    `UPDATE orders SET stock_restored = true WHERE id = $1 AND paid_at IS NOT NULL AND NOT stock_restored RETURNING id`,
    [orderId],
  );
  if (!rows[0]) return;
  await db.query(
    `UPDATE products p SET stock = p.stock + oi.quantity, sold_count = GREATEST(p.sold_count - oi.quantity, 0)
     FROM order_items oi WHERE oi.order_id = $1 AND oi.product_id = p.id`,
    [orderId],
  );
}

/** Actualiza datos de pago sin pagar el pedido (pendiente, rechazado, etc.). */
export async function updatePaymentInfo(orderId, payment, newStatus) {
  return withTransaction(async (db) => {
    const { rows: [o] } = await db.query('SELECT status, paid_at FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!o) return;
    // Nunca retroceder un pedido ya pagado por un evento de pago viejo, salvo reembolsos.
    const status = o.paid_at && newStatus !== 'refunded' ? o.status : newStatus;
    await db.query(
      `UPDATE orders SET status = $2, payment_status = $3, payment_method = COALESCE($4, payment_method),
         payment_type = COALESCE($5, payment_type), installments = COALESCE($6, installments),
         mp_payment_id = COALESCE($7, mp_payment_id), updated_at = now()
       WHERE id = $1`,
      [orderId, status, payment.status, payment.method ?? null, payment.type ?? null, payment.installments ?? null, payment.id ?? null],
    );
    if (status === 'refunded') await restoreStock(db, orderId);
  });
}

// ---------------- Admin ----------------

export async function adminUpdateOrder(id, { status, adminNotes, trackingCode }) {
  const current = await getOrder(id);
  if (status && status !== current.status) {
    if (PAID_STATUSES.includes(status) && !current.paid_at) {
      // Pago manual (efectivo / transferencia) confirmado por el administrador.
      await markPaid(id, { status: 'approved_manual', method: current.payment_method || 'efectivo' });
    }
    await withTransaction(async (db) => {
      await db.query('UPDATE orders SET status = $2, updated_at = now() WHERE id = $1', [id, status]);
      if (['cancelled', 'refunded'].includes(status)) await restoreStock(db, id);
    });
  }
  if (adminNotes !== undefined || trackingCode !== undefined) {
    await query(
      `UPDATE orders SET admin_notes = COALESCE($2, admin_notes), tracking_code = COALESCE($3, tracking_code), updated_at = now() WHERE id = $1`,
      [id, adminNotes ?? null, trackingCode ?? null],
    );
  }
  return getOrder(id);
}

function adminWhere(f) {
  const where = [];
  const params = [];
  const p = (v) => (params.push(v), `$${params.length}`);
  if (f.status) where.push(`o.status = ${p(f.status)}`);
  if (f.payment) where.push(`(o.payment_type = ${p(f.payment)} OR o.payment_provider = $${params.length})`);
  if (f.from) where.push(`o.created_at >= ${p(f.from)}::date`);
  if (f.to) where.push(`o.created_at < (${p(f.to)}::date + 1)`);
  if (f.q) {
    const q = f.q.trim();
    if (/^#?\d+$/.test(q)) where.push(`o.id = ${p(Number(q.replace('#', '')))}`);
    else {
      const like = p(`%${q.toLowerCase()}%`);
      where.push(`(lower(u.name) LIKE ${like} OR lower(u.email) LIKE ${like} OR lower(o.ship_name) LIKE ${like} OR o.ship_phone LIKE ${like})`);
    }
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function adminListOrders(f) {
  const page = f.page || 1;
  const limit = Math.min(f.limit || 25, 200);
  const w = adminWhere(f);
  const base = `FROM orders o JOIN users u ON u.id = o.user_id ${w.sql}`;
  const [list, count] = await Promise.all([
    query(
      `SELECT o.*, u.name AS user_name, u.email AS user_email,
         (SELECT coalesce(sum(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       ${base} ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      w.params,
    ),
    query(`SELECT count(*) ${base}`, w.params),
  ]);
  return { items: list.rows, total: count.rows[0].count, page, pages: Math.max(1, Math.ceil(count.rows[0].count / limit)) };
}

export async function adminExportOrders(f) {
  const w = adminWhere(f);
  const { rows } = await query(
    `SELECT o.*, u.name AS user_name, u.email AS user_email,
       (SELECT string_agg(oi.quantity || 'x ' || oi.title, ' | ') FROM order_items oi WHERE oi.order_id = o.id) AS detail
     FROM orders o JOIN users u ON u.id = o.user_id ${w.sql} ORDER BY o.created_at DESC LIMIT 10000`,
    w.params,
  );
  return rows;
}

export async function adminStats() {
  const revenueStatuses = `status IN ('paid','preparing','shipped','delivered')`;
  const [totals, byStatus, daily, top, methods, lowStock, customers] = await Promise.all([
    query(`SELECT
        coalesce(sum(total) FILTER (WHERE ${revenueStatuses}), 0) AS revenue,
        coalesce(sum(total) FILTER (WHERE ${revenueStatuses} AND paid_at >= date_trunc('month', now())), 0) AS revenue_month,
        coalesce(sum(total) FILTER (WHERE ${revenueStatuses} AND paid_at >= date_trunc('day', now())), 0) AS revenue_today,
        count(*) FILTER (WHERE ${revenueStatuses}) AS paid_orders,
        count(*) FILTER (WHERE status IN ('paid','preparing')) AS to_ship,
        count(*) FILTER (WHERE status = 'pending') AS pending_orders,
        coalesce(avg(total) FILTER (WHERE ${revenueStatuses}), 0) AS avg_ticket
      FROM orders`),
    query('SELECT status, count(*) FROM orders GROUP BY status'),
    query(`SELECT d::date AS day, coalesce(sum(o.total), 0) AS total, count(o.id) AS orders
      FROM generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d
      LEFT JOIN orders o ON date_trunc('day', o.paid_at) = d AND o.${revenueStatuses}
      GROUP BY d ORDER BY d`),
    query(`SELECT oi.product_id, oi.title, sum(oi.quantity) AS units, sum(oi.quantity * oi.unit_price) AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.${revenueStatuses}
      GROUP BY oi.product_id, oi.title ORDER BY units DESC LIMIT 5`),
    query(`SELECT coalesce(payment_type, payment_provider) AS method, count(*), sum(total) AS total
      FROM orders WHERE ${revenueStatuses} GROUP BY 1 ORDER BY 2 DESC`),
    query('SELECT id, title, stock FROM products WHERE active AND stock <= 3 ORDER BY stock, title LIMIT 10'),
    query(`SELECT count(*) FROM users WHERE role = 'customer'`),
  ]);
  return {
    ...totals.rows[0],
    customers: customers.rows[0].count,
    byStatus: Object.fromEntries(byStatus.rows.map((r) => [r.status, r.count])),
    daily: daily.rows,
    topProducts: top.rows,
    paymentMethods: methods.rows,
    lowStock: lowStock.rows,
  };
}

export async function adminListCustomers({ q, page = 1 }) {
  const params = [];
  let where = '';
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where = `WHERE lower(u.name) LIKE $1 OR lower(u.email) LIKE $1 OR u.phone LIKE $1`;
  }
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
       count(o.id) FILTER (WHERE o.status IN ('paid','preparing','shipped','delivered')) AS orders,
       coalesce(sum(o.total) FILTER (WHERE o.status IN ('paid','preparing','shipped','delivered')), 0) AS spent,
       max(o.created_at) AS last_order
     FROM users u LEFT JOIN orders o ON o.user_id = u.id
     ${where} GROUP BY u.id ORDER BY u.created_at DESC LIMIT 50 OFFSET ${(page - 1) * 50}`,
    params,
  );
  return rows;
}
