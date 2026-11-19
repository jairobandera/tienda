/* Header, footer y comportamiento común a todas las páginas de la tienda. */
import { api } from './api.js';
import { getMe, getSettings, logout } from './session.js';
import { cartCount, onCartChange } from './cart.js';
import { $, esc, money, debounce, ICONS, productImg, setFreeShippingThreshold } from './utils.js';

function headerHtml(settings, me, categories) {
  const q = new URLSearchParams(location.search).get('q') || '';
  const user = me
    ? `<div class="user-menu">
         <button type="button" id="user-btn" aria-haspopup="true" aria-expanded="false">${ICONS.user}<span class="hide-sm">${esc(me.name.split(' ')[0])}</span> ▾</button>
         <div class="dropdown hidden" id="user-dd">
           <a href="/mi-cuenta">Mis compras</a>
           <a href="/mi-cuenta#datos">Mis datos</a>
           ${me.role === 'admin' ? '<a href="/admin">Panel de administración</a>' : ''}
           <button type="button" id="logout-btn">Salir</button>
         </div>
       </div>`
    : `<a href="/registro" class="hide-sm">Creá tu cuenta</a><a href="/ingresar">Ingresá</a>`;

  return `
    ${settings.announcement ? `<div class="announcement">${esc(settings.announcement)}</div>` : ''}
    <div class="container header-main">
      <a href="/" class="logo" aria-label="Tienda Kairos, inicio">Tienda <span>Kairos</span></a>
      <form class="search" id="search-form" role="search" action="/buscar">
        <input name="q" id="search-input" type="search" placeholder="Buscar productos, marcas y más…" value="${esc(q)}" autocomplete="off" aria-label="Buscar">
        <button type="submit" aria-label="Buscar">${ICONS.search}</button>
        <div class="suggestions hidden" id="suggestions" role="listbox"></div>
      </form>
      <nav class="header-actions">
        ${user}
        ${me ? '<a href="/mi-cuenta" class="hide-sm">Mis compras</a>' : ''}
        <a href="/carrito" class="cart-link" aria-label="Carrito">${ICONS.cart}<span class="cart-badge hidden" id="cart-badge">0</span></a>
      </nav>
    </div>
    <nav class="container header-nav" aria-label="Categorías">
      <a href="/buscar?offers=1" class="hot">Ofertas</a>
      ${categories.slice(0, 8).map((c) => `<a href="/buscar?category=${encodeURIComponent(c.slug)}">${esc(c.name)}</a>`).join('')}
      <a href="/buscar?sort=newest">Novedades</a>
    </nav>`;
}

function footerHtml(settings) {
  const year = new Date().getFullYear();
  return `
    <div class="container footer-grid">
      <div>
        <h4>Tienda Kairos</h4>
        <p>Productos seleccionados con envío a todo Uruguay. Pagá de forma segura con Mercado Pago: tarjetas de crédito, débito o efectivo.</p>
      </div>
      <div>
        <h4>Ayuda</h4>
        <a href="https://wa.me/${esc(settings.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>
        <a href="/mi-cuenta">Mis compras</a>
      </div>
      <div>
        <h4>Comprar</h4>
        <a href="/buscar?offers=1">Ofertas</a>
        <a href="/buscar?sort=best_sellers">Más vendidos</a>
        <a href="/buscar?sort=newest">Novedades</a>
      </div>
    </div>
    <div class="footer-bottom">© ${year} Tienda Kairos · Todos los derechos reservados</div>`;
}

function setupSearch() {
  const input = $('#search-input');
  const box = $('#suggestions');
  let active = -1;

  const close = () => {
    box.classList.add('hidden');
    active = -1;
  };

  const render = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) return close();
    const { suggestions } = await api.get(`/products/suggest?q=${encodeURIComponent(q)}`).catch(() => ({ suggestions: [] }));
    if (input.value.trim() !== q) return;
    if (!suggestions.length) return close();
    box.innerHTML = suggestions
      .map((s) => `<a href="/p/${encodeURIComponent(s.slug)}" role="option">${productImg(s, { alt: '' })}<span>${esc(s.title)}</span><span class="price">${money(s.finalPrice)}</span></a>`)
      .join('');
    box.classList.remove('hidden');
  }, 200);

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    const links = [...box.querySelectorAll('a')];
    if (!links.length || box.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((l, i) => l.classList.toggle('active', i === active));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      location.href = links[active].href;
    } else if (e.key === 'Escape') close();
  });
  document.addEventListener('click', (e) => !e.target.closest('.search') && close());
  $('#search-form').addEventListener('submit', (e) => {
    if (!input.value.trim()) e.preventDefault();
  });
}

function setupUserMenu() {
  const btn = $('#user-btn');
  if (!btn) return;
  const dd = $('#user-dd');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dd.classList.toggle('hidden');
    btn.setAttribute('aria-expanded', String(!dd.classList.contains('hidden')));
  });
  document.addEventListener('click', () => dd.classList.add('hidden'));
  $('#logout-btn').addEventListener('click', logout);
}

function updateBadge(n) {
  const b = $('#cart-badge');
  if (!b) return;
  b.textContent = n > 99 ? '99+' : n;
  b.classList.toggle('hidden', !n);
}

/** Inicializa el layout. Devuelve { me, settings } para la página. */
export async function initLayout() {
  const headerEl = document.createElement('header');
  headerEl.className = 'site-header';
  document.body.prepend(headerEl);

  const [settings, me, cats] = await Promise.all([
    getSettings(),
    getMe(),
    api.get('/categories').catch(() => ({ categories: [] })),
  ]);
  setFreeShippingThreshold(settings.free_shipping_threshold);

  headerEl.innerHTML = headerHtml(settings, me, cats.categories);
  const footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML = footerHtml(settings);
  document.body.append(footer);

  const wa = document.createElement('a');
  wa.className = 'wa-float';
  wa.href = `https://wa.me/${settings.whatsapp}`;
  wa.target = '_blank';
  wa.rel = 'noopener';
  wa.setAttribute('aria-label', 'Escribinos por WhatsApp');
  wa.innerHTML = ICONS.whatsapp;
  document.body.append(wa);

  setupSearch();
  setupUserMenu();
  onCartChange(updateBadge);
  cartCount().then(updateBadge);

  return { me, settings, categories: cats.categories };
}
