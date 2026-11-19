/* Shell del panel: control de acceso y router por hash. */
import { getMe, logout } from '../../js/core/session.js';
import { $, $$, esc } from '../../js/core/utils.js';
import { api } from '../../js/core/api.js';
import { getSettings } from '../../js/core/session.js';
import { storeNameHtml } from '../../js/core/layout.js';

const ROUTES = {
  dashboard: () => import('./views/dashboard.js'),
  pedidos: () => import('./views/orders.js'),
  productos: () => import('./views/products.js'),
  categorias: () => import('./views/categories.js'),
  promociones: () => import('./views/promotions.js'),
  clientes: () => import('./views/customers.js'),
  apariencia: () => import('./views/appearance.js'),
  configuracion: () => import('./views/settings.js'),
};

const me = await getMe();
if (!me) location.replace('/ingresar?next=/admin');
else if (me.role !== 'admin') {
  document.body.innerHTML = '<div class="card empty" style="max-width:520px;margin:80px auto"><h2>No tenés acceso al panel de administración</h2><a class="btn btn-primary" href="/">Volver a la tienda</a></div>';
  throw new Error('forbidden');
}

getSettings().then((st) => {
  $('#side-name').innerHTML = storeNameHtml(st.store_name, st.branding?.highlight_last_word !== false);
});

$('#admin-logout').addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});
$('#menu-btn').addEventListener('click', () => $('#side').classList.toggle('open'));

// Las vistas disparan este evento cuando cambia el estado de un pedido.
addEventListener('admin:orders-changed', () => refreshBadge());

async function refreshBadge() {
  try {
    const s = await api.get('/admin/orders/stats');
    const el = $('#to-ship-count');
    el.textContent = s.to_ship;
    el.classList.toggle('hidden', !s.to_ship);
  } catch { /* ignore */ }
}

async function route() {
  const [path, search = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [name, ...rest] = path.split('/');
  const query = Object.fromEntries(new URLSearchParams(search));
  const key = ROUTES[name] ? name : 'dashboard';
  $$('#admin-nav a[data-route]').forEach((a) => a.classList.toggle('on', a.dataset.route === key));
  $('#side').classList.remove('open');
  $('#view').innerHTML = '<div class="spinner"></div>';
  try {
    const mod = await ROUTES[key]();
    await mod.render({ params: rest, query, me });
  } catch (err) {
    console.error(err);
    $('#view').innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
}

addEventListener('hashchange', route);
route();
refreshBadge();
