import { api, qs } from '../../../js/core/api.js';
import { $, $$, esc, money, dateTime, STATUS_LABELS, statusBadge, paymentLabel, addressText, phoneToWa, ICONS, toast, debounce } from '../../../js/core/utils.js';
import { setView, openModal, emptyRow } from '../ui.js';

const state = { page: 1 };

export async function render({ params, query }) {
  Object.assign(state, { status: '', q: '', from: '', to: '', payment: '', page: 1 }, query);
  const view = setView('Pedidos', '<button class="btn btn-secondary btn-sm" id="export">Exportar CSV</button>');

  view.innerHTML = `
    <div class="filters-bar">
      <input class="input grow" id="o-q" placeholder="Buscar por #pedido, nombre, email o teléfono" value="${esc(state.q)}">
      <select id="o-status"><option value="">Todos los estados</option>${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${state.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select id="o-payment">
        <option value="">Todos los pagos</option>
        <option value="credit_card">Tarjeta de crédito</option><option value="debit_card">Tarjeta de débito</option>
        <option value="ticket">Efectivo Abitab/RedPagos</option><option value="account_money">Dinero en cuenta</option>
        <option value="cash">Efectivo / transferencia (coordinar)</option>
      </select>
      <input class="input" type="date" id="o-from" value="${esc(state.from)}" aria-label="Desde">
      <input class="input" type="date" id="o-to" value="${esc(state.to)}" aria-label="Hasta">
    </div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Productos</th><th>Pago</th><th>Entrega</th><th>Estado</th><th class="num">Total</th></tr></thead>
      <tbody id="o-rows"></tbody>
    </table></div>
    <div class="pagination" id="o-pages"></div>`;

  $('#o-payment').value = state.payment;
  const reload = () => ((state.page = 1), load());
  $('#o-q').addEventListener('input', debounce((e) => ((state.q = e.target.value), reload()), 300));
  $('#o-status').addEventListener('change', (e) => ((state.status = e.target.value), reload()));
  $('#o-payment').addEventListener('change', (e) => ((state.payment = e.target.value), reload()));
  $('#o-from').addEventListener('change', (e) => ((state.from = e.target.value), reload()));
  $('#o-to').addEventListener('change', (e) => ((state.to = e.target.value), reload()));
  $('#export').addEventListener('click', () => {
    location.href = `/api/admin/orders/export.csv${qs({ status: state.status, q: state.q, from: state.from, to: state.to, payment: state.payment })}`;
  });

  await load();
  if (params[0] && /^\d+$/.test(params[0])) openOrder(Number(params[0]));
}

async function load() {
  const data = await api.get(`/admin/orders${qs({ ...state, limit: 25 })}`);
  $('#o-rows').innerHTML = data.items.length
    ? data.items.map((o) => `
      <tr class="clickable" data-id="${o.id}">
        <td><strong>#${o.id}</strong></td>
        <td class="small">${dateTime(o.created_at)}</td>
        <td><div>${esc(o.ship_name)}</div><div class="muted small">${esc(o.user_email)}</div></td>
        <td class="small">${o.item_count} u.</td>
        <td class="small">${esc(paymentLabel(o))}</td>
        <td class="small">${o.shipping_method === 'pickup' ? 'Retiro' : esc(o.ship_department || '')}</td>
        <td>${statusBadge(o.status)}</td>
        <td class="num"><strong>${money(o.total)}</strong></td>
      </tr>`).join('')
    : emptyRow(8, 'No hay pedidos con estos filtros');
  $$('#o-rows tr[data-id]').forEach((tr) => tr.addEventListener('click', () => openOrder(Number(tr.dataset.id))));

  const pages = $('#o-pages');
  pages.innerHTML = data.pages > 1
    ? `<button ${data.page === 1 ? 'disabled' : ''} data-p="${data.page - 1}">‹</button><button class="on">${data.page} / ${data.pages}</button><button ${data.page === data.pages ? 'disabled' : ''} data-p="${data.page + 1}">›</button>`
    : `<span class="muted small">${data.total} pedido${data.total === 1 ? '' : 's'}</span>`;
  $$('[data-p]', pages).forEach((b) => b.addEventListener('click', () => ((state.page = Number(b.dataset.p)), load())));
}

async function openOrder(id) {
  const { order: o } = await api.get(`/admin/orders/${id}`);
  const buyerWa = phoneToWa(o.ship_phone || o.user_phone);
  const waText = encodeURIComponent(`Hola ${o.ship_name.split(' ')[0]}! Te escribimos de Tienda Kairos por tu compra #${o.id}.`);
  const m = openModal({
    title: `Pedido #${o.id}`,
    wide: true,
    body: `
      <div class="order-detail">
        <div class="panel">
          <h3>Cliente</h3>
          <dl class="kv" style="grid-template-columns:110px 1fr;margin:0">
            <dt>Cuenta</dt><dd>${esc(o.user_name)}<br><a href="mailto:${esc(o.user_email)}">${esc(o.user_email)}</a></dd>
            <dt>Recibe</dt><dd>${esc(o.ship_name)}</dd>
            <dt>Teléfono</dt><dd>${esc(o.ship_phone)} ${buyerWa ? `<a class="btn btn-whatsapp btn-sm" style="margin-left:6px" target="_blank" rel="noopener" href="https://wa.me/${buyerWa}?text=${waText}">${ICONS.whatsapp} WhatsApp</a>` : ''}</dd>
            <dt>Fecha</dt><dd>${dateTime(o.created_at)}</dd>
          </dl>
        </div>
        <div class="panel">
          <h3>Pago</h3>
          <dl class="kv" style="grid-template-columns:110px 1fr;margin:0">
            <dt>Método</dt><dd>${esc(paymentLabel(o))}</dd>
            <dt>Estado MP</dt><dd>${esc(o.payment_status || '—')}</dd>
            <dt>ID de pago</dt><dd>${esc(o.mp_payment_id || '—')}</dd>
            <dt>Pagado el</dt><dd>${o.paid_at ? dateTime(o.paid_at) : '—'}</dd>
          </dl>
        </div>
        <div class="panel">
          <h3>Entrega</h3>
          <p style="margin:0 0 6px"><strong>${o.shipping_method === 'pickup' ? 'Retiro' : 'Envío a domicilio'}</strong></p>
          <p style="margin:0">${esc(addressText(o))}</p>
          ${o.ship_notes ? `<p class="muted small" style="margin:6px 0 0">Indicaciones: ${esc(o.ship_notes)}</p>` : ''}
          ${o.customer_notes ? `<p class="alert alert-info small" style="margin:10px 0 0">Comentario del cliente: ${esc(o.customer_notes)}</p>` : ''}
        </div>
        <div class="panel">
          <h3>Gestión</h3>
          <div class="field"><label for="m-status">Estado</label>
            <select id="m-status">${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
            ${!o.paid_at ? '<span class="hint">Si marcás como pagado un pedido en efectivo, se descuenta el stock.</span>' : ''}</div>
          <div class="field"><label for="m-track">Código de seguimiento</label><input id="m-track" value="${esc(o.tracking_code || '')}" placeholder="Ej: DAC / UES / correo"></div>
          <div class="field" style="margin:0"><label for="m-notes">Notas internas</label><textarea id="m-notes" rows="2">${esc(o.admin_notes || '')}</textarea></div>
        </div>
        <div class="panel full">
          <h3>Productos</h3>
          <table class="tbl"><thead><tr><th>Producto</th><th class="num">Precio</th><th class="num">Cant.</th><th class="num">Subtotal</th></tr></thead><tbody>
            ${o.items.map((i) => `<tr><td>${esc(i.title)}${i.original_price > i.unit_price ? ` <span class="pill gold">-${Math.round((1 - i.unit_price / i.original_price) * 100)}%</span>` : ''}</td>
              <td class="num">${money(i.unit_price)}</td><td class="num">${i.quantity}</td><td class="num">${money(i.unit_price * i.quantity)}</td></tr>`).join('')}
            <tr><td colspan="3" class="num muted">Descuentos</td><td class="num">− ${money(o.discount_total)}</td></tr>
            <tr><td colspan="3" class="num muted">Envío</td><td class="num">${money(o.shipping_cost)}</td></tr>
            <tr><td colspan="3" class="num"><strong>Total</strong></td><td class="num"><strong>${money(o.total)}</strong></td></tr>
          </tbody></table>
        </div>
      </div>`,
    footer: `<button class="btn btn-ghost" data-close>Cerrar</button><button class="btn btn-primary" id="m-save">Guardar cambios</button>`,
  });

  $('#m-save', m.el).addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await api.patch(`/admin/orders/${id}`, {
        status: $('#m-status', m.el).value,
        trackingCode: $('#m-track', m.el).value,
        adminNotes: $('#m-notes', m.el).value,
      });
      toast('Pedido actualizado', 'success');
      m.close();
      dispatchEvent(new Event('admin:orders-changed'));
      load();
    } catch (err) {
      toast(err.message, 'error');
      e.target.disabled = false;
    }
  });
}
