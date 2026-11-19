import { api } from '../core/api.js';
import { initLayout } from '../core/layout.js';
import { requireLogin, setMe } from '../core/session.js';
import { $, $$, esc, money, date, productImg, statusBadge, paymentLabel, whatsappUrl, toast, ICONS } from '../core/utils.js';

const { settings } = await initLayout();
const me = await requireLogin();

function showTab(name) {
  $$('.side-nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $('#tab-compras').classList.toggle('hidden', name !== 'compras');
  $('#tab-datos').classList.toggle('hidden', name !== 'datos');
}
$$('.side-nav button').forEach((b) => b.addEventListener('click', () => {
  history.replaceState(null, '', b.dataset.tab === 'datos' ? '#datos' : location.pathname);
  showTab(b.dataset.tab);
}));
showTab(location.hash === '#datos' ? 'datos' : 'compras');

// ---------- Compras ----------
async function loadOrders() {
  const { orders } = await api.get('/orders');
  const el = $('#tab-compras');
  if (!orders.length) {
    el.innerHTML = '<div class="empty"><h2>Todavía no hiciste compras</h2><a class="btn btn-primary" href="/">Ver productos</a></div>';
    return;
  }
  el.innerHTML = `<div class="card-pad" style="border-bottom:1px solid var(--border)"><h2 style="margin:0;font-size:20px">Mis compras</h2></div>` +
    orders.map((o) => {
      const canPay = ['pending', 'rejected'].includes(o.status) && o.payment_provider !== 'cash' && !o.paid_at;
      return `
      <article class="order-card">
        <div class="head">
          <div><strong>Compra #${o.id}</strong> <span class="muted small">· ${date(o.created_at)}</span></div>
          ${statusBadge(o.status)}
        </div>
        <div class="imgs">${o.items.slice(0, 6).map((i) => productImg({ title: i.title, image: i.image })).join('')}</div>
        <p class="small" style="margin:0 0 12px">${o.items.map((i) => `${i.quantity}x ${esc(i.title)}`).join(' · ')}</p>
        <p class="small muted" style="margin:0 0 12px">${esc(paymentLabel(o))} · <strong style="color:var(--text)">${money(o.total)}</strong>${o.tracking_code ? ` · Seguimiento: <strong>${esc(o.tracking_code)}</strong>` : ''}</p>
        <div class="btns">
          <a class="btn btn-sm btn-secondary" href="/compra/${o.id}">Ver detalle</a>
          ${canPay ? `<button class="btn btn-sm btn-primary" data-pay="${o.id}">Pagar</button>` : ''}
          <a class="btn btn-sm btn-whatsapp" href="${esc(whatsappUrl(settings.whatsapp, o, settings.store_name))}" target="_blank" rel="noopener">${ICONS.whatsapp} WhatsApp</a>
        </div>
      </article>`;
    }).join('');

  $$('[data-pay]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      const { paymentUrl } = await api.post(`/orders/${b.dataset.pay}/pay`);
      location.href = paymentUrl;
    } catch (err) {
      toast(err.message, 'error');
      b.disabled = false;
    }
  }));
}

// ---------- Datos ----------
const pf = $('#profile-form');
pf.elements.name.value = me.name;
pf.phone.value = me.phone || '';
$('#p-email').value = me.email;

function msg(el, text, ok) {
  el.textContent = text;
  el.className = `alert ${ok ? 'alert-success' : 'alert-error'}`;
}

pf.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const { user } = await api.put('/auth/me', { name: pf.elements.name.value, phone: pf.phone.value });
    setMe(user);
    msg($('#profile-msg'), 'Datos actualizados', true);
  } catch (err) {
    msg($('#profile-msg'), err.message, false);
  }
});

$('#pass-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await api.put('/auth/me/password', Object.fromEntries(new FormData(f)));
    f.reset();
    msg($('#pass-msg'), 'Contraseña actualizada', true);
  } catch (err) {
    msg($('#pass-msg'), err.message, false);
  }
});

loadOrders().catch((err) => ($('#tab-compras').innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`));
