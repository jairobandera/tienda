import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { env } from '../../config/env.js';
import { getSettings, updateSettings } from './settings.service.js';

export const publicRouter = Router();
export const adminRouter = Router();

publicRouter.get('/', async (req, res) => {
  const s = await getSettings();
  res.set('Cache-Control', 'public, max-age=30');
  res.json({ settings: { ...s, currency: env.currency, simulatePayments: env.simulatePayments } });
});

const schema = z
  .object({
    store_name: z.string().trim().min(1).max(80),
    whatsapp: z.string().trim().regex(/^\d{8,15}$/, 'Solo números con código de país, ej: 59897961228'),
    shipping_cost: z.coerce.number().min(0).max(1_000_000),
    free_shipping_threshold: z.coerce.number().min(0).max(100_000_000),
    pickup_enabled: z.boolean(),
    pickup_address: z.string().trim().max(200),
    cash_enabled: z.boolean(),
    max_installments: z.coerce.number().int().min(1).max(24),
    announcement: z.string().trim().max(200),
  })
  .partial();

adminRouter.get('/', async (req, res) => {
  res.json({ settings: await getSettings({ fresh: true }) });
});

adminRouter.put('/', validate(schema), async (req, res) => {
  res.json({ settings: await updateSettings(req.body) });
});
