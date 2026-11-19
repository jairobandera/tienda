import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { badRequest } from '../../utils/http-error.js';
import * as service from './cart.service.js';

const router = Router();
router.use(requireAuth);

const productId = (req) => {
  const id = Number(req.params.productId);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Producto inválido');
  return id;
};
const qtySchema = z.object({ quantity: z.coerce.number().int().min(0).max(999) });
const mergeSchema = z.object({
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(999) })).max(100),
});

router.get('/', async (req, res) => res.json(await service.getCart(req.user.id)));

router.post('/items/:productId', validate(qtySchema), async (req, res) => {
  res.json(await service.addItem(req.user.id, productId(req), req.body.quantity || 1));
});

router.put('/items/:productId', validate(qtySchema), async (req, res) => {
  res.json(await service.setItem(req.user.id, productId(req), req.body.quantity));
});

router.delete('/items/:productId', async (req, res) => {
  res.json(await service.setItem(req.user.id, productId(req), 0));
});

router.post('/merge', validate(mergeSchema), async (req, res) => {
  res.json(await service.mergeCart(req.user.id, req.body.items));
});

router.delete('/', async (req, res) => {
  await service.clearCart(req.user.id);
  res.json(await service.getCart(req.user.id));
});

export default router;
