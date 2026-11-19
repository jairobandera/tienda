import { api, qs } from '../../../js/core/api.js';
import { $, $$, esc, money, productImg, toast, debounce } from '../../../js/core/utils.js';
import { setView, openModal, confirmDialog, emptyRow } from '../ui.js';

const state = { q: '', category: '', page: 1 };
let categories = [];
const selected = new Set();

export async function render({ params }) {
  const view = setView('Productos', `
    <button class="btn btn-secondary btn-sm hidden" id="bulk-btn">Descuento a seleccionados</button>
    <button class="btn btn-primary btn-sm" id="new-btn">+ Nuevo producto</button>`);
  ({ categories } = await api.get('/admin/categories'));
  selected.clear();

  view.innerHTML = `
    <div class="filters-bar">
      <input class="input grow" id="p-q" placeholder="Buscar producto…" value="${esc(state.q)}">
      <select id="p-cat"><option value="">Todas las categorías</option>${categories.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('')}</select>
    </div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th><input type="checkbox" id="sel-all" aria-label="Seleccionar todos"></th><th></th><th>Producto</th><th class="num">Precio</th><th class="num">Desc.</th><th class="num">Final</th><th class="num">Stock</th><th class="num">Vendidos</th><th>Activo</th><th></th></tr></thead>
      <tbody id="p-rows"></tbody>
    </table></div>
    <div class="pagination" id="p-pages"></div>`;

  $('#p-cat').value = state.category;
  $('#p-q').addEventListener('input', debounce((e) => ((state.q = e.target.value), (state.page = 1), load()), 300));
  $('#p-cat').addEventListener('change', (e) => ((state.category = e.target.value), (state.page = 1), load()));
  $('#new-btn').addEventListener('click', () => openForm());
  $('#bulk-btn').addEventListener('click', bulkDiscount);
  $('#sel-all').addEventListener('change', (e) => {
    $$('#p-rows [data-sel]').forEach((c) => {
      c.checked = e.target.checked;
      c.dispatchEvent(new Event('change'));
    });
  });

  await load();
  if (params[0] === 'nuevo') openForm();
  else if (/^\d+$/.test(params[0] || '')) openForm(Number(params[0]));
}

function updateBulk() {
  const b = $('#bulk-btn');
  b.classList.toggle('hidden', !selected.size);
  b.textContent = `Descuento a seleccionados (${selected.size})`;
}

async function load() {
  const data = await api.get(`/admin/products${qs({ q: state.q, category: state.category, page: state.page, limit: 50 })}`);
  $('#p-rows').innerHTML = data.items.length
    ? data.items.map((p) => `
      <tr data-id="${p.id}">
        <td><input type="checkbox" data-sel ${selected.has(p.id) ? 'checked' : ''} aria-label="Seleccionar"></td>
        <td><div class="thumb">${productImg(p)}</div></td>
        <td><div class="t" title="${esc(p.title)}">${esc(p.title)}</div>
          <div class="muted small">${esc(p.category?.name || 'Sin categoría')}${p.featured ? ' · <span class="pill gold">Destacado</span>' : ''}${p.promoName ? ` · <span class="pill">${esc(p.promoName)}</span>` : ''}</div></td>
        <td class="num">${money(p.price)}</td>
        <td class="num">${p.discountPercent ? `<span class="pill on">${Math.round(p.discountPercent)}%</span>` : '—'}</td>
        <td class="num"><strong>${money(p.finalPrice)}</strong></td>
        <td class="num"><span class="pill ${p.stock === 0 ? 'off' : p.stock <= 3 ? 'gold' : ''}">${p.stock}</span></td>
        <td class="num">${p.soldCount}</td>
        <td><input type="checkbox" class="switch-t" data-active ${p.active ? 'checked' : ''} aria-label="Activo"></td>
        <td><div class="row-actions">
          <a class="btn btn-ghost btn-sm" href="/p/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener" title="Ver en tienda">↗</a>
          <button class="btn btn-secondary btn-sm" data-edit>Editar</button>
          <button class="btn btn-ghost btn-sm" data-del title="Eliminar" style="color:var(--danger)">✕</button>
        </div></td>
      </tr>`).join('')
    : emptyRow(10, 'No hay productos. ¡Creá el primero!');

  $$('#p-rows tr[data-id]').forEach((tr) => {
    const id = Number(tr.dataset.id);
    const p = data.items.find((x) => x.id === id);
    tr.querySelector('[data-edit]').addEventListener('click', () => openForm(id));
    tr.querySelector('[data-sel]').addEventListener('change', (e) => {
      e.target.checked ? selected.add(id) : selected.delete(id);
      updateBulk();
    });
    tr.querySelector('[data-active]').addEventListener('change', async (e) => {
      try {
        await api.patch(`/admin/products/${id}`, { active: e.target.checked });
        toast(e.target.checked ? 'Producto publicado' : 'Producto pausado', 'success');
      } catch (err) {
        toast(err.message, 'error');
        e.target.checked = !e.target.checked;
      }
    });
    tr.querySelector('[data-del]').addEventListener('click', async () => {
      if (!(await confirmDialog(`¿Eliminar "${p.title}"? Si tiene ventas, se pausará en lugar de borrarse.`, { okText: 'Eliminar', danger: true }))) return;
      const r = await api.del(`/admin/products/${id}`);
      toast(r.deactivated ? 'El producto tiene ventas: se pausó' : 'Producto eliminado', 'success');
      load();
    });
  });

  const pages = $('#p-pages');
  pages.innerHTML = data.pages > 1
    ? `<button ${data.page === 1 ? 'disabled' : ''} data-p="${data.page - 1}">‹</button><button class="on">${data.page} / ${data.pages}</button><button ${data.page === data.pages ? 'disabled' : ''} data-p="${data.page + 1}">›</button>`
    : `<span class="muted small">${data.total} producto${data.total === 1 ? '' : 's'}</span>`;
  $$('[data-p]', pages).forEach((b) => b.addEventListener('click', () => ((state.page = Number(b.dataset.p)), load())));
  updateBulk();
}

async function bulkDiscount() {
  const m = openModal({
    title: `Descuento para ${selected.size} producto(s)`,
    body: `<div class="field"><label for="b-disc">Descuento propio (%)</label><input id="b-disc" type="number" min="0" max="95" step="1" value="10">
      <span class="hint">Poné 0 para quitarlo. Si hay una promoción vigente mayor, se aplica la mayor.</span></div>`,
    footer: '<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="b-ok">Aplicar</button>',
  });
  $('#b-ok', m.el).addEventListener('click', async () => {
    try {
      await api.post('/admin/products/bulk-discount', { ids: [...selected], ownDiscount: Number($('#b-disc', m.el).value) });
      toast('Descuento aplicado', 'success');
      selected.clear();
      m.close();
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function openForm(id) {
  const p = id ? (await api.get(`/admin/products/${id}`)).product : {
    title: '', description: '', brand: '', condition: 'nuevo', price: '', ownDiscount: 0, stock: 1, category: null, images: [], active: true, featured: false,
  };
  let images = [...p.images];

  const m = openModal({
    title: id ? 'Editar producto' : 'Nuevo producto',
    wide: true,
    body: `
      <form id="pf" class="form-grid" novalidate>
        <div class="field full"><label for="f-title">Título</label><input id="f-title" name="title" maxlength="200" required value="${esc(p.title)}" placeholder="Ej: Auriculares inalámbricos Bluetooth"></div>
        <div class="field"><label for="f-price">Precio (UYU)</label><input id="f-price" name="price" type="number" min="0" step="0.01" required value="${p.price}"></div>
        <div class="field"><label for="f-disc">Descuento propio (%)</label><input id="f-disc" name="ownDiscount" type="number" min="0" max="95" step="1" value="${p.ownDiscount}"></div>
        <div class="field full"><div class="preview-price" id="f-preview"></div></div>
        <div class="field"><label for="f-stock">Stock</label><input id="f-stock" name="stock" type="number" min="0" step="1" required value="${p.stock}"></div>
        <div class="field"><label for="f-cat">Categoría</label><select id="f-cat" name="categoryId"><option value="">Sin categoría</option>
          ${categories.map((c) => `<option value="${c.id}" ${p.category?.id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="f-brand">Marca</label><input id="f-brand" name="brand" maxlength="100" value="${esc(p.brand || '')}"></div>
        <div class="field"><label for="f-cond">Condición</label><select id="f-cond" name="condition">
          <option value="nuevo" ${p.condition === 'nuevo' ? 'selected' : ''}>Nuevo</option><option value="usado" ${p.condition === 'usado' ? 'selected' : ''}>Usado</option></select></div>
        <div class="field full"><label for="f-desc">Descripción</label><textarea id="f-desc" name="description" rows="6">${esc(p.description)}</textarea></div>
        <div class="field full"><label>Imágenes (la primera es la principal)</label>
          <div class="img-list" id="f-imgs"></div>
          <label class="dropzone" id="dz">Arrastrá imágenes acá o hacé clic para subir (JPG, PNG, WEBP · máx. 5 MB)
            <input type="file" id="f-files" accept="image/*" multiple hidden></label>
          <div class="inline-form" style="margin-top:8px"><input class="input" id="f-url" placeholder="…o pegá una URL https:// de imagen"><button type="button" class="btn btn-secondary btn-sm" id="f-add-url">Agregar</button></div>
        </div>
        <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="switch-t" name="active" ${p.active ? 'checked' : ''}> Publicado</label>
        <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" class="switch-t" name="featured" ${p.featured ? 'checked' : ''}> Destacado en portada</label>
      </form>`,
    footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" id="f-save">${id ? 'Guardar cambios' : 'Crear producto'}</button>`,
  });
  const el = m.el;
  const form = $('#pf', el);

  const preview = () => {
    const price = Number(form.price.value) || 0;
    const d = Number(form.ownDiscount.value) || 0;
    $('#f-preview', el).innerHTML = d > 0
      ? `Precio final: <strong>${money(price * (1 - d / 100))}</strong> <span class="muted">(antes ${money(price)}, ${d}% OFF)</span>`
      : `Precio final: <strong>${money(price)}</strong> <span class="muted">· Las promociones activas se aplican automáticamente.</span>`;
  };
  form.price.addEventListener('input', preview);
  form.ownDiscount.addEventListener('input', preview);
  preview();

  const renderImgs = () => {
    $('#f-imgs', el).innerHTML = images.map((src, i) => `
      <div class="img-item ${i === 0 ? 'first' : ''}"><img src="${esc(src)}" alt="">
        <button type="button" class="x" data-rm="${i}" aria-label="Quitar">×</button>
        <div class="mv">${i > 0 ? `<button type="button" data-left="${i}" aria-label="Mover a la izquierda">‹</button>` : ''}${i < images.length - 1 ? `<button type="button" data-right="${i}" aria-label="Mover a la derecha">›</button>` : ''}</div>
      </div>`).join('');
    $$('[data-rm]', el).forEach((b) => b.addEventListener('click', () => (images.splice(Number(b.dataset.rm), 1), renderImgs())));
    const swap = (a, b) => (([images[a], images[b]] = [images[b], images[a]]), renderImgs());
    $$('[data-left]', el).forEach((b) => b.addEventListener('click', () => swap(Number(b.dataset.left), Number(b.dataset.left) - 1)));
    $$('[data-right]', el).forEach((b) => b.addEventListener('click', () => swap(Number(b.dataset.right), Number(b.dataset.right) + 1)));
  };
  renderImgs();

  async function upload(files) {
    if (!files.length) return;
    const fd = new FormData();
    [...files].slice(0, 10).forEach((f) => fd.append('images', f));
    const dz = $('#dz', el);
    dz.firstChild.textContent = 'Subiendo…';
    try {
      const { urls } = await api.upload('/admin/uploads', fd);
      images.push(...urls);
      renderImgs();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      dz.firstChild.textContent = 'Arrastrá imágenes acá o hacé clic para subir (JPG, PNG, WEBP · máx. 5 MB)';
    }
  }
  $('#f-files', el).addEventListener('change', (e) => upload(e.target.files));
  const dz = $('#dz', el);
  dz.addEventListener('dragover', (e) => (e.preventDefault(), dz.classList.add('over')));
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('over');
    upload(e.dataTransfer.files);
  });
  $('#f-add-url', el).addEventListener('click', () => {
    const url = $('#f-url', el).value.trim();
    if (!/^https:\/\//.test(url)) return toast('La URL debe empezar con https://', 'error');
    images.push(url);
    $('#f-url', el).value = '';
    renderImgs();
  });

  $('#f-save', el).addEventListener('click', async (e) => {
    const body = {
      title: form.elements.title.value.trim(), // form.title es el atributo del <form>
      price: Number(form.price.value),
      ownDiscount: Number(form.ownDiscount.value) || 0,
      stock: Number(form.stock.value),
      categoryId: form.categoryId.value ? Number(form.categoryId.value) : null,
      brand: form.brand.value.trim() || null,
      condition: form.condition.value,
      description: form.description.value,
      images,
      active: form.active.checked,
      featured: form.featured.checked,
    };
    if (body.title.length < 3) return toast('El título debe tener al menos 3 caracteres', 'error');
    if (!(body.price >= 0) || form.price.value === '') return toast('Ingresá un precio válido', 'error');
    e.target.disabled = true;
    try {
      await (id ? api.put(`/admin/products/${id}`, body) : api.post('/admin/products', body));
      toast(id ? 'Producto actualizado' : 'Producto creado', 'success');
      m.close();
      if (location.hash !== '#/productos') history.replaceState(null, '', '#/productos');
      load();
    } catch (err) {
      toast(err.message, 'error');
      e.target.disabled = false;
    }
  });
}
