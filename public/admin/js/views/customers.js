import { api } from '../../../js/core/api.js';
import { $, esc, money, date, phoneToWa, ICONS, debounce } from '../../../js/core/utils.js';
import { setView, emptyRow } from '../ui.js';

export async function render() {
  const view = setView('Clientes');
  view.innerHTML = `
    <div class="filters-bar"><input class="input grow" id="cu-q" placeholder="Buscar por nombre, email o teléfono"></div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Cliente</th><th>Teléfono</th><th>Registrado</th><th class="num">Compras</th><th class="num">Total gastado</th><th>Última compra</th><th></th></tr></thead>
      <tbody id="cu-rows"></tbody>
    </table></div>`;
  $('#cu-q').addEventListener('input', debounce((e) => load(e.target.value), 300));
  await load('');
}

async function load(q) {
  const { customers } = await api.get(`/admin/customers?q=${encodeURIComponent(q)}`);
  $('#cu-rows').innerHTML = customers.length
    ? customers.map((c) => {
      const wa = phoneToWa(c.phone);
      return `<tr>
        <td><strong>${esc(c.name)}</strong> ${c.role === 'admin' ? '<span class="pill gold">Admin</span>' : ''}<div class="muted small">${esc(c.email)}</div></td>
        <td>${esc(c.phone || '—')}</td>
        <td class="small">${date(c.created_at)}</td>
        <td class="num">${c.orders}</td>
        <td class="num">${money(c.spent)}</td>
        <td class="small">${c.last_order ? date(c.last_order) : '—'}</td>
        <td><div class="row-actions">
          <a class="btn btn-secondary btn-sm" href="#/pedidos?q=${encodeURIComponent(c.email)}">Pedidos</a>
          ${wa ? `<a class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener" href="https://wa.me/${wa}" aria-label="WhatsApp">${ICONS.whatsapp}</a>` : ''}
        </div></td>
      </tr>`;
    }).join('')
    : emptyRow(7, 'No hay clientes');
}
