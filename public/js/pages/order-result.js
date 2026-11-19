import { api } from '../core/api.js';
import { initLayout } from '../core/layout.js';
import { requireLogin } from '../core/session.js';
import { $, $$, esc, money, dateTime, paymentLabel, addressText, whatsappUrl, statusBadge, ICONS, toast } from '../core/utils.js';

const { settings } = await initLayout();
await requireLogin();

const orderId = Number(location.pathname.split('/').pop());
const params = new URLSearchParams(location.search);

async function fetchOrder() {
  // Al volver de Mercado Pago llega ?payment_id=...: sincronizamos el estado del pago.
  const paymentId = params.get('payment_id') || params.get('collection_id');
  if (paymentId && /^\d+$/.test(paymentId)) {
    try {
      const { order } = await api.post('/payments/sync', { paymentId, orderId });
      history.replaceState(null, '', location.pathname);
      return order;
    } catch { /* si falla, mostramos el estado que tenga el pedido */ }
  }
  return (await api.get(`/orders/${orderId}`)).order;
}

function head(order) {
  if (['paid', 'preparing', 'shipped', 'delivered'].includes(order.status)) {
    return { cls: 'ok', icon: ICONS.check, title: '¡Listo! Tu compra está confirmada', text: 'Recibimos tu pago. Avisanos por WhatsApp para coordinar la entrega.' };
  }
  if (order.payment_provider === 'cash' && order.status === 'pending') {
    return { cls: 'pending', icon: ICONS.clock, title: 'Pedido reservado', text: 'Escribinos por WhatsApp para coordinar el pago en efectivo o transferencia.' };
  }
  if (order.status === 'pending') {
    return order.payment_type === 'ticket'
      ? { cls: 'pending', icon: ICONS.clock, title: 'Pago pendiente', text: 'Aboná el cupón en Abitab o RedPagos. Apenas se acredite te confirmamos la compra.' }
      : { cls: 'pending', icon: ICONS.clock, title: 'Tu pago está pendiente', text: 'Si ya pagaste, puede demorar unos minutos en acreditarse.' };
  }
  return { cls: 'bad', icon: ICONS.x, title: order.status === 'rejected' ? 'El pago fue rechazado' : 'Pedido cancelado', text: 'Podés intentar de nuevo con otro medio de pago.' };
}

function render(order) {
  const h = head(order);
  const canPay = ['pending', 'rejected'].includes(order.status) && order.payment_provider !== 'cash' && !order.paid_at;
  $('#result').innerHTML = `
    ${settings.simulatePayments && canPay ? `
      <div class="sim-box">
        <strong>Modo desarrollo · Pago simulado</strong>
        <p class="small" style="margin:4px 0 0">No hay credenciales de Mercado Pago configuradas. Elegí el resultado del pago para probar el flujo:</p>
        <div class="btns">
          <button class="btn btn-sm btn-primary" data-sim="approved" data-type="credit_card">Aprobar (tarjeta crédito)</button>
          <button class="btn btn-sm btn-secondary" data-sim="approved" data-type="debit_card">Aprobar (débito)</button>
          <button class="btn btn-sm btn-secondary" data-sim="pending" data-type="ticket">Pendiente (Abitab)</button>
          <button class="btn btn-sm btn-danger" data-sim="rejected" data-type="credit_card">Rechazar</button>
        </div>
      </div>` : ''}
    ${params.get('error') === 'mp' ? '<div class="alert alert-error">No pudimos conectar con Mercado Pago. Probá reintentar el pago.</div>' : ''}
    <div class="card">
      <div class="result-head ${h.cls}">
        <div class="icon">${h.icon}</div>
        <h1>${h.title}</h1>
        <p style="margin:0;opacity:.95">${h.text}</p>
      </div>
      <div class="result-body">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <strong>Compra #${order.id}</strong>${statusBadge(order.status)}
        </div>
        <dl class="kv">
          <dt>Fecha</dt><dd>${dateTime(order.created_at)}</dd>
          <dt>Pago</dt><dd>${esc(paymentLabel(order))}</dd>
          <dt>Entrega</dt><dd>${esc(addressText(order))}</dd>
          <dt>Recibe</dt><dd>${esc(order.ship_name)} · ${esc(order.ship_phone)}</dd>
        </dl>
        <ul class="order-lines">
          ${order.items.map((i) => `<li><span>${esc(i.title)} <span class="q">x${i.quantity}</span></span><span class="amt">${money(i.unit_price * i.quantity)}</span></li>`).join('')}
          ${Number(order.discount_total) > 0 ? `<li><span class="free-ship">Descuentos aplicados</span><span class="amt free-ship">− ${money(order.discount_total)}</span></li>` : ''}
          <li><span>Envío</span><span class="amt">${Number(order.shipping_cost) ? money(order.shipping_cost) : 'Gratis'}</span></li>
          <li><strong>Total</strong><strong class="amt">${money(order.total)}</strong></li>
        </ul>
        ${canPay ? '<button class="btn btn-primary btn-block" id="retry">Pagar con Mercado Pago</button>' : ''}
        <div class="wa-box">
          <p><strong>Comunicate con nosotros</strong><br>Envianos el detalle de tu compra por WhatsApp para coordinar la entrega o resolver cualquier duda.</p>
          <a class="btn btn-whatsapp" href="${esc(whatsappUrl(settings.whatsapp, order))}" target="_blank" rel="noopener">${ICONS.whatsapp} Enviar por WhatsApp</a>
        </div>
        <p style="text-align:center;margin:20px 0 0"><a href="/mi-cuenta">Ver mis compras</a> · <a href="/">Seguir comprando</a></p>
      </div>
    </div>`;

  $('#retry')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const { paymentUrl } = await api.post(`/orders/${order.id}/pay`);
      location.href = paymentUrl;
    } catch (err) {
      toast(err.message, 'error');
      e.target.disabled = false;
    }
  });
  $$('[data-sim]').forEach((b) =>
    b.addEventListener('click', async () => {
      const { order: updated } = await api.post('/payments/simulate', { orderId: order.id, outcome: b.dataset.sim, type: b.dataset.type });
      render(updated);
    }),
  );
}

try {
  render(await fetchOrder());
} catch (err) {
  $('#result').innerHTML = `<div class="card empty"><h2>${esc(err.status === 404 ? 'No encontramos esta compra' : err.message)}</h2><a class="btn btn-secondary" href="/mi-cuenta">Ir a mis compras</a></div>`;
}
