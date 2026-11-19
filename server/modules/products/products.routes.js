import { Router } from 'express';
import { z } from 'zod';
import { validate, idParam } from '../../middleware/validate.js';
import * as service from './products.service.js';

export const publicRouter = Router();
export const adminRouter = Router();

const bool = z.preprocess((v) => v === '1' || v === 'true' || v === true, z.boolean()).optional();
const num = z.coerce.number().min(0).optional();

const listQuery = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  min: num,
  max: num,
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'discount', 'best_sellers']).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  offers: bool,
  featured: bool,
  inStock: bool,
  exclude: z.coerce.number().int().optional(),
  ids: z.string().regex(/^\d+(,\d+)*$/).max(1000).optional(),
  facets: bool,
});

publicRouter.get('/', validate(listQuery, 'query'), async (req, res) => {
  const f = req.validQuery;
  const ids = f.ids ? f.ids.split(',').map(Number).slice(0, 100) : undefined;
  const data = await service.listProducts({ ...f, ids, excludeId: f.exclude, withFacets: f.facets });
  res.set('Cache-Control', 'public, max-age=15');
  res.json(data);
});

publicRouter.get('/suggest', async (req, res) => {
  const q = String(req.query.q || '').slice(0, 80);
  res.set('Cache-Control', 'public, max-age=30');
  res.json({ suggestions: q.length >= 2 ? await service.suggest(q) : [] });
});

publicRouter.get('/:slug', async (req, res) => {
  res.json({ product: await service.getProduct(req.params.slug) });
});

// ---------- Admin ----------
const productSchema = z.object({
  title: z.string().trim().min(3, 'Mínimo 3 caracteres').max(200),
  description: z.string().max(10_000).default(''),
  brand: z.string().trim().max(100).optional().nullable(),
  condition: z.enum(['nuevo', 'usado']).default('nuevo'),
  price: z.coerce.number().min(0).max(100_000_000),
  ownDiscount: z.coerce.number().min(0).max(95).default(0),
  stock: z.coerce.number().int().min(0).max(1_000_000),
  categoryId: z.coerce.number().int().positive().optional().nullable(),
  images: z.array(z.string().trim().max(500).regex(/^(\/uploads\/|https:\/\/)/, 'URL de imagen inválida')).max(12).default([]),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
});

const patchSchema = z.object({
  active: z.boolean().optional(),
  featured: z.boolean().optional(),
  stock: z.coerce.number().int().min(0).optional(),
  ownDiscount: z.coerce.number().min(0).max(95).optional(),
});

const bulkDiscountSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(1000),
  ownDiscount: z.coerce.number().min(0).max(95),
});

adminRouter.get('/', validate(listQuery, 'query'), async (req, res) => {
  const f = req.validQuery;
  const ids = f.ids ? f.ids.split(',').map(Number).slice(0, 100) : undefined;
  res.json(await service.listProducts({ ...f, ids, sort: f.sort || 'newest', includeInactive: true, limit: f.limit || 50 }));
});

adminRouter.get('/:id', async (req, res) => {
  res.json({ product: await service.getProduct(idParam(req), { includeInactive: true }) });
});

adminRouter.post('/', validate(productSchema), async (req, res) => {
  res.status(201).json({ product: await service.createProduct(req.body) });
});

adminRouter.post('/bulk-discount', validate(bulkDiscountSchema), async (req, res) => {
  for (const id of req.body.ids) await service.patchProduct(id, { ownDiscount: req.body.ownDiscount });
  res.json({ ok: true, updated: req.body.ids.length });
});

adminRouter.put('/:id', validate(productSchema), async (req, res) => {
  res.json({ product: await service.updateProduct(idParam(req), req.body) });
});

adminRouter.patch('/:id', validate(patchSchema), async (req, res) => {
  res.json({ product: await service.patchProduct(idParam(req), req.body) });
});

adminRouter.delete('/:id', async (req, res) => {
  res.json(await service.deleteProduct(idParam(req)));
});
