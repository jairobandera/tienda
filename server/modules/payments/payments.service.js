import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { query } from '../../config/db.js';
import * as orders from '../orders/orders.service.js';
import * as mp from './mercadopago.client.js';
import { getSettings } from '../settings/settings.service.js';

const STATUS_MAP = {
  approved: 'paid',
  authorized: 'pending',
  pending: 'pending',
  in_process: 'pending',
  in_mediation: 'paid',
  rejected: 'rejected',
  cancelled: 'cancelled',
  refunded: 'refunded',
  charged_back: 'refunded',
};

/** Genera el link de pago de un pedido (o el link del pago simulado en desarrollo). */
export async function createPaymentLink(order, user) {
  if (order.payment_provider === 'cash') return null;
  if (env.simulatePayments) return `${env.appUrl}/compra/${order.id}?simulado=1`;
  const settings = await getSettings();
  const pref = await mp.createPreference(order, user, settings);
  await orders.setPreference(order.id, pref.id);
  return pref.initPoint;
}

/** Aplica el estado de un pago de Mercado Pago al pedido correspondiente. */
export async function applyPayment(payment) {
  const orderId = Number(payment.external_reference);
  if (!Number.isInteger(orderId)) return null;
  const { rows: [order] } = await query('SELECT id, total FROM orders WHERE id = $1', [orderId]);
  if (!order) return null;

  const info = {
    id: String(payment.id),
    status: payment.status,
    method: payment.payment_method_id,
    type: payment.payment_type_id,
    installments: payment.installments,
  };
  let next = STATUS_MAP[payment.status] || 'pending';

  // Seguridad: el monto cobrado debe cubrir el total del pedido.
  if (next === 'paid' && Number(payment.transaction_amount) + 0.01 < Number(order.total)) {
    console.warn(`[pagos] Monto inconsistente en pedido ${orderId}: cobrado ${payment.transaction_amount}, total ${order.total}`);
    info.status = 'amount_mismatch';
    next = 'pending';
  }

  if (next === 'paid') {
    await orders.markPaid(orderId, info);
    await query('UPDATE orders SET payment_status = $2 WHERE id = $1', [orderId, info.status]);
  } else {
    await orders.updatePaymentInfo(orderId, info, next);
  }
  return orderId;
}

export async function syncPayment(paymentId) {
  const payment = await mp.getPayment(paymentId);
  return applyPayment(payment);
}

/** Pago simulado para desarrollo local (sin credenciales de Mercado Pago). */
export async function simulatePayment(order, outcome = 'approved', type = 'credit_card') {
  return applyPayment({
    id: `SIM-${Date.now()}`,
    external_reference: String(order.id),
    status: outcome,
    payment_method_id: type === 'ticket' ? 'abitab' : type === 'debit_card' ? 'debvisa' : 'visa',
    payment_type_id: type,
    installments: 1,
    transaction_amount: order.total,
  });
}

/**
 * Valida la firma x-signature de los webhooks de Mercado Pago.
 * https://www.mercadopago.com.uy/developers/es/docs/your-integrations/notifications/webhooks
 */
export function verifyWebhookSignature(headers, dataId) {
  if (!env.mp.webhookSecret) return true;
  const signature = headers['x-signature'];
  if (!signature) return false;
  const parts = Object.fromEntries(
    String(signature).split(',').map((p) => p.trim().split('=').map((s) => s.trim())),
  );
  if (!parts.ts || !parts.v1) return false;
  let manifest = '';
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : dataId};`;
  if (headers['x-request-id']) manifest += `request-id:${headers['x-request-id']};`;
  manifest += `ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', env.mp.webhookSecret).update(manifest).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts.v1, 'hex'));
  } catch {
    return false;
  }
}
