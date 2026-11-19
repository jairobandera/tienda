import { Router } from 'express';
import { z } from 'zod';
import { validate, idParam } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { badRequest } from '../../utils/http-error.js';
import * as service from './orders.service.js';
import { createPaymentLink } from '../payments/payments.service.js';
import { getProfile } from '../auth/auth.service.js';

export const userRouter = Router();
export const adminRouter = Router();

userRouter.use(requireAuth);

const text = (max) => z.string().trim().max(max);
const addressSchema = z.object({
  street: text(160).min(2, 'Ingresá la calle'),
  number: text(20).optional(),
  apartment: text(40).optional(),
  city: text(100).min(2, 'Ingresá la ciudad'),
  department: text(100).min(2, 'Ingresá el departamento'),
  postalCode: text(20).optional(),
  notes: text(300).optional(),
});

const createSchema = z
  .object({
    name: text(120).min(2, 'Ingresá el nombre de quien recibe'),
    phone: text(40).regex(/^[+\d\s()-]{6,}$/, 'Teléfono inválido'),
    shippingMethod: z.enum(['delivery', 'pickup']),
    paymentMethod: z.enum(['mercadopago', 'cash']).default('mercadopago'),
    address: addressSchema.optional(),
    saveAddress: z.boolean().default(true),
    notes: text(500).optional(),
  })
  .refine((d) => d.shippingMethod === 'pickup' || d.address, { message: 'Ingresá la dirección de envío', path: ['address'] });

userRouter.post('/', validate(createSchema), async (req, res) => {
  const order = await service.createOrderFromCart(req.user.id, req.body);
  let paymentUrl = null;
  let paymentError = null;
  try {
    const user = await getProfile(req.user.id);
    paymentUrl = await createPaymentLink(order, { name: req.body.name, email: user.email });
  } catch (err) {
    console.error('[orders] no se pudo crear el link de pago', err.message);
    paymentError = 'No pudimos conectar con Mercado Pago. Podés reintentar el pago desde "Mis compras".';
  }
  res.status(201).json({ order, paymentUrl, paymentError });
});

userRouter.get('/', async (req, res) => {
  res.json({ orders: await service.listUserOrders(req.user.id) });
});

userRouter.get('/:id', async (req, res) => {
  res.json({ order: await service.getOrder(idParam(req), { userId: req.user.id }) });
});

/** Reintentar el pago de un pedido pendiente o rechazado. */
userRouter.post('/:id/pay', async (req, res) => {
  const order = await service.getOrder(idParam(req), { userId: req.user.id });
  if (!['pending', 'rejected'].includes(order.status) || order.paid_at) throw badRequest('Este pedido no admite un nuevo pago');
  if (order.payment_provider === 'cash') throw badRequest('Este pedido se paga en efectivo: coordiná por WhatsApp');
  const paymentUrl = await createPaymentLink(order, { name: order.ship_name, email: order.user_email });
  res.json({ paymentUrl });
});

// ---------------- Admin ----------------
const listQuery = z.object({
  status: z.enum(service.ORDER_STATUSES).optional(),
  payment: z.string().max(40).optional(),
  q: z.string().max(120).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

adminRouter.get('/', validate(listQuery, 'query'), async (req, res) => {
  res.json(await service.adminListOrders(req.validQuery));
});

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

adminRouter.get('/export.csv', validate(listQuery, 'query'), async (req, res) => {
  const rows = await service.adminExportOrders(req.validQuery);
  const cols = [
    ['Pedido', 'id'], ['Fecha', 'created_at'], ['Estado', 'status'], ['Cliente', 'user_name'], ['Email', 'user_email'],
    ['Teléfono', 'ship_phone'], ['Recibe', 'ship_name'], ['Proveedor', 'payment_provider'], ['Tipo de pago', 'payment_type'],
    ['Medio', 'payment_method'], ['Cuotas', 'installments'], ['Pago MP', 'mp_payment_id'], ['Subtotal', 'subtotal'],
    ['Descuento', 'discount_total'], ['Envío', 'shipping_cost'], ['Total', 'total'], ['Entrega', 'shipping_method'],
    ['Calle', 'ship_street'], ['Número', 'ship_number'], ['Apto', 'ship_apartment'], ['Ciudad', 'ship_city'],
    ['Departamento', 'ship_department'], ['CP', 'ship_postal_code'], ['Detalle', 'detail'],
  ];
  const csv = [cols.map((c) => c[0]).join(';'), ...rows.map((r) => cols.map((c) => csvCell(r[c[1]])).join(';'))].join('\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="pedidos-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + csv);
});

adminRouter.get('/stats', async (req, res) => {
  res.json(await service.adminStats());
});

adminRouter.get('/:id', async (req, res) => {
  res.json({ order: await service.getOrder(idParam(req)) });
});

const updateSchema = z.object({
  status: z.enum(service.ORDER_STATUSES).optional(),
  adminNotes: z.string().max(5000).optional(),
  trackingCode: z.string().max(120).optional(),
});

adminRouter.patch('/:id', validate(updateSchema), async (req, res) => {
  res.json({ order: await service.adminUpdateOrder(idParam(req), req.body) });
});
