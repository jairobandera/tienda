import { api, qs } from '../core/api.js';
import { initLayout } from '../core/layout.js';
import { $, $$, esc, productCard, skeletonCards } from '../core/utils.js';

const { categories, settings } = await initLayout();

const state = Object.fromEntries(new URLSearchParams(location.search));
state.page = Number(state.page) || 1;

function syncControls() {
  $('#sort').value = state.sort || 'relevance';
  $('#f-offers').checked = state.offers === '1';
  $('#f-stock').checked = state.inStock === '1';
  $('#f-min').value = state.min || '';
  $('#f-max').value = state.max || '';
}

function update(patch, { resetPage = true } = {}) {
  Object.assign(state, patch);
  if (resetPage) state.page = 1;
  for (const k of Object.keys(state)) if (state[k] === '' || state[k] == null || state[k] === false) delete state[k];
  history.pushState(null, '', `/buscar${qs({ ...state, page: state.page > 1 ? state.page : '' })}`);
  load();
}

function renderPagination(page, pages) {
  const el = $('#pagination');
  if (pages <= 1) return (el.innerHTML = '');
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  el.innerHTML = `
    <button type="button" data-p="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹ Anterior</button>
    ${nums.map((n) => `<button type="button" data-p="${n}" class="${n === page ? 'on' : ''}">${n}</button>`).join('')}
    <button type="button" data-p="${page + 1}" ${page === pages ? 'disabled' : ''}>Siguiente ›</button>`;
  $$('button', el).forEach((b) =>
    b.addEventListener('click', () => {
      update({ page: Number(b.dataset.p) }, { resetPage: false });
      scrollTo({ top: 0, behavior: 'smooth' });
    }),
  );
}

async function load() {
  syncControls();
  const catName = categories.find((c) => c.slug === state.category)?.name;
  const title = state.q || catName || (state.offers ? 'Ofertas' : 'Productos');
  $('#s-title').textContent = title;
  document.title = `${title} | ${settings.store_name}`;
  $('#results').innerHTML = skeletonCards(8);

  try {
    const data = await api.get(`/products${qs({ ...state, limit: 24, facets: 1 })}`);
    $('#s-count').textContent = `${data.total} resultado${data.total === 1 ? '' : 's'}`;
    const facets = data.facets?.categories || [];
    $('#f-cats').innerHTML =
      (state.category ? `<li><a href="#" data-cat="">« Todas las categorías</a></li>` : '') +
      facets.map((c) => `<li><a href="#" data-cat="${esc(c.slug)}" class="${c.slug === state.category ? 'on' : ''}">${esc(c.name)} <span class="muted">(${c.count})</span></a></li>`).join('');
    $$('[data-cat]').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        update({ category: a.dataset.cat });
      }),
    );

    $('#results').innerHTML = data.items.length
      ? data.items.map(productCard).join('')
      : `<div class="card empty" style="grid-column:1/-1">
           <h2>No hay publicaciones que coincidan con tu búsqueda.</h2>
           <p class="muted">Revisá la ortografía o usá términos más generales.</p>
           <a class="btn btn-secondary" href="/buscar">Ver todos los productos</a>
         </div>`;
    renderPagination(data.page, data.pages);
  } catch (err) {
    $('#results').innerHTML = `<div class="alert alert-error" style="grid-column:1/-1">${esc(err.message)}</div>`;
  }
}

$('#sort').addEventListener('change', (e) => update({ sort: e.target.value === 'relevance' ? '' : e.target.value }));
$('#f-offers').addEventListener('change', (e) => update({ offers: e.target.checked ? '1' : '' }));
$('#f-stock').addEventListener('change', (e) => update({ inStock: e.target.checked ? '1' : '' }));
$('#f-price').addEventListener('submit', (e) => {
  e.preventDefault();
  update({ min: $('#f-min').value, max: $('#f-max').value });
});
$('#toggle-filters').addEventListener('click', () => $('#filters').classList.toggle('open'));
addEventListener('popstate', () => {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, Object.fromEntries(new URLSearchParams(location.search)));
  state.page = Number(state.page) || 1;
  load();
});

load();
