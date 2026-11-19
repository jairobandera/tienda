import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../config/db.js';
import { validate, idParam } from '../../middleware/validate.js';
import { notFound } from '../../utils/http-error.js';

export const publicRouter = Router();
export const adminRouter = Router();

const ACTIVE = `p.active AND (p.starts_at IS NULL OR p.starts_at <= now()) AND (p.ends_at IS NULL OR p.ends_at > now())`;

/** Promociones vigentes (para banners de la portada). */
publicRouter.get('/active', async (req, res) => {
  const { rows } = await query(
    `SELECT p.id, p.name, p.banner_text, p.discount_percent, p.scope, p.ends_at,
       (SELECT c.slug FROM promotion_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.promotion_id = p.id LIMIT 1) AS category_slug
     FROM promotions p WHERE ${ACTIVE} AND p.show_banner ORDER BY p.discount_percent DESC`,
  );
  res.set('Cache-Control', 'public, max-age=30');
  res.json({ promotions: rows });
});

const schema = z
  .object({
    name: z.string().trim().min(2).max(120),
    bannerText: z.string().trim().max(240).optional().nullable(),
    discountPercent: z.coerce.number().gt(0).lt(100),
    scope: z.enum(['all', 'products', 'categories']),
    productIds: z.array(z.number().int().positive()).max(5000).default([]),
    categoryIds: z.array(z.number().int().positive()).max(500).default([]),
    startsAt: z.string().datetime({ offset: true }).optional().nullable().or(z.literal('')),
    endsAt: z.string().datetime({ offset: true }).optional().nullable().or(z.literal('')),
    active: z.boolean().default(true),
    showBanner: z.boolean().default(true),
  })
  .refine((d) => d.scope !== 'products' || d.productIds.length, { message: 'Elegí al menos un producto', path: ['productIds'] })
  .refine((d) => d.scope !== 'categories' || d.categoryIds.length, { message: 'Elegí al menos una categoría', path: ['categoryIds'] })
  .refine((d) => !d.startsAt || !d.endsAt || new Date(d.startsAt) < new Date(d.endsAt), { message: 'La fecha de fin debe ser posterior al inicio', path: ['endsAt'] });

async function getPromotion(id) {
  const { rows } = await query(
    `SELECT p.*, ${ACTIVE} AS running,
       coalesce((SELECT array_agg(product_id) FROM promotion_products WHERE promotion_id = p.id), '{}') AS product_ids,
       coalesce((SELECT array_agg(category_id) FROM promotion_categories WHERE promotion_id = p.id), '{}') AS category_ids
     FROM promotions p WHERE p.id = $1`,
    [id],
  );
  if (!rows[0]) throw notFound('Promoción no encontrada');
  return rows[0];
}

async function savePromotion(id, d) {
  return withTransaction(async (db) => {
    const values = [d.name, d.bannerText || null, d.discountPercent, d.scope, d.startsAt || null, d.endsAt || null, d.active, d.showBanner];
    let promoId = id;
    if (id) {
      const { rowCount } = await db.query(
        `UPDATE promotions SET name=$2, banner_text=$3, discount_percent=$4, scope=$5, starts_at=$6, ends_at=$7, active=$8, show_banner=$9 WHERE id=$1`,
        [id, ...values],
      );
      if (!rowCount) throw notFound('Promoción no encontrada');
      await db.query('DELETE FROM promotion_products WHERE promotion_id = $1', [id]);
      await db.query('DELETE FROM promotion_categories WHERE promotion_id = $1', [id]);
    } else {
      const { rows } = await db.query(
        `INSERT INTO promotions (name, banner_text, discount_percent, scope, starts_at, ends_at, active, show_banner)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        values,
      );
      promoId = rows[0].id;
    }
    if (d.scope === 'products') {
      await db.query(
        `INSERT INTO promotion_products (promotion_id, product_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
        [promoId, d.productIds],
      );
    }
    if (d.scope === 'categories') {
      await db.query(
        `INSERT INTO promotion_categories (promotion_id, category_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
        [promoId, d.categoryIds],
      );
    }
    return promoId;
  });
}

adminRouter.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT p.*, ${ACTIVE} AS running,
       (SELECT count(*) FROM promotion_products WHERE promotion_id = p.id) AS product_count,
       (SELECT count(*) FROM promotion_categories WHERE promotion_id = p.id) AS category_count
     FROM promotions p ORDER BY p.created_at DESC`,
  );
  res.json({ promotions: rows });
});

adminRouter.get('/:id', async (req, res) => res.json({ promotion: await getPromotion(idParam(req)) }));

adminRouter.post('/', validate(schema), async (req, res) => {
  res.status(201).json({ promotion: await getPromotion(await savePromotion(null, req.body)) });
});

adminRouter.put('/:id', validate(schema), async (req, res) => {
  res.json({ promotion: await getPromotion(await savePromotion(idParam(req), req.body)) });
});

adminRouter.patch('/:id', validate(z.object({ active: z.boolean() })), async (req, res) => {
  await query('UPDATE promotions SET active = $2 WHERE id = $1', [idParam(req), req.body.active]);
  res.json({ promotion: await getPromotion(idParam(req)) });
});

adminRouter.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM promotions WHERE id = $1', [idParam(req)]);
  if (!rowCount) throw notFound('Promoción no encontrada');
  res.json({ ok: true });
});
