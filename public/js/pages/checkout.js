import { api } from '../core/api.js';
import { initLayout } from '../core/layout.js';
import { loadCart } from '../core/cart.js';
import { requireLogin } from '../core/session.js';
import { $, $$, esc, money, productImg } from '../core/utils.js';

const DEPARTMENTS = ['Montevideo', 'Canelones', 'Maldonado', 'Artigas', 'Cerro Largo', 'Colonia', 'Durazno', 'Flores', 'Florida',
  'Lavalleja', 'Paysandú', 'Río Negro', 'Rivera', 'Rocha', 'Salto', 'San José', 'Soriano', 'Tacuarembó', 'Treinta y Tres'];

const { settings } = await initLayout();
const me = await requireLogin();
const form = $('#checkout');

$('#department').innerHTML = DEPARTMENTS.map((d) => `<option>${d}</option>`).join('');
$('#max-inst').textContent = settings.max_installments || 12;
if (settings.pickup_enabled) {
  $('#pickup-opt').classList.remove('hidden');
  $('#pickup-address').textContent = settings.pickup_address || 'Coordinar por WhatsApp';
}
if (settings.cash_enabled) $('#cash-opt').classList.remove('hidden');

// Prellenar con datos del usuario y su última dirección
form.elements.name.value = me.name || ''; // (form.name es el atributo del form, no el input)
form.phone.value = me.phone || '';
api.get('/auth/me/address').then(({ address: a }) => {
  if (!a) return;
  form.street.value = a.street || '';
  form.number.value = a.number || '';
  form.apartment.value = a.apartment || '';
  form.city.value = a.city || '';
  form.department.value = a.department || 'Montevideo';
  form.postalCode.value = a.postal_code || '';
  form.addrNotes.value = a.notes || '';
}).catch(() => {});

const cart = await loadCart();
const items = cart.items.filter((i) => i.available);
if (!items.length) location.replace('/carrito');

const method = () => form.querySelector('[name=shippingMethod]:checked').value;
const payment = () => form.querySelector('[name=paymentMethod]:checked').value;

function shippingCost() {
  if (method() === 'pickup') return 0;
  const t = Number(settings.free_shipping_threshold) || 0;
  return t > 0 && cart.totals.total >= t ? 0 : Number(settings.shipping_cost) || 0;
}

function renderSummary() {
  const ship = shippingCost();
  $('#ship-price').textContent = ship ? money(ship) : 'Gratis';
  $('#ship-price').style.color = ship ? '' : 'var(--success)';
  $('#address-fields').classList.toggle('hidden', method() === 'pickup');
  const isCash = payment() === 'cash';
  $('#summary').innerHTML = `
    <h2>Resumen de compra</h2>
    <ul class="order-lines">
      ${items.map((i) => `<li><span style="width:40px;height:40px;display:grid;place-items:center">${productImg(i.product)}</span>
        <span>${esc(i.product.title)} <span class="q">x${i.quantity}</span></span>
        <span class="amt">${money(i.product.finalPrice * i.quantity)}</span></li>`).join('')}
    </ul>
    <div class="row"><span>Productos</span><span>${money(cart.totals.subtotal)}</span></div>
    ${cart.totals.discount > 0 ? `<div class="row green"><span>Descuentos</span><span>− ${money(cart.totals.discount)}</span></div>` : ''}
    <div class="row"><span>Envío</span><span class="${ship ? '' : 'green'}">${ship ? money(ship) : 'Gratis'}</span></div>
    <div class="row total"><span>Pagás</span><span>${money(cart.totals.total + ship)}</span></div>
    <button class="btn btn-primary btn-block" type="submit" id="pay-btn">${isCash ? 'Confirmar pedido' : 'Pagar con Mercado Pago'}</button>
    <p class="muted small" style="text-align:center;margin:8px 0 0">${isCash ? 'Te vamos a contactar por WhatsApp para coordinar el pago.' : 'Te redirigimos a Mercado Pago para completar el pago de forma segura.'}</p>`;
}

$$('[name=shippingMethod], [name=paymentMethod]').forEach((r) => r.addEventListener('change', renderSummary));
renderSummary();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#error');
  err.classList.add('hidden');
  const f = form;
  const body = {
    name: f.elements.name.value.trim(),
    phone: f.phone.value.trim(),
    shippingMethod: method(),
    paymentMethod: payment(),
    notes: f.notes.value.trim() || undefined,
    saveAddress: $('#saveAddress').checked,
  };
  if (body.shippingMethod === 'delivery') {
    body.address = {
      street: f.street.value.trim(),
      number: f.number.value.trim() || undefined,
      apartment: f.apartment.value.trim() || undefined,
      city: f.city.value.trim(),
      department: f.department.value,
      postalCode: f.postalCode.value.trim() || undefined,
      notes: f.addrNotes.value.trim() || undefined,
    };
  }
  const btn = $('#pay-btn');
  btn.disabled = true;
  btn.textContent = 'Procesando…';
  try {
    const { order, paymentUrl, paymentError } = await api.post('/orders', body);
    if (paymentUrl) location.href = paymentUrl;
    else location.href = `/compra/${order.id}${paymentError ? '?error=mp' : ''}`;
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
    scrollTo({ top: 0, behavior: 'smooth' });
    renderSummary();
  }
});
