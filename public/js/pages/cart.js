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
          <h2 style="font-size:18px;margin:0">Tu carrito <span class="muted" style="font-weight:400">· ${totals.count} ${totals.count === 1 ? 'producto' : 'productos'}</span></h2>
          ${threshold > 0 ? `<div class="ship-progress ${missing <= 0 ? 'done' : ''}">
            <div class="bar"><span style="width:${Math.min(100, Math.round((totals.total / threshold) * 100))}%"></span></div>
            <p class="small">${missing <= 0 ? '🎉 ¡Tu envío es gratis!' : `Sumá ${money(missing)} más y el envío es gratis`}</p>
          </div>` : ''}
        </div>
        ${items.map((i) => {
          const p = i.product;
          return `
          <div class="cart-item" data-id="${p.id}">
            <a class="thumb" href="/p/${encodeURIComponent(p.slug)}">${productImg(p)}</a>
            <div>
              <a class="t" href="/p/${encodeURIComponent(p.slug)}">${esc(p.title)}</a>
              ${!i.available ? '<div class="out-of-stock">Sin stock — no se incluirá en la compra</div>' : `<div class="muted small">${p.stock} disponibles</div>`}
              <div class="actions"><button type="button" data-remove>Quitar</button></div>
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
        <h2>Tu pedido</h2>
        <div class="row"><span>Subtotal</span><span>${money(totals.subtotal)}</span></div>
        ${totals.discount > 0 ? `<div class="row green"><span>Descuentos</span><span>− ${money(totals.discount)}</span></div>` : ''}
        <div class="row"><span>Envío</span><span class="${shipping ? '' : 'green'}">${shipping ? money(shipping) : 'Gratis'}</span></div>
        <div class="row total"><span>Total</span><span>${money(totals.total + shipping)}</span></div>
        <button class="btn btn-primary btn-block" id="go-checkout" type="button" ${totals.count ? '' : 'disabled'}>Ir a pagar →</button>
        <a class="btn btn-ghost btn-block" href="/" style="margin-top:6px">Seguir comprando</a>
        <p class="safe small">🔒 Pago seguro con Mercado Pago</p>
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
