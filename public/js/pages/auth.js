import { api } from '../core/api.js';
import { initLayout } from '../core/layout.js';
import { mergeLocalCart } from '../core/cart.js';
import { setMe, safeNext } from '../core/session.js';
import { $ } from '../core/utils.js';

const { me } = await initLayout();
const form = $('#login-form');
const mode = form.dataset.mode;
const next = safeNext(mode === 'register' ? '/' : '/');

if (me) location.replace(next);

// Mantener el "next" al cambiar entre ingresar / registro
const nextParam = new URLSearchParams(location.search).get('next');
if (nextParam) {
  for (const a of [$('#to-register'), $('#to-login')]) if (a) a.href += `?next=${encodeURIComponent(nextParam)}`;
  if (nextParam.startsWith('/checkout')) $('#need-login')?.classList.remove('hidden');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#error');
  err.classList.add('hidden');
  const data = Object.fromEntries(new FormData(form));
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const { user } = await api.post(mode === 'register' ? '/auth/register' : '/auth/login', data);
    setMe(user);
    await mergeLocalCart();
    location.href = user.role === 'admin' && !nextParam ? '/admin' : next;
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
    btn.disabled = false;
  }
});
