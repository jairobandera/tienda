import { api } from '../../../js/core/api.js';
import { $, $$, esc, toast } from '../../../js/core/utils.js';
import { setView, confirmDialog, emptyRow } from '../ui.js';

export async function render() {
  const view = setView('Categorías');
  view.innerHTML = `
    <form class="filters-bar" id="c-form">
      <input class="input grow" name="name" placeholder="Nueva categoría (ej: Electrodomésticos)" required maxlength="100">
      <input class="input" name="sortOrder" type="number" min="0" value="0" style="width:100px" aria-label="Orden" title="Orden">
      <button class="btn btn-primary btn-sm" type="submit">Agregar</button>
    </form>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Nombre</th><th>Orden</th><th class="num">Productos activos</th><th></th></tr></thead>
      <tbody id="c-rows"></tbody>
    </table></div>`;

  $('#c-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api.post('/admin/categories', { name: f.elements.name.value, sortOrder: Number(f.sortOrder.value) || 0 });
      f.reset();
      toast('Categoría creada', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  await load();
}

async function load() {
  const { categories } = await api.get('/admin/categories');
  $('#c-rows').innerHTML = categories.length
    ? categories.map((c) => `
      <tr data-id="${c.id}">
        <td><input class="input" data-name value="${esc(c.name)}" maxlength="100"></td>
        <td><input class="input" data-order type="number" min="0" value="${c.sort_order}" style="width:90px"></td>
        <td class="num">${c.product_count}</td>
        <td><div class="row-actions"><button class="btn btn-secondary btn-sm" data-save>Guardar</button><button class="btn btn-ghost btn-sm" data-del style="color:var(--danger)">Eliminar</button></div></td>
      </tr>`).join('')
    : emptyRow(4, 'Todavía no hay categorías');

  $$('#c-rows tr[data-id]').forEach((tr) => {
    const id = tr.dataset.id;
    tr.querySelector('[data-save]').addEventListener('click', async () => {
      try {
        await api.put(`/admin/categories/${id}`, { name: tr.querySelector('[data-name]').value, sortOrder: Number(tr.querySelector('[data-order]').value) || 0 });
        toast('Categoría actualizada', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    tr.querySelector('[data-del]').addEventListener('click', async () => {
      if (!(await confirmDialog('¿Eliminar esta categoría? Los productos quedarán sin categoría.', { okText: 'Eliminar', danger: true }))) return;
      await api.del(`/admin/categories/${id}`);
      toast('Categoría eliminada', 'success');
      load();
    });
  });
}
