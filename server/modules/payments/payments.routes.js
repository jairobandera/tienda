import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { badRequest, forbidden } from '../../utils/http-error.js';
import * as service from './payments.service.js';
import * as orders from '../orders/orders.service.js';

const router = Router();

/** Webhook de Mercado Pago (notificaciones de pagos). */
router.post('/webhook', async (req, res) => {
  const type = req.body?.type || req.query.type || req.query.topic;
  const dataId = req.query['data.id'] || req.body?.data?.id || req.query.id;

  if (!service.verifyWebhookSignature(req.headers, dataId)) {
    console.warn('[webhook] firma inválida');
    return res.sendStatus(401);
  }
  res.sendStatus(200); // responder rápido; el procesamiento sigue en segundo plano
  if (type === 'payment' && dataId) {
    service.syncPayment(dataId).catch((err) => console.error('[webhook] error procesando pago', dataId, err.message));
  }
});

/** Al volver de Mercado Pago, el front sincroniza el pago (útil en localhost, donde no llegan webhooks). */
router.post('/sync', requireAuth, validate(z.object({ paymentId: z.string().regex(/^\d+$/).max(30), orderId: z.number().int() })), async (req, res) => {
  const order = await orders.getOrder(req.body.orderId, req.user.role === 'admin' ? {} : { userId: req.user.id });
  const appliedTo = await service.syncPayment(req.body.paymentId);
  if (appliedTo !== order.id) throw forbidden('El pago no corresponde a este pedido');
  res.json({ order: await orders.getOrder(order.id) });
});

/** Solo desarrollo: simula el resultado de un pago. */
router.post('/simulate', requireAuth, validate(z.object({
  orderId: z.number().int(),
  outcome: z.enum(['approved', 'pending', 'rejected']).default('approved'),
  type: z.enum(['credit_card', 'debit_card', 'ticket', 'account_money']).default('credit_card'),
})), async (req, res) => {
  if (!env.simulatePayments) throw badRequest('El pago simulado está deshabilitado');
  const order = await orders.getOrder(req.body.orderId, { userId: req.user.id });
  await service.simulatePayment(order, req.body.outcome, req.body.type);
  res.json({ order: await orders.getOrder(order.id) });
});

export default router;
