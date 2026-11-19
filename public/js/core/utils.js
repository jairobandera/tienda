/* Utilidades compartidas: formato, escape, toasts, tarjetas de producto, WhatsApp. */

const moneyFmt = new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const money = (n) => `$ ${moneyFmt.format(Number(n) || 0)}`;

/** Precio grande con decimales en superíndice, estilo marketplace. */
export function priceHtml(n) {
  const v = Number(n) || 0;
  const int = Math.floor(v);
  const cents = Math.round((v - int) * 100);
  return `$ ${new Intl.NumberFormat('es-UY').format(int)}${cents ? `<sup>${String(cents).padStart(2, '0')}</sup>` : ''}`;
}

export const date = (d) => new Date(d).toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' });
export const dateTime = (d) => new Date(d).toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------- Toasts ----------
export function toast(message, type = 'info', { linkText, linkHref, timeout = 3500 } = {}) {
  let wrap = $('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    wrap.setAttribute('role', 'status');
    document.body.append(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${esc(message)}${linkText ? `<a href="${esc(linkHref)}">${esc(linkText)}</a>` : ''}`;
  wrap.append(el);
  setTimeout(() => el.remove(), timeout);
}

// ---------- Placeholders de imagen (sin logo/imagenes aún) ----------
const PALETTE = ['#2563eb', '#0e9f6e', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#475569', '#16306b'];
export function colorFor(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export function placeholder(title, cls = 'ph') {
  const initials = String(title || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return `<div class="${cls}" style="background:${colorFor(title)}" aria-hidden="true">${esc(initials)}</div>`;
}
export function productImg(p, { size = '', alt } = {}) {
  const src = p.images?.[0] || p.image;
  return src
    ? `<img src="${esc(src)}" alt="${esc(alt ?? p.title)}" loading="lazy" decoding="async" ${size}>`
    : placeholder(p.title);
}

// ---------- Tarjeta de producto ----------
let freeShippingThreshold = 0;
export const setFreeShippingThreshold = (n) => (freeShippingThreshold = Number(n) || 0);

export function productCard(p) {
  const hasDiscount = p.discountPercent > 0;
  const free = freeShippingThreshold > 0 && p.finalPrice >= freeShippingThreshold;
  return `
    <a class="p-card" href="/p/${encodeURIComponent(p.slug)}">
      ${p.promoName ? `<span class="tag">${esc(p.promoName)}</span>` : ''}
      <div class="img">${productImg(p)}</div>
      <div class="body">
        <span class="old">${hasDiscount ? money(p.price) : ''}</span>
        <div class="price-row">
          <span class="price">${priceHtml(p.finalPrice)}</span>
          ${hasDiscount ? `<span class="off">${Math.round(p.discountPercent)}% OFF</span>` : ''}
        </div>
        ${p.stock < 1 ? '<span class="out-of-stock">Sin stock</span>' : free ? '<span class="free-ship">Envío gratis</span>' : ''}
        <span class="title">${esc(p.title)}</span>
      </div>
    </a>`;
}

export const skeletonCards = (n = 8) => Array.from({ length: n }, () => '<div class="skeleton sk-card"></div>').join('');

// ---------- Pedidos ----------
export const STATUS_LABELS = {
  pending: 'Pendiente de pago',
  paid: 'Pagado',
  preparing: 'En preparación',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  rejected: 'Pago rechazado',
  refunded: 'Reembolsado',
};
export const statusBadge = (s) => `<span class="badge ${esc(s)}">${esc(STATUS_LABELS[s] || s)}</span>`;

const PAYMENT_TYPES = {
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
  prepaid_card: 'Tarjeta prepaga',
  ticket: 'Efectivo (Abitab / RedPagos)',
  account_money: 'Dinero en cuenta Mercado Pago',
  bank_transfer: 'Transferencia bancaria',
  atm: 'Cajero',
  cash: 'Efectivo (coordinar)',
  mercadopago: 'Mercado Pago',
  simulated: 'Simulado',
};
export function paymentLabel(o) {
  if (o.payment_provider === 'cash') return 'Efectivo / transferencia (coordinar)';
  const type = PAYMENT_TYPES[o.payment_type] || (o.payment_type ? o.payment_type : 'Mercado Pago');
  const method = o.payment_method && o.payment_type !== 'ticket' ? ` · ${o.payment_method.toUpperCase()}` : '';
  const inst = o.installments > 1 ? ` · ${o.installments} cuotas` : '';
  return `${type}${method}${inst}`;
}

export function addressText(o) {
  if (o.shipping_method === 'pickup') return 'Retiro en local';
  return [
    [o.ship_street, o.ship_number].filter(Boolean).join(' '),
    o.ship_apartment && `Apto ${o.ship_apartment}`,
    o.ship_city,
    o.ship_department,
    o.ship_postal_code && `CP ${o.ship_postal_code}`,
  ].filter(Boolean).join(', ');
}

/** Mensaje de WhatsApp con la descripción de la compra. */
export function whatsappUrl(number, order) {
  if (!order) return `https://wa.me/${number}`;
  const lines = [
    `¡Hola Tienda Kairos! 👋 Realicé la compra *#${order.id}*`,
    '',
    ...order.items.map((i) => `• ${i.quantity} x ${i.title} — ${money(i.unit_price * i.quantity)}`),
    '',
    order.shipping_cost > 0 ? `Envío: ${money(order.shipping_cost)}` : null,
    `*Total: ${money(order.total)}*`,
    `Pago: ${paymentLabel(order)} (${STATUS_LABELS[order.status] || order.status})`,
    `Entrega: ${addressText(order)}`,
    `Nombre: ${order.ship_name} · Tel: ${order.ship_phone}`,
  ].filter((l) => l !== null);
  return `https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/** Convierte un teléfono uruguayo a formato internacional para wa.me. */
export function phoneToWa(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = `598${d.slice(1)}`;
  else if (d.length === 8 && d.startsWith('9')) d = `598${d}`;
  return d;
}

export const ICONS = {
  cart: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1.4"/><circle cx="19" cy="21" r="1.4"/><path d="M2.5 3h3l2.6 12.4a1.5 1.5 0 0 0 1.5 1.1h8.9a1.5 1.5 0 0 0 1.5-1.2L21.5 7H6.2"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  whatsapp: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4c-1-1.6-1.5-3.4-1.5-5.2C2.2 6.6 6.6 2.2 12 2.2c2.6 0 5.1 1 6.9 2.9 1.9 1.9 2.9 4.3 2.9 6.9 0 5.4-4.4 9.8-9.8 9.8zm8.4-18.2C18.1 1.3 15.2.1 12 .1 5.5.1.1 5.4.1 12c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.6c1.7.9 3.7 1.4 5.7 1.4 6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.5-8.4z"/></svg>',
  truck: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 4h13v11H1zM14 8h4l4 4v3h-8z"/><circle cx="5.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/></svg>',
  card: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
  shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  tag: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/></svg>',
  check: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>',
  clock: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  x: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
};
