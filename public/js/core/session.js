import { api } from './api.js';

let mePromise = null;
let settingsPromise = null;

/** Usuario actual (o null). Se cachea durante la carga de la página. */
export function getMe() {
  mePromise ??= api.get('/auth/me').then((r) => r.user).catch(() => null);
  return mePromise;
}

export function setMe(user) {
  mePromise = Promise.resolve(user);
}

export async function logout() {
  await api.post('/auth/logout').catch(() => {});
  mePromise = Promise.resolve(null);
  location.href = '/';
}

/** Redirige a /ingresar si no hay sesión. Devuelve el usuario. */
export async function requireLogin() {
  const me = await getMe();
  if (!me) {
    location.href = `/ingresar?next=${encodeURIComponent(location.pathname + location.search)}`;
    return new Promise(() => {});
  }
  return me;
}

export function getSettings() {
  settingsPromise ??= api.get('/settings').then((r) => r.settings).catch(() => ({ whatsapp: '59897961228', store_name: 'Tienda Kairos' }));
  return settingsPromise;
}

/** Devuelve una ruta interna segura para redirigir después del login. */
export function safeNext(fallback = '/') {
  const next = new URLSearchParams(location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
