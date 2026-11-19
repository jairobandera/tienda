import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { validate, idParam } from '../../middleware/validate.js';
import { slugify } from '../../utils/slugify.js';
import { notFound } from '../../utils/http-error.js';

export const publicRouter = Router();
export const adminRouter = Router();

const LIST_SQL = `
  SELECT c.id, c.name, c.slug, c.sort_order,
         count(p.id) FILTER (WHERE p.active) AS product_count
  FROM categories c
  LEFT JOIN products p ON p.category_id = c.id
  GROUP BY c.id
  ORDER BY c.sort_order, c.name`;

publicRouter.get('/', async (req, res) => {
  const { rows } = await query(LIST_SQL);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ categories: rows });
});

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

adminRouter.get('/', async (req, res) => {
  const { rows } = await query(LIST_SQL);
  res.json({ categories: rows });
});

adminRouter.post('/', validate(schema), async (req, res) => {
  const { rows } = await query(
    'INSERT INTO categories (name, slug, sort_order) VALUES ($1, $2, $3) RETURNING *',
    [req.body.name, slugify(req.body.name), req.body.sortOrder],
  );
  res.status(201).json({ category: rows[0] });
});

adminRouter.put('/:id', validate(schema), async (req, res) => {
  const { rows } = await query(
    'UPDATE categories SET name = $2, slug = $3, sort_order = $4 WHERE id = $1 RETURNING *',
    [idParam(req), req.body.name, slugify(req.body.name), req.body.sortOrder],
  );
  if (!rows[0]) throw notFound('Categoría no encontrada');
  res.json({ category: rows[0] });
});

adminRouter.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM categories WHERE id = $1', [idParam(req)]);
  if (!rowCount) throw notFound('Categoría no encontrada');
  res.json({ ok: true });
});
