import { query } from '../../config/db.js';
import { slugify, normalizeSearch, escapeLike } from '../../utils/slugify.js';
import { notFound } from '../../utils/http-error.js';

/** Convierte una fila de v_products al formato público de la API. */
export function toProduct(r) {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    description: r.description,
    brand: r.brand,
    condition: r.condition,
    price: r.price,
    finalPrice: r.final_price,
    discountPercent: r.discount_percent,
    ownDiscount: r.own_discount,
    promoName: r.promo_name,
    stock: r.stock,
    images: r.images || [],
    active: r.active,
    featured: r.featured,
    soldCount: r.sold_count,
    category: r.category_id ? { id: r.category_id, name: r.category_name, slug: r.category_slug } : null,
    createdAt: r.created_at,
  };
}

const SORTS = {
  relevance: 'sold_count DESC, featured DESC, created_at DESC',
  price_asc: 'final_price ASC, id',
  price_desc: 'final_price DESC, id',
  newest: 'created_at DESC',
  discount: 'discount_percent DESC, sold_count DESC',
  best_sellers: 'sold_count DESC',
};

function buildWhere(f, { skipCategory = false } = {}) {
  const where = [];
  const params = [];
  const p = (v) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (!f.includeInactive) where.push('active = true');
  if (f.q) {
    const words = normalizeSearch(f.q).split(/\s+/).filter(Boolean).slice(0, 6);
    for (const w of words) where.push(`search_text LIKE ${p(`%${escapeLike(w)}%`)}`);
  }
  if (f.category && !skipCategory) where.push(`category_slug = ${p(f.category)}`);
  if (f.min != null) where.push(`final_price >= ${p(f.min)}`);
  if (f.max != null) where.push(`final_price <= ${p(f.max)}`);
  if (f.offers) where.push('discount_percent > 0');
  if (f.featured) where.push('featured = true');
  if (f.inStock) where.push('stock > 0');
  if (f.ids?.length) where.push(`id = ANY(${p(f.ids)})`);
  if (f.excludeId) where.push(`id <> ${p(f.excludeId)}`);
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function listProducts(filters) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(60, Math.max(1, filters.limit || 24));
  const order = SORTS[filters.sort] || SORTS.relevance;
  const w = buildWhere(filters);
  const wFacets = buildWhere(filters, { skipCategory: true });

  const [items, count, facets] = await Promise.all([
    query(
      `SELECT * FROM v_products ${w.sql} ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      w.params,
    ),
    query(`SELECT count(*) FROM v_products ${w.sql}`, w.params),
    filters.withFacets
      ? query(
          `SELECT category_slug AS slug, category_name AS name, count(*) AS count
           FROM v_products ${wFacets.sql}
           ${wFacets.sql ? 'AND' : 'WHERE'} category_slug IS NOT NULL
           GROUP BY category_slug, category_name ORDER BY count DESC`,
          wFacets.params,
        )
      : null,
  ]);

  const total = count.rows[0].count;
  return {
    items: items.rows.map(toProduct),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    facets: facets ? { categories: facets.rows } : undefined,
  };
}

export async function suggest(q) {
  const words = normalizeSearch(q).split(/\s+/).filter(Boolean).slice(0, 5);
  if (!words.length) return [];
  const params = words.map((w) => `%${escapeLike(w)}%`);
  const where = words.map((_, i) => `search_text LIKE $${i + 1}`).join(' AND ');
  const { rows } = await query(
    `SELECT id, title, slug, final_price, images FROM v_products
     WHERE active AND ${where} ORDER BY sold_count DESC LIMIT 8`,
    params,
  );
  return rows.map((r) => ({ id: r.id, title: r.title, slug: r.slug, finalPrice: r.final_price, image: r.images?.[0] || null }));
}

export async function getProduct(idOrSlug, { includeInactive = false } = {}) {
  const isId = /^\d+$/.test(String(idOrSlug));
  const { rows } = await query(
    `SELECT * FROM v_products WHERE ${isId ? 'id = $1' : 'slug = $1'} ${includeInactive ? '' : 'AND active'}`,
    [isId ? Number(idOrSlug) : idOrSlug],
  );
  if (!rows[0]) throw notFound('Producto no encontrado');
  return toProduct(rows[0]);
}

async function uniqueSlug(title, exceptId = null) {
  const base = slugify(title);
  const { rows } = await query(
    `SELECT slug FROM products WHERE (slug = $1 OR slug LIKE $2) AND ($3::int IS NULL OR id <> $3)`,
    [base, `${escapeLike(base)}-%`, exceptId],
  );
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function createProduct(d) {
  const slug = await uniqueSlug(d.title);
  const { rows } = await query(
    `INSERT INTO products (title, slug, description, brand, condition, price, own_discount, stock, category_id, images, active, featured)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12) RETURNING id`,
    [d.title, slug, d.description, d.brand || null, d.condition, d.price, d.ownDiscount, d.stock,
      d.categoryId || null, JSON.stringify(d.images), d.active, d.featured],
  );
  return getProduct(rows[0].id, { includeInactive: true });
}

export async function updateProduct(id, d) {
  const slug = await uniqueSlug(d.title, id);
  const { rowCount } = await query(
    `UPDATE products SET title=$2, slug=$3, description=$4, brand=$5, condition=$6, price=$7, own_discount=$8,
       stock=$9, category_id=$10, images=$11::jsonb, active=$12, featured=$13, updated_at=now()
     WHERE id = $1`,
    [id, d.title, slug, d.description, d.brand || null, d.condition, d.price, d.ownDiscount, d.stock,
      d.categoryId || null, JSON.stringify(d.images), d.active, d.featured],
  );
  if (!rowCount) throw notFound('Producto no encontrado');
  return getProduct(id, { includeInactive: true });
}

export async function patchProduct(id, patch) {
  const map = { active: 'active', featured: 'featured', stock: 'stock', ownDiscount: 'own_discount' };
  const sets = [];
  const params = [id];
  for (const [k, col] of Object.entries(map)) {
    if (patch[k] !== undefined) {
      params.push(patch[k]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length) {
    const { rowCount } = await query(`UPDATE products SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, params);
    if (!rowCount) throw notFound('Producto no encontrado');
  }
  return getProduct(id, { includeInactive: true });
}

/** Si el producto tiene ventas se desactiva (para conservar el historial), si no se borra. */
export async function deleteProduct(id) {
  const used = await query('SELECT 1 FROM order_items WHERE product_id = $1 LIMIT 1', [id]);
  if (used.rowCount) {
    await query('UPDATE products SET active = false, updated_at = now() WHERE id = $1', [id]);
    return { deleted: false, deactivated: true };
  }
  const { rowCount } = await query('DELETE FROM products WHERE id = $1', [id]);
  if (!rowCount) throw notFound('Producto no encontrado');
  return { deleted: true };
}
