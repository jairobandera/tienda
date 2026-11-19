import { query } from '../../config/db.js';
import { env } from '../../config/env.js';

/** Colores y estilo de la tienda (se sirven como /theme.css). */
export const DEFAULT_THEME = {
  header_bg: '#0e1e45',
  header_text: '#ffffff',
  accent: '#ffc21a',
  accent_text: '#0e1e45',
  primary: '#2563eb',
  announcement_bg: '#ffc21a',
  announcement_text: '#0e1e45',
  hero_from: '#0e1e45',
  hero_to: '#2a4fa8',
  hero_text: '#ffffff',
  promo_from: '#0b0b0f',
  promo_to: '#3b2a00',
  page_bg: '#ededed',
  footer_bg: '#ffffff',
  footer_text: '#6b7280',
  radius: 8,
};

export const DEFAULT_BRANDING = {
  logo_url: '',
  logo_height: 40,
  show_name_with_logo: false,
  highlight_last_word: true,
};

export const DEFAULT_HOME = {
  hero_show: true,
  hero_eyebrow: 'Bienvenido a',
  hero_title: '',
  hero_text: 'El momento justo para comprar lo que querés. Envíos a todo Uruguay y pagos seguros.',
  hero_button_text: 'Ver productos',
  hero_button_link: '/buscar',
  hero_image: '',
  benefits_show: true,
  benefits: [
    { title: 'Pagá como quieras', text: 'Tarjetas, débito o efectivo' },
    { title: 'Envíos a todo el país', text: '' },
    { title: 'Compra protegida', text: 'Con Mercado Pago' },
    { title: 'Atención directa', text: 'Por WhatsApp' },
  ],
  offers_show: true,
  offers_title: 'Ofertas',
  categories_show: true,
  categories_title: 'Categorías',
  featured_show: true,
  featured_title: 'Destacados',
  newest_show: true,
  newest_title: 'Recién llegados',
  whatsapp_float: true,
};

export const DEFAULT_FOOTER = {
  about: 'Productos seleccionados con envío a todo Uruguay. Pagá de forma segura con Mercado Pago: tarjetas de crédito, débito o efectivo.',
  copyright: '',
  instagram: '',
  facebook: '',
  tiktok: '',
};

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
  theme: DEFAULT_THEME,
  branding: DEFAULT_BRANDING,
  home: DEFAULT_HOME,
  footer: DEFAULT_FOOTER,
};

const isPlainObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

let cache = null;
let cacheAt = 0;
const TTL = 30_000;

export async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < TTL) return cache;
  const { rows } = await query('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const merged = {};
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const v = stored[key];
    // Los grupos (theme, home…) se combinan con los valores por defecto: así un campo nuevo siempre tiene valor.
    merged[key] = isPlainObject(def) ? { ...def, ...(isPlainObject(v) ? v : {}) } : v ?? def;
  }
  cache = merged;
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

/** Hoja de estilos con los colores elegidos en el panel (se carga después de styles.css). */
export function themeCss(s) {
  const t = s.theme;
  const b = s.branding;
  const r = Number(t.radius);
  const lines = [
    `--brand:${t.header_bg}`,
    `--header-text:${t.header_text}`,
    `--accent:${t.accent}`,
    `--accent-text:${t.accent_text}`,
    `--primary:${t.primary}`,
    `--announce-bg:${t.announcement_bg}`,
    `--announce-text:${t.announcement_text}`,
    `--hero-from:${t.hero_from}`,
    `--hero-to:${t.hero_to}`,
    `--hero-text:${t.hero_text}`,
    `--promo-from:${t.promo_from}`,
    `--promo-to:${t.promo_to}`,
    `--bg:${t.page_bg}`,
    `--footer-bg:${t.footer_bg}`,
    `--footer-text:${t.footer_text}`,
    `--radius:${r}px`,
    `--radius-lg:${r + 4}px`,
    `--btn-radius:${Math.max(0, r - 2)}px`,
    `--logo-h:${Number(b.logo_height)}px`,
  ];
  let css = `:root{${lines.join(';')}}\n`;
  const img = s.home.hero_image;
  if (img) {
    css += `.slide.main{background:linear-gradient(90deg,${t.hero_from} 0%,${t.hero_from}cc 45%,${t.hero_to}33 100%),url("${img}") center/cover no-repeat}\n`;
  }
  return css;
}

export function computeShipping(settings, itemsTotal, method) {
  if (method === 'pickup') return 0;
  const threshold = Number(settings.free_shipping_threshold) || 0;
  if (threshold > 0 && itemsTotal >= threshold) return 0;
  return Number(settings.shipping_cost) || 0;
}
