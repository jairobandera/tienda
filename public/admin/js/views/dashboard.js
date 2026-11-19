import { api } from '../../../js/core/api.js';
import { esc, money, STATUS_LABELS } from '../../../js/core/utils.js';
import { setView } from '../ui.js';

const METHOD_LABELS = {
  credit_card: 'Tarjeta de crédito', debit_card: 'Tarjeta de débito', ticket: 'Efectivo (Abitab/RedPagos)',
  account_money: 'Dinero en cuenta MP', cash: 'Efectivo / transferencia', bank_transfer: 'Transferencia', mercadopago: 'Mercado Pago',
};

export async function render() {
  const view = setView('Resumen', '<a class="btn btn-primary btn-sm" href="#/productos/nuevo">+ Nuevo producto</a>');
  const s = await api.get('/admin/orders/stats');
  const max = Math.max(...s.daily.map((d) => d.total), 1);
  const totalMethods = s.paymentMethods.reduce((a, m) => a + m.count, 0) || 1;

  view.innerHTML = `
    <div class="kpis">
      <div class="kpi accent"><span>Ventas totales</span><strong>${money(s.revenue)}</strong></div>
      <div class="kpi"><span>Ventas del mes</span><strong>${money(s.revenue_month)}</strong></div>
      <div class="kpi"><span>Ventas de hoy</span><strong>${money(s.revenue_today)}</strong></div>
      <div class="kpi"><span>Pedidos pagados</span><strong>${s.paid_orders}</strong></div>
      <div class="kpi"><span>Para despachar</span><strong><a href="#/pedidos?status=paid">${s.to_ship}</a></strong></div>
      <div class="kpi"><span>Ticket promedio</span><strong>${money(s.avg_ticket)}</strong></div>
      <div class="kpi"><span>Clientes registrados</span><strong>${s.customers}</strong></div>
      <div class="kpi"><span>Pendientes de pago</span><strong>${s.pending_orders}</strong></div>
    </div>
    <div class="dash-grid">
      <div class="panel">
        <h3>Ventas de los últimos 30 días</h3>
        <div class="bars">${s.daily.map((d) => `<div class="bar" ${d.total ? '' : 'data-zero'} style="height:${Math.max(2, (d.total / max) * 100)}%"
          title="${new Date(d.day).toLocaleDateString('es-UY', { day: '2-digit', month: 'short' })}: ${money(d.total)} (${d.orders} pedidos)"></div>`).join('')}</div>
        <div class="bars-x"><span>${new Date(s.daily[0].day).toLocaleDateString('es-UY', { day: '2-digit', month: 'short' })}</span><span>Hoy</span></div>
      </div>
      <div class="panel">
        <h3>Medios de pago</h3>
        <ul class="list-rows">${s.paymentMethods.length ? s.paymentMethods.map((m) => `
          <li><span>${esc(METHOD_LABELS[m.method] || m.method)}</span><span><strong>${Math.round((m.count / totalMethods) * 100)}%</strong> <span class="muted small">(${m.count})</span></span></li>`).join('') : '<li class="muted">Sin ventas todavía</li>'}
        </ul>
      </div>
      <div class="panel">
        <h3>Más vendidos</h3>
        <ul class="list-rows">${s.topProducts.length ? s.topProducts.map((p) => `
          <li><span>${esc(p.title)}</span><span class="muted">${p.units} u. · ${money(p.revenue)}</span></li>`).join('') : '<li class="muted">Sin ventas todavía</li>'}
        </ul>
      </div>
      <div class="panel">
        <h3>Pedidos por estado</h3>
        <ul class="list-rows">${Object.entries(STATUS_LABELS).map(([k, label]) => `
          <li><a href="#/pedidos?status=${k}">${label}</a><strong>${s.byStatus[k] || 0}</strong></li>`).join('')}
        </ul>
      </div>
      <div class="panel">
        <h3>Stock bajo (≤ 3)</h3>
        <ul class="list-rows">${s.lowStock.length ? s.lowStock.map((p) => `
          <li><a href="#/productos/${p.id}">${esc(p.title)}</a><span class="pill ${p.stock ? 'gold' : 'off'}">${p.stock} u.</span></li>`).join('') : '<li class="muted">Todo en orden 👌</li>'}
        </ul>
      </div>
    </div>`;
}
