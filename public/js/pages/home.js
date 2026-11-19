import { api } from '../core/api.js';
import { initLayout } from '../core/layout.js';
import { $, $$, esc, money, productCard, skeletonCards, colorFor, ICONS } from '../core/utils.js';

const { settings, categories } = await initLayout();

$$('[data-icon]').forEach((el) => (el.innerHTML = ICONS[el.dataset.icon] || ''));
if (settings.free_shipping_threshold > 0) $('#ship-note').textContent = `Gratis desde ${money(settings.free_shipping_threshold)}`;

// ---------- Banner de promociones ----------
function countdown(endsAt) {
  const ms = new Date(endsAt) - Date.now();
  if (ms <= 0) return '';
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  const s = Math.floor((ms % 6e4) / 1e3);
  return `Termina en ${d ? `${d}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function loadHero() {
  const { promotions } = await api.get('/promotions/active').catch(() => ({ promotions: [] }));
  if (!promotions.length) return;
  const slides = $('#slides');
  slides.insertAdjacentHTML(
    'afterbegin',
    promotions
      .map((p) => {
        const href = p.scope === 'categories' && p.category_slug ? `/buscar?category=${encodeURIComponent(p.category_slug)}&offers=1` : '/buscar?offers=1';
        return `<div class="slide promo">
          <span class="eyebrow">${esc(p.name)}</span>
          <h1>Hasta <em>${Math.round(p.discount_percent)}% OFF</em></h1>
          <p>${esc(p.banner_text || (p.scope === 'all' ? 'En toda la tienda' : 'En productos seleccionados'))}</p>
          ${p.ends_at ? `<div class="countdown" data-ends="${esc(p.ends_at)}">${countdown(p.ends_at)}</div>` : ''}
          <a class="btn" href="${href}">Ver ofertas</a>
        </div>`;
      })
      .join(''),
  );
  const all = $$('.slide', slides);
  const dots = $('#dots');
  dots.innerHTML = all.map((_, i) => `<button type="button" aria-label="Banner ${i + 1}"></button>`).join('');
  let idx = 0;
  const go = (i) => {
    idx = (i + all.length) % all.length;
    slides.style.transform = `translateX(-${idx * 100}%)`;
    $$('button', dots).forEach((b, j) => b.classList.toggle('on', j === idx));
  };
  $$('button', dots).forEach((b, i) => b.addEventListener('click', () => go(i)));
  go(0);
  if (all.length > 1) setInterval(() => go(idx + 1), 6000);
  setInterval(() => $$('.countdown').forEach((el) => (el.textContent = countdown(el.dataset.ends))), 1000);
}

// ---------- Secciones de productos ----------
async function fill(el, params, sectionToHideIfEmpty) {
  el.innerHTML = skeletonCards(params.includes('limit=5') ? 5 : 10);
  const { items } = await api.get(`/products?${params}`).catch(() => ({ items: [] }));
  if (!items.length && sectionToHideIfEmpty) {
    sectionToHideIfEmpty.classList.add('hidden');
    return;
  }
  el.innerHTML = items.length ? items.map(productCard).join('') : '<p class="muted">Pronto vas a ver productos acá.</p>';
}

function renderCategories() {
  if (!categories.length) return $('#cats-section').classList.add('hidden');
  $('#cats').innerHTML = categories
    .map((c) => `<a class="chip-cat" href="/buscar?category=${encodeURIComponent(c.slug)}">
        <span class="circle" style="background:${colorFor(c.name)}">${esc(c.name[0])}</span>${esc(c.name)}</a>`)
    .join('');
}

renderCategories();
await Promise.all([
  loadHero(),
  fill($('#offers'), 'offers=1&sort=discount&limit=10', $('#offers-section')),
  fill($('#featured'), 'featured=1&limit=10', $('#featured-section')),
  fill($('#newest'), 'sort=newest&limit=10'),
]);
