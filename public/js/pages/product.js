import { api } from '../core/api.js';
import { initLayout } from '../core/layout.js';
import { addToCart } from '../core/cart.js';
import { $, $$, esc, money, priceHtml, placeholder, productCard, toast, ICONS } from '../core/utils.js';

const { settings, me } = await initLayout();
const slug = decodeURIComponent(location.pathname.split('/').pop());

function render(p) {
  document.title = `${p.title} | Tienda Kairos`;
  const hasDiscount = p.discountPercent > 0;
  const free = settings.free_shipping_threshold > 0 && p.finalPrice >= settings.free_shipping_threshold;
  const maxQty = Math.min(p.stock, 10);
  const images = p.images.length ? p.images : [null];
  const installments = Number(settings.max_installments) || 12;

  $('#breadcrumb').innerHTML = `<a href="/">Inicio</a> › ${
    p.category ? `<a href="/buscar?category=${encodeURIComponent(p.category.slug)}">${esc(p.category.name)}</a> › ` : ''
  }<span>${esc(p.title)}</span>`;

  $('#product').innerHTML = `
    <div class="card product-layout">
      <div class="gallery">
        <div class="thumbs">${images.length > 1 ? images.map((src, i) => `<button type="button" class="${i ? '' : 'on'}" data-i="${i}"><img src="${esc(src)}" alt=""></button>`).join('') : ''}</div>
        <div class="main-img" id="main-img">${images[0] ? `<img src="${esc(images[0])}" alt="${esc(p.title)}">` : placeholder(p.title)}</div>
      </div>
      <div class="buy-box">
        <div class="meta">${p.condition === 'usado' ? 'Usado' : 'Nuevo'}${p.soldCount ? ` | +${p.soldCount} vendidos` : ''}</div>
        ${p.promoName ? `<span class="promo-pill">${esc(p.promoName)}</span>` : ''}
        <h1>${esc(p.title)}</h1>
        ${hasDiscount ? `<div class="old">${money(p.price)}</div>` : ''}
        <div class="price-row"><span class="price">${priceHtml(p.finalPrice)}</span>${hasDiscount ? `<span class="off" style="font-size:18px">${Math.round(p.discountPercent)}% OFF</span>` : ''}</div>
        <div class="installments">Pagá en hasta ${installments} cuotas con Mercado Pago</div>
        ${free ? `<div class="free-ship" style="font-size:15px">${ICONS.truck} Envío gratis a todo el país</div>` : `<div class="muted small">Envío a todo Uruguay: ${money(settings.shipping_cost)}${settings.free_shipping_threshold > 0 ? ` · gratis desde ${money(settings.free_shipping_threshold)}` : ''}</div>`}
        ${settings.pickup_enabled ? '<div class="muted small" style="margin-top:4px">También podés retirarlo sin costo.</div>' : ''}
        ${p.stock > 0
          ? `<div class="stock">Stock disponible</div>
             <div class="qty"><label for="qty">Cantidad:</label>
               <select id="qty">${Array.from({ length: maxQty }, (_, i) => `<option value="${i + 1}">${i + 1} ${i ? 'unidades' : 'unidad'}</option>`).join('')}</select>
               <span class="muted">(${p.stock} disponible${p.stock === 1 ? '' : 's'})</span></div>
             <button class="btn btn-primary" id="buy-now" type="button">Comprar ahora</button>
             <button class="btn btn-secondary" id="add-cart" type="button">Agregar al carrito</button>`
          : `<div class="stock out-of-stock">Sin stock por el momento</div>
             <a class="btn btn-secondary" href="https://wa.me/${esc(settings.whatsapp)}?text=${encodeURIComponent(`Hola! Quería consultar por "${p.title}"`)}" target="_blank" rel="noopener">Consultar por WhatsApp</a>`}
        <div class="trust">
          <div>${ICONS.shield}<span><strong>Compra protegida</strong> con Mercado Pago. Recibí el producto que esperabas o te devolvemos el dinero.</span></div>
          <div>${ICONS.card}<span>Tarjetas de crédito, débito, efectivo en Abitab / RedPagos${settings.cash_enabled ? ' o pago a coordinar' : ''}.</span></div>
          <div>${ICONS.whatsapp}<span>¿Dudas? <a href="https://wa.me/${esc(settings.whatsapp)}?text=${encodeURIComponent(`Hola! Tengo una consulta sobre "${p.title}"`)}" target="_blank" rel="noopener">Escribinos por WhatsApp</a></span></div>
        </div>
      </div>
      <div class="description">
        <h2>Descripción</h2>
        <div class="text">${esc(p.description || 'Sin descripción.')}</div>
      </div>
    </div>`;

  $$('.thumbs button').forEach((b) => {
    b.addEventListener('mouseenter', () => select(b));
    b.addEventListener('click', () => select(b));
  });
  function select(b) {
    $$('.thumbs button').forEach((x) => x.classList.toggle('on', x === b));
    $('#main-img').innerHTML = `<img src="${esc(images[b.dataset.i])}" alt="${esc(p.title)}">`;
  }

  const qty = () => Number($('#qty')?.value || 1);
  $('#add-cart')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await addToCart(p.id, qty());
      toast('Agregaste el producto al carrito', 'success', { linkText: 'Ver carrito', linkHref: '/carrito' });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      e.target.disabled = false;
    }
  });
  $('#buy-now')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await addToCart(p.id, qty());
      location.href = me ? '/checkout' : '/ingresar?next=/checkout';
    } catch (err) {
      toast(err.message, 'error');
      e.target.disabled = false;
    }
  });
}

async function loadRelated(p) {
  if (!p.category) return;
  const { items } = await api.get(`/products?category=${encodeURIComponent(p.category.slug)}&exclude=${p.id}&limit=10`).catch(() => ({ items: [] }));
  if (!items.length) return;
  $('#related').innerHTML = items.map(productCard).join('');
  $('#related-section').classList.remove('hidden');
}

try {
  const { product } = await api.get(`/products/${encodeURIComponent(slug)}`);
  render(product);
  loadRelated(product);
} catch (err) {
  $('#product').innerHTML = `<div class="card empty"><h2>${err.status === 404 ? 'Este producto no existe o ya no está disponible' : esc(err.message)}</h2><a class="btn btn-secondary" href="/">Volver al inicio</a></div>`;
}
