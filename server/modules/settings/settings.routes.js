import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { env } from '../../config/env.js';
import { getSettings, updateSettings } from './settings.service.js';

export const publicRouter = Router();
export const adminRouter = Router();

publicRouter.get('/', async (req, res) => {
  const s = await getSettings();
  res.set('Cache-Control', 'no-cache'); // revalida (ETag): los cambios del panel se ven al recargar
  res.json({ settings: { ...s, currency: env.currency, simulatePayments: env.simulatePayments } });
});

const color = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido (formato #RRGGBB)').transform((c) => c.toLowerCase());
// Imagen subida a la tienda o dirección https (sin comillas ni paréntesis: se usa dentro de CSS).
const image = z.union([z.literal(''), z.string().trim().max(300).regex(/^(\/uploads\/[\w./-]+|https:\/\/[^\s"'()\<>]+)$/, 'Imagen inválida')]);
const httpsUrl = z.union([z.literal(''), z.string().trim().max(300).regex(/^https:\/\/[^\s"'<>]+$/, 'El link tiene que empezar con https://')]);
const link = z.union([z.literal(''), z.string().trim().max(300).regex(/^(\/[^\s"'<>]*|https:\/\/[^\s"'<>]+)$/, 'El link tiene que empezar con / o https://')]);
const text = (max) => z.string().trim().max(max);

const theme = z.object({
  header_bg: color,
  header_text: color,
  accent: color,
  accent_text: color,
  primary: color,
  announcement_bg: color,
  announcement_text: color,
  hero_from: color,
  hero_to: color,
  hero_text: color,
  promo_from: color,
  promo_to: color,
  page_bg: color,
  footer_bg: color,
  footer_text: color,
  radius: z.coerce.number().int().min(0).max(24),
});

const branding = z.object({
  logo_url: image,
  logo_height: z.coerce.number().int().min(20).max(90),
  show_name_with_logo: z.boolean(),
  highlight_last_word: z.boolean(),
});

const home = z.object({
  hero_show: z.boolean(),
  hero_eyebrow: text(60),
  hero_title: text(80),
  hero_text: text(240),
  hero_button_text: text(40),
  hero_button_link: link,
  hero_image: image,
  benefits_show: z.boolean(),
  benefits: z.array(z.object({ title: text(50), text: text(80) })).length(4),
  offers_show: z.boolean(),
  offers_title: text(50),
  categories_show: z.boolean(),
  categories_title: text(50),
  featured_show: z.boolean(),
  featured_title: text(50),
  newest_show: z.boolean(),
  newest_title: text(50),
  whatsapp_float: z.boolean(),
});

const footer = z.object({
  about: text(400),
  copyright: text(120),
  instagram: httpsUrl,
  facebook: httpsUrl,
  tiktok: httpsUrl,
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
    theme,
    branding,
    home,
    footer,
  })
  .partial();

adminRouter.get('/', async (req, res) => {
  res.json({ settings: await getSettings({ fresh: true }) });
});

adminRouter.put('/', validate(schema), async (req, res) => {
  res.json({ settings: await updateSettings(req.body) });
});
