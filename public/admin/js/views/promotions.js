import { api } from '../../../js/core/api.js';
import { $, $$, esc, dateTime, toast } from '../../../js/core/utils.js';
import { setView, openModal, confirmDialog, emptyRow, toLocalInput, fromLocalInput } from '../ui.js';

const SCOPE = { all: 'Toda la tienda', categories: 'Categorías', products: 'Productos elegidos' };

export async function render() {
  const view = setView('Ofertas y descuentos', `
    <button class="btn btn-secondary btn-sm" id="bf-btn">⚡ Black Friday rápido</button>
    <button class="btn btn-primary btn-sm" id="new-btn">+ Nueva promoción</button>`);
  view.innerHTML = `
    <p class="alert alert-info">Las promociones se aplican solas en el período elegido. Si un producto tiene varias (o un descuento propio), se usa siempre el <strong>mayor descuento</strong>.</p>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Promoción</th><th>Descuento</th><th>Aplica a</th><th>Vigencia</th><th>Estado</th><th>Activa</th><th></th></tr></thead>
      <tbody id="pr-rows"></tbody>
    </table></div>`;
  $('#new-btn').addEventListener('click', () => openForm());
  $('#bf-btn').addEventListener('click', () => {
    const now = new Date();
    const end = new Date(now.getTime() + 4 * 864e5);
    openForm(null, { name: 'Black Friday', banner_text: 'Los precios más bajos del año en toda la tienda', discount_percent: 25, scope: 'all', starts_at: now.toISOString(), ends_at: end.toISOString(), active: true, show_banner: true });
  });
  await load();
}

async function load() {
  const { promotions } = await api.get('/admin/promotions');
  const now = Date.now();
  $('#pr-rows').innerHTML = promotions.length
    ? promotions.map((p) => {
      const status = p.running ? '<span class="pill on">En curso</span>'
        : !p.active ? '<span class="pill">Pausada</span>'
          : p.starts_at && new Date(p.starts_at) > now ? '<span class="pill gold">Programada</span>' : '<span class="pill off">Finalizada</span>';
      const target = p.scope === 'all' ? SCOPE.all : p.scope === 'categories' ? `${p.category_count} categoría(s)` : `${p.product_count} producto(s)`;
      return `<tr data-id="${p.id}">
        <td><strong>${esc(p.name)}</strong>${p.banner_text ? `<div class="muted small">${esc(p.banner_text)}</div>` : ''}</td>
        <td><strong>${Math.round(p.discount_percent)}% OFF</strong></td>
        <td>${target}</td>
        <td class="small">${p.starts_at ? dateTime(p.starts_at) : 'Desde ya'}<br>${p.ends_at ? `hasta ${dateTime(p.ends_at)}` : 'sin fecha de fin'}</td>
        <td>${status}</td>
        <td><input type="checkbox" class="switch-t" data-active ${p.active ? 'checked' : ''} aria-label="Activa"></td>
        <td><div class="row-actions"><button class="btn btn-secondary btn-sm" data-edit>Editar</button><button class="btn btn-ghost btn-sm" data-del style="color:var(--danger)">✕</button></div></td>
      </tr>`;
    }).join('')
    : emptyRow(7, 'No hay promociones. Creá una o usá "Black Friday rápido".');

  $$('#pr-rows tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    tr.querySelector('[data-edit]').addEventListener('click', () => openForm(id));
    tr.querySelector('[data-active]').addEventListener('change', async (e) => {
      await api.patch(`/admin/promotions/${id}`, { active: e.target.checked });
      load();
    });
    tr.querySelector('[data-del]').addEventListener('click', async () => {
      if (!(await confirmDialog('¿Eliminar esta promoción? Los precios vuelven a la normalidad.', { okText: 'Eliminar', danger: true }))) return;
      await api.del(`/admin/promotions/${id}`);
      toast('Promoción eliminada', 'success');
      load();
    });
  });
}

async function openForm(id, preset) {
  const [{ categories }, { items: products }, promo] = await Promise.all([
    api.get('/admin/categories'),
    api.get('/admin/products?limit=60&sort=newest'),
    id ? api.get(`/admin/promotions/${id}`).then((r) => r.promotion) : Promise.resolve(preset || { name: '', discount_percent: 15, scope: 'all', active: true, show_banner: true, product_ids: [], category_ids: [] }),
  ]);
  // Si la promo incluye productos que no están en la primera página, los traemos también
  const extraIds = (promo.product_ids || []).filter((pid) => !products.some((p) => p.id === pid));
  if (extraIds.length) {
    const extra = await api.get(`/admin/products?limit=60&ids=${extraIds.slice(0, 60).join(',')}`).catch(() => ({ items: [] }));
    products.push(...extra.items.filter((p) => extraIds.includes(p.id)));
  }
  const pSel = new Set(promo.product_ids || []);
  const cSel = new Set(promo.category_ids || []);

  const m = openModal({
    title: id ? 'Editar promoción' : 'Nueva promoción',
    wide: true,
    body: `
      <form id="prf" class="form-grid" novalidate>
        <div class="field"><label for="pr-name">Nombre (se muestra en la tienda)</label><input id="pr-name" name="pname" value="${esc(promo.name)}" maxlength="120" placeholder="Black Friday, Cyber Monday, Liquidación…"></div>
        <div class="field"><label for="pr-disc">Descuento (%)</label><input id="pr-disc" name="discount" type="number" min="1" max="99" value="${promo.discount_percent}"></div>
        <div class="field full"><label for="pr-banner">Texto del banner</label><input id="pr-banner" name="banner" value="${esc(promo.banner_text || '')}" maxlength="240" placeholder="Los precios más bajos del año"></div>
        <div class="field"><label for="pr-start">Comienza</label><input id="pr-start" name="start" type="datetime-local" value="${toLocalInput(promo.starts_at)}"><span class="hint">Vacío = desde ahora</span></div>
        <div class="field"><label for="pr-end">Termina</label><input id="pr-end" name="end" type="datetime-local" value="${toLocalInput(promo.ends_at)}"><span class="hint">Vacío = sin fecha de fin. Se muestra una cuenta regresiva.</span></div>
        <div class="field full"><label>Aplicar a</label>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            ${Object.entries(SCOPE).map(([k, v]) => `<label class="small" style="display:flex;gap:6px;align-items:center"><input type="radio" name="scope" value="${k}" ${promo.scope === k ? 'checked' : ''}> ${v}</label>`).join('')}
          </div></div>
        <div class="field full hidden" id="pr-cats"><label>Categorías</label><div class="check-list">
          ${categories.map((c) => `<label><input type="checkbox" data-cat="${c.id}" ${cSel.has(c.id) ? 'checked' : ''}> ${esc(c.name)} <span class="muted small">(${c.product_count})</span></label>`).join('') || '<span class="muted">No hay categorías</span>'}
        </div></div>
        <div class="field full hidden" id="pr-prods"><label>Productos</label>
          <input class="input" id="pr-filter" placeholder="Filtrar productos…" style="margin-bottom:6px">
          <div class="check-list">${products.map((p) => `<label data-title="${esc(p.title.toLowerCase())}"><input type="checkbox" data-prod="${p.id}" ${pSel.has(p.id) ? 'checked' : ''}> ${esc(p.title)}</label>`).join('')}</div>
          <span class="hint">Se muestran los últimos 60 productos. Para descuentos individuales también podés usar "Descuento propio" en cada producto.</span>
        </div>
        <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="switch-t" name="active" ${promo.active ? 'checked' : ''}> Activa</label>
        <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="switch-t" name="banner_on" ${promo.show_banner ? 'checked' : ''}> Mostrar banner en la portada</label>
      </form>`,
    footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="pr-save">${id ? 'Guardar' : 'Crear promoción'}</button>`,
  });
  const el = m.el;
  const form = $('#prf', el);
  const syncScope = () => {
    const s = form.querySelector('[name=scope]:checked').value;
    $('#pr-cats', el).classList.toggle('hidden', s !== 'categories');
    $('#pr-prods', el).classList.toggle('hidden', s !== 'products');
  };
  $$('[name=scope]', el).forEach((r) => r.addEventListener('change', syncScope));
  syncScope();
  $('#pr-filter', el).addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    $$('#pr-prods label[data-title]', el).forEach((l) => l.classList.toggle('hidden', !l.dataset.title.includes(q)));
  });

  $('#pr-save', el).addEventListener('click', async (e) => {
    const body = {
      name: form.pname.value.trim(),
      bannerText: form.banner.value.trim() || null,
      discountPercent: Number(form.discount.value),
      scope: form.querySelector('[name=scope]:checked').value,
      categoryIds: $$('[data-cat]:checked', el).map((c) => Number(c.dataset.cat)),
      productIds: $$('[data-prod]:checked', el).map((c) => Number(c.dataset.prod)),
      startsAt: fromLocalInput(form.start.value),
      endsAt: fromLocalInput(form.end.value),
      active: form.active.checked,
      showBanner: form.banner_on.checked,
    };
    e.target.disabled = true;
    try {
      await (id ? api.put(`/admin/promotions/${id}`, body) : api.post('/admin/promotions', body));
      toast('Promoción guardada', 'success');
      m.close();
      load();
    } catch (err) {
      toast(err.message, 'error');
      e.target.disabled = false;
    }
  });
}
