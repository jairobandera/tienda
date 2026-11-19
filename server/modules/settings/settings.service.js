import { query } from '../../config/db.js';
import { env } from '../../config/env.js';

export const DEFAULT_SETTINGS = {
  store_name: 'Tienda Kairos',
  whatsapp: env.whatsapp,
  shipping_cost: 250,
  free_shipping_threshold: 3000,
  pickup_enabled: true,
  pickup_address: 'Coordinar por WhatsApp',
  cash_enabled: true,
  max_installments: 12,
  announcement: 'Envíos a todo Uruguay · Pagá con tarjeta, débito o efectivo con Mercado Pago',
};

let cache = null;
let cacheAt = 0;
const TTL = 30_000;

export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < TTL) return cache;
  const { rows } = await query('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cache = { ...DEFAULT_SETTINGS, ...stored };
  cacheAt = Date.now();
  return cache;
}

export async function updateSettings(patch) {
  const entries = Object.entries(patch).filter(([k]) => k in DEFAULT_SETTINGS);
  for (const [key, value] of entries) {
    await query(
      `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, JSON.stringify(value)],
    );
  }
  cache = null;
  return getSettings({ fresh: true });
}

export function computeShipping(settings, itemsTotal, method) {
  if (method === 'pickup') return 0;
  const threshold = Number(settings.free_shipping_threshold) || 0;
  if (threshold > 0 && itemsTotal >= threshold) return 0;
  return Number(settings.shipping_cost) || 0;
}
