import { initLayout } from '../core/layout.js';
import { loadCart, setQuantity } from '../core/cart.js';
import { $, $$, esc, money, productImg, toast } from '../core/utils.js';

const { me, settings } = await initLayout();

function render({ items, totals }) {
  if (!items.length) {
    $('#cart').innerHTML = `
      <div class="card empty" style="margin:24px 0">
        <h2>Tu carrito está vacío</h2>
        <p class="muted">Sumá productos y conseguí envío gratis${settings.free_shipping_threshold > 0 ? ` desde ${money(settings.free_shipping_threshold)}` : ''}.</p>
        <a class="btn btn-primary" href="/">Descubrir productos</a>
      </div>`;
    return;
  }
  const threshold = Number(settings.free_shipping_threshold) || 0;
  const missing = threshold - totals.total;
  const shipping = threshold > 0 && missing <= 0 ? 0 : Number(settings.shipping_cost);

  $('#cart').innerHTML = `
    <div class="two-col">
      <div class="card">
        <div class="card-pad" style="padding-bottom:12px;border-bottom:1px solid var(--border)">
          <h2 style="font-size:18px;margin:0">Productos (${totals.count})</h2>
          ${threshold > 0 ? `<p class="small ${missing <= 0 ? 'free-ship' : 'muted'}" style="margin:6px 0 0">${missing <= 0 ? '¡Tenés envío gratis!' : `Te faltan ${money(missing)} para tener envío gratis`}</p>` : ''}
        </div>
        ${items.map((i) => {
          const p = i.product;
          return `
          <div class="cart-item" data-id="${p.id}">
            <a class="thumb" href="/p/${encodeURIComponent(p.slug)}">${productImg(p)}</a>
            <div>
              <a class="t" href="/p/${encodeURIComponent(p.slug)}">${esc(p.title)}</a>
              ${!i.available ? '<div class="out-of-stock">Sin stock — no se incluirá en la compra</div>' : `<div class="muted small">${p.stock} disponibles</div>`}
              <div class="actions"><button type="button" data-remove>Eliminar</button></div>
            </div>
            <div class="stepper">
              <button type="button" data-step="-1" ${i.quantity <= 1 ? 'disabled' : ''} aria-label="Restar">−</button>
              <span>${i.quantity}</span>
              <button type="button" data-step="1" ${i.quantity >= p.stock ? 'disabled' : ''} aria-label="Sumar">+</button>
            </div>
            <div class="line-price">
              ${p.discountPercent > 0 ? `<span class="old">${money(p.price * i.quantity)}</span>` : ''}
              <strong>${money(p.finalPrice * i.quantity)}</strong>
            </div>
          </div>`;
        }).join('')}
      </div>
      <aside class="card summary">
        <h2>Resumen de compra</h2>
        <div class="row"><span>Productos (${totals.count})</span><span>${money(totals.subtotal)}</span></div>
        ${totals.discount > 0 ? `<div class="row green"><span>Descuentos</span><span>− ${money(totals.discount)}</span></div>` : ''}
        <div class="row"><span>Envío</span><span class="${shipping ? '' : 'green'}">${shipping ? money(shipping) : 'Gratis'}</span></div>
        <div class="row total"><span>Total</span><span>${money(totals.total + shipping)}</span></div>
        <button class="btn btn-primary btn-block" id="go-checkout" type="button" ${totals.count ? '' : 'disabled'}>Continuar compra</button>
        ${!me ? '<p class="muted small" style="text-align:center;margin-bottom:0">Vas a necesitar iniciar sesión para comprar.</p>' : ''}
      </aside>
    </div>`;

  $$('.cart-item').forEach((row) => {
    const id = Number(row.dataset.id);
    const item = items.find((i) => i.product.id === id);
    row.querySelector('[data-remove]').addEventListener('click', () => change(id, 0));
    $$('[data-step]', row).forEach((b) => b.addEventListener('click', () => change(id, item.quantity + Number(b.dataset.step))));
  });
  $('#go-checkout').addEventListener('click', () => {
    location.href = me ? '/checkout' : '/ingresar?next=/checkout';
  });
}

async function change(id, qty) {
  try {
    await setQuantity(id, qty);
    render(await loadCart());
  } catch (err) {
    toast(err.message, 'error');
  }
}

render(await loadCart());
