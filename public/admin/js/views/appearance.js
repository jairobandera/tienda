/* Apariencia: colores, logo, banner, textos de la portada y pie de página, con vista previa en vivo. */
import { api } from '../../../js/core/api.js';
import { $, $$, esc, toast } from '../../../js/core/utils.js';
import { setView, confirmDialog } from '../ui.js';
import { storeNameHtml } from '../../../js/core/layout.js';

const COLORS = [
  ['Menú (encabezado)', [['header_bg', 'Fondo del menú'], ['header_text', 'Texto del menú']]],
  ['Acento', [['accent', 'Color de acento', 'Ofertas, palabra resaltada, botón del banner'], ['accent_text', 'Texto sobre el acento']]],
  ['Botones y links', [['primary', 'Botones, links y precios destacados']]],
  ['Barra de anuncio', [['announcement_bg', 'Fondo'], ['announcement_text', 'Texto']]],
  ['Banner principal', [['hero_from', 'Color inicial (izquierda)'], ['hero_to', 'Color final (derecha)', 'Poné el mismo que el inicial para un color liso'], ['hero_text', 'Texto']]],
  ['Banner de ofertas', [['promo_from', 'Color inicial'], ['promo_to', 'Color final']]],
  ['Página y pie', [['page_bg', 'Fondo de la página'], ['footer_bg', 'Fondo del pie'], ['footer_text', 'Texto del pie']]],
];
const LABEL = Object.fromEntries(COLORS.flatMap(([g, items]) => items.map(([k, l]) => [k, `${g}: ${l}`])));

const PRESETS = {
  'Azul (original)': { header_bg: '#0e1e45', header_text: '#ffffff', accent: '#ffc21a', accent_text: '#0e1e45', primary: '#2563eb', announcement_bg: '#ffc21a', announcement_text: '#0e1e45', hero_from: '#0e1e45', hero_to: '#2a4fa8', hero_text: '#ffffff', promo_from: '#0b0b0f', promo_to: '#3b2a00', page_bg: '#f3f4f7', footer_bg: '#ffffff', footer_text: '#6b7280' },
  'Negro y dorado': { header_bg: '#111111', header_text: '#ffffff', accent: '#d4a72c', accent_text: '#111111', primary: '#b8860b', announcement_bg: '#d4a72c', announcement_text: '#111111', hero_from: '#111111', hero_to: '#3a2f12', hero_text: '#ffffff', promo_from: '#000000', promo_to: '#4a3600', page_bg: '#f2f2f2', footer_bg: '#111111', footer_text: '#bdbdbd' },
  'Tecno (cian)': { header_bg: '#0b1320', header_text: '#e6f7ff', accent: '#22d3ee', accent_text: '#0b1320', primary: '#0891b2', announcement_bg: '#22d3ee', announcement_text: '#0b1320', hero_from: '#0b1320', hero_to: '#0e4a5c', hero_text: '#ffffff', promo_from: '#05080f', promo_to: '#123a52', page_bg: '#eef3f6', footer_bg: '#0b1320', footer_text: '#9fb3c8' },
  Verde: { header_bg: '#0f3d2e', header_text: '#ffffff', accent: '#a3e635', accent_text: '#0f3d2e', primary: '#16a34a', announcement_bg: '#a3e635', announcement_text: '#0f3d2e', hero_from: '#0f3d2e', hero_to: '#1f7a55', hero_text: '#ffffff', promo_from: '#0a1f17', promo_to: '#3d5a00', page_bg: '#eef2ef', footer_bg: '#ffffff', footer_text: '#5f6b66' },
  Rojo: { header_bg: '#b91c1c', header_text: '#ffffff', accent: '#fde047', accent_text: '#7f1d1d', primary: '#dc2626', announcement_bg: '#7f1d1d', announcement_text: '#ffffff', hero_from: '#7f1d1d', hero_to: '#dc2626', hero_text: '#ffffff', promo_from: '#1c0606', promo_to: '#7f1d1d', page_bg: '#f3f0f0', footer_bg: '#ffffff', footer_text: '#6b5f5f' },
  Violeta: { header_bg: '#3b0764', header_text: '#ffffff', accent: '#f472b6', accent_text: '#3b0764', primary: '#7c3aed', announcement_bg: '#f472b6', announcement_text: '#3b0764', hero_from: '#3b0764', hero_to: '#7c3aed', hero_text: '#ffffff', promo_from: '#12021f', promo_to: '#5b1050', page_bg: '#f1eef5', footer_bg: '#ffffff', footer_text: '#685f73' },
  Claro: { header_bg: '#ffffff', header_text: '#1f2328', accent: '#2563eb', accent_text: '#ffffff', primary: '#2563eb', announcement_bg: '#1f2328', announcement_text: '#ffffff', hero_from: '#e8efff', hero_to: '#c9d8ff', hero_text: '#0e1e45', promo_from: '#fff4d6', promo_to: '#ffd36b', page_bg: '#f5f6f8', footer_bg: '#ffffff', footer_text: '#6b7280' },
};

const HEX = /^#[0-9a-f]{6}$/i;
let copied = null; // último color copiado (además del portapapeles del sistema)

const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
function set(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

function nameHtml(name, highlight) {
  const words = String(name || '').trim().split(/\s+/);
  if (!highlight || words.length < 2) return esc(words.join(' '));
  const lastWord = words.pop();
  return `${esc(words.join(' '))} <span style="color:var(--pv-accent)">${esc(lastWord)}</span>`;
}

function colorRow(key, label, hint, s) {
  const v = s.theme[key];
  const others = Object.keys(LABEL).filter((k) => k !== key);
  return `
    <div class="color-row" data-color="${key}">
      <div class="color-label"><strong>${esc(label)}</strong>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>
      <div class="color-ctrl">
        <input type="color" value="${v}" data-pick aria-label="${esc(label)}">
        <input class="input hex" value="${v}" maxlength="7" data-hex aria-label="${esc(label)} (código)">
        <button type="button" class="btn btn-ghost btn-sm" data-copy title="Copiar este color">Copiar</button>
        <button type="button" class="btn btn-ghost btn-sm" data-paste title="Pegar el color copiado">Pegar</button>
        <select class="input same-as" data-same aria-label="Usar el mismo color que…">
          <option value="">Igual a…</option>
          ${others.map((k) => `<option value="${k}">${esc(LABEL[k])}</option>`).join('')}
        </select>
      </div>
    </div>`;
}

const field = (label, path, s, { type = 'text', max = 200, hint = '', placeholder = '', full = false } = {}) => `
  <div class="field ${full ? 'full' : ''}"><label>${esc(label)}</label>
    ${type === 'textarea'
      ? `<textarea rows="3" maxlength="${max}" data-path="${path}" placeholder="${esc(placeholder)}">${esc(get(s, path) ?? '')}</textarea>`
      : `<input type="${type}" maxlength="${max}" data-path="${path}" value="${esc(get(s, path) ?? '')}" placeholder="${esc(placeholder)}">`}
    ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;

const toggle = (label, path, s) => `
  <label class="small toggle-row"><input type="checkbox" class="switch-t" data-path="${path}" ${get(s, path) ? 'checked' : ''}> ${esc(label)}</label>`;

function imagePicker(label, path, s, hint) {
  const url = get(s, path);
  return `
    <div class="field full"><label>${esc(label)}</label>
      <div class="img-pick" data-img="${path}">
        <div class="img-box">${url ? `<img src="${esc(url)}" alt="">` : '<span class="muted small">Sin imagen</span>'}</div>
        <label class="btn btn-secondary btn-sm">Subir imagen<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hidden data-upload></label>
        ${url ? '<button type="button" class="btn btn-ghost btn-sm" data-clear>Quitar</button>' : ''}
      </div>
      ${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`;
}

function previewHtml(s) {
  const t = s.theme;
  const b = s.branding;
  const h = s.home;
  const logo = b.logo_url
    ? `<img src="${esc(b.logo_url)}" alt="" style="height:${Math.min(b.logo_height, 48)}px">${b.show_name_with_logo ? `<span>${nameHtml(s.store_name, b.highlight_last_word)}</span>` : ''}`
    : nameHtml(s.store_name, b.highlight_last_word);
  const heroTitle = h.hero_title ? esc(h.hero_title) : nameHtml(s.store_name, b.highlight_last_word);
  const heroBg = h.hero_image
    ? `linear-gradient(90deg,${t.hero_from} 0%,${t.hero_from}cc 45%,${t.hero_to}33 100%),url("${h.hero_image}") center/cover`
    : `linear-gradient(120deg,${t.hero_from},${t.hero_to})`;
  const r = Number(t.radius);
  return `
    <div class="pv" style="--pv-accent:${t.accent};background:${t.page_bg};border-radius:${r + 4}px">
      ${s.announcement ? `<div class="pv-ann" style="background:${t.announcement_bg};color:${t.announcement_text}">${esc(s.announcement)}</div>` : ''}
      <div class="pv-head" style="background:${t.header_bg};color:${t.header_text}">
        <div class="pv-logo">${logo}</div>
        <div class="pv-search">Buscar productos…</div>
        <div class="pv-icons">Ingresá · 🛒<span class="pv-badge" style="background:${t.accent};color:${t.accent_text}">2</span></div>
      </div>
      <div class="pv-nav" style="background:${t.header_bg};color:${t.header_text}"><b style="color:${t.accent}">Ofertas</b> Notebooks Componentes Periféricos</div>
      <div class="pv-slides">
        ${h.hero_show ? `<div class="pv-hero" style="background:${heroBg};color:${t.hero_text}">
          ${h.hero_eyebrow ? `<small style="color:${t.accent}">${esc(h.hero_eyebrow)}</small>` : ''}
          <div class="pv-h1">${heroTitle}</div>
          ${h.hero_text ? `<p>${esc(h.hero_text)}</p>` : ''}
          ${h.hero_button_text ? `<span class="pv-btn" style="background:${t.accent};color:${t.accent_text};border-radius:${Math.max(0, r - 2)}px">${esc(h.hero_button_text)}</span>` : ''}
        </div>` : ''}
        <div class="pv-hero pv-promo" style="background:linear-gradient(120deg,${t.promo_from},${t.promo_to});color:#fff">
          <small style="color:${t.accent}">Black Friday</small>
          <div class="pv-h1">Hasta <span style="color:${t.accent}">30% OFF</span></div>
        </div>
      </div>
      <div class="pv-body">
        <div class="pv-card" style="border-radius:${r}px"><div class="pv-img"></div><div><s class="muted">$ 2.490</s><div style="font-size:18px">$ 1.990 <span style="color:#00a650;font-size:12px">20% OFF</span></div></div></div>
        <div class="pv-actions"><span class="pv-btn" style="background:${t.primary};color:#fff;border-radius:${Math.max(0, r - 2)}px">Comprar ahora</span><a style="color:${t.primary}">Ver más</a></div>
      </div>
      <div class="pv-foot" style="background:${t.footer_bg};color:${t.footer_text}">${esc(s.footer.copyright || `© ${new Date().getFullYear()} ${s.store_name}`)}</div>
    </div>`;
}

export async function render() {
  const view = setView('Apariencia');
  const { settings } = await api.get('/admin/settings');
  const s = structuredClone({
    store_name: settings.store_name,
    announcement: settings.announcement,
    theme: settings.theme,
    branding: settings.branding,
    home: settings.home,
    footer: settings.footer,
  });
  let dirty = false;

  view.innerHTML = `
    <div class="appearance">
      <form id="ap" class="ap-form" novalidate>
        <section class="panel">
          <h3>Temas rápidos</h3>
          <p class="muted small">Elegí uno como punto de partida y después ajustá lo que quieras.</p>
          <div class="presets">${Object.entries(PRESETS).map(([name, p]) => `
            <button type="button" class="preset" data-preset="${esc(name)}" title="${esc(name)}">
              <span style="background:linear-gradient(120deg,${p.header_bg} 0 50%,${p.accent} 50% 70%,${p.primary} 70%)"></span>${esc(name)}</button>`).join('')}
          </div>
        </section>

        <section class="panel">
          <h3>Marca</h3>
          <div class="form-grid">
            ${field('Nombre de la tienda', 'store_name', s, { max: 80 })}
            <div class="field"><label>Tamaño del logo</label><input type="range" min="20" max="90" data-path="branding.logo_height" value="${s.branding.logo_height}"><span class="hint" id="logo-h">${s.branding.logo_height}px de alto</span></div>
            ${imagePicker('Logo', 'branding.logo_url', s, 'PNG con fondo transparente queda mejor. Si no subís logo se muestra el nombre. También se usa como ícono de la pestaña.')}
            ${toggle('Resaltar la última palabra del nombre con el color de acento', 'branding.highlight_last_word', s)}
            ${toggle('Mostrar el nombre al lado del logo', 'branding.show_name_with_logo', s)}
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h3>Colores</h3><button type="button" class="btn btn-ghost btn-sm" id="reset-colors">Volver a los colores originales</button></div>
          <p class="muted small">Con <b>Copiar</b> y <b>Pegar</b> pasás un color de un lugar a otro (por ejemplo, el del menú al banner), o usá <b>Igual a…</b>.</p>
          ${COLORS.map(([group, items]) => `<h4 class="color-group">${esc(group)}</h4>${items.map(([k, l, h]) => colorRow(k, l, h, s)).join('')}`).join('')}
          <h4 class="color-group">Bordes</h4>
          <div class="field"><label>Redondeo de botones y tarjetas</label><input type="range" min="0" max="24" data-path="theme.radius" value="${s.theme.radius}"><span class="hint" id="radius-v">${s.theme.radius}px</span></div>
        </section>

        <section class="panel">
          <h3>Barra de anuncio</h3>
          ${field('Texto (vacío = no se muestra)', 'announcement', s, { full: true })}
        </section>

        <section class="panel">
          <h3>Banner principal</h3>
          ${toggle('Mostrar el banner principal en la portada', 'home.hero_show', s)}
          <div class="form-grid">
            ${field('Texto chico de arriba', 'home.hero_eyebrow', s, { max: 60 })}
            ${field('Título', 'home.hero_title', s, { max: 80, placeholder: s.store_name, hint: 'Vacío = el nombre de la tienda' })}
            ${field('Descripción', 'home.hero_text', s, { type: 'textarea', max: 240, full: true })}
            ${field('Texto del botón (vacío = sin botón)', 'home.hero_button_text', s, { max: 40 })}
            ${field('Link del botón', 'home.hero_button_link', s, { max: 300, hint: 'Ej: /buscar, /buscar?category=notebooks o https://…' })}
            ${imagePicker('Imagen de fondo (opcional)', 'home.hero_image', s, 'Se ve a la derecha, mezclada con los colores del banner. Ideal 1600×500 o más ancha.')}
          </div>
        </section>

        <section class="panel">
          <h3>Portada</h3>
          ${toggle('Mostrar la barra de beneficios', 'home.benefits_show', s)}
          <div class="form-grid">
            ${s.home.benefits.map((b, i) => `
              ${field(`Beneficio ${i + 1}: título`, `home.benefits.${i}.title`, s, { max: 50 })}
              ${field(`Beneficio ${i + 1}: texto`, `home.benefits.${i}.text`, s, { max: 80, hint: i === 1 ? 'Vacío = "Gratis desde $…" con tu monto de envío gratis' : '' })}`).join('')}
          </div>
          <h4 class="color-group">Secciones</h4>
          <div class="form-grid">
            ${[['offers', 'Ofertas'], ['categories', 'Categorías'], ['featured', 'Destacados'], ['newest', 'Recién llegados']].map(([k, l]) => `
              <div>${toggle(`Mostrar "${l}"`, `home.${k}_show`, s)}</div>
              ${field(`Título de "${l}"`, `home.${k}_title`, s, { max: 50 })}`).join('')}
          </div>
          ${toggle('Mostrar el botón flotante de WhatsApp', 'home.whatsapp_float', s)}
        </section>

        <section class="panel">
          <h3>Pie de página</h3>
          <div class="form-grid">
            ${field('Texto sobre la tienda', 'footer.about', s, { type: 'textarea', max: 400, full: true })}
            ${field('Texto de abajo de todo', 'footer.copyright', s, { max: 120, full: true, placeholder: `© ${new Date().getFullYear()} ${s.store_name} · Todos los derechos reservados`, hint: 'Vacío = el texto de ejemplo' })}
            ${field('Instagram', 'footer.instagram', s, { max: 300, placeholder: 'https://instagram.com/…' })}
            ${field('Facebook', 'footer.facebook', s, { max: 300, placeholder: 'https://facebook.com/…' })}
            ${field('TikTok', 'footer.tiktok', s, { max: 300, placeholder: 'https://tiktok.com/@…' })}
          </div>
        </section>

        <div class="save-bar">
          <span class="muted small" id="dirty-note"></span>
          <a class="btn btn-ghost" href="/" target="_blank" rel="noopener">Ver tienda ↗</a>
          <button class="btn btn-primary" type="submit">Guardar apariencia</button>
        </div>
      </form>
      <aside class="ap-preview"><div class="ap-sticky"><h3>Vista previa</h3><div id="pv"></div><p class="muted small">Es un resumen; guardá y mirá la tienda para verla completa.</p></div></aside>
    </div>`;

  const form = $('#ap');
  const markDirty = () => {
    dirty = true;
    $('#dirty-note').textContent = 'Hay cambios sin guardar';
  };
  const refresh = () => {
    $('#pv').innerHTML = previewHtml(s);
    $('#logo-h').textContent = `${s.branding.logo_height}px de alto`;
    $('#radius-v').textContent = `${s.theme.radius}px`;
  };

  // Campos comunes (texto, casillas, deslizadores)
  form.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset.path) return;
    const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
    set(s, el.dataset.path, v);
    markDirty();
    refresh();
  });

  // Colores
  const setColor = (key, value, { fromPicker = false, fromHex = false } = {}) => {
    if (!HEX.test(value)) return false;
    value = value.toLowerCase();
    s.theme[key] = value;
    const row = $(`.color-row[data-color="${key}"]`, form);
    if (!fromPicker) $('[data-pick]', row).value = value;
    if (!fromHex) $('[data-hex]', row).value = value;
    markDirty();
    refresh();
    return true;
  };
  $$('.color-row', form).forEach((row) => {
    const key = row.dataset.color;
    $('[data-pick]', row).addEventListener('input', (e) => setColor(key, e.target.value, { fromPicker: true }));
    $('[data-hex]', row).addEventListener('input', (e) => {
      let v = e.target.value.trim();
      if (/^[0-9a-f]{6}$/i.test(v)) v = `#${v}`;
      setColor(key, v, { fromHex: true });
    });
    $('[data-hex]', row).addEventListener('blur', (e) => (e.target.value = s.theme[key]));
    $('[data-copy]', row).addEventListener('click', () => {
      copied = s.theme[key];
      navigator.clipboard?.writeText(copied).catch(() => {});
      toast(`Color ${copied} copiado. Tocá "Pegar" donde lo quieras usar.`, 'success');
    });
    $('[data-paste]', row).addEventListener('click', async () => {
      let v = copied;
      if (!v) v = (await navigator.clipboard?.readText().catch(() => ''))?.trim();
      if (v && /^[0-9a-f]{6}$/i.test(v)) v = `#${v}`;
      if (!v || !setColor(key, v)) return toast('Primero copiá un color (botón "Copiar")', 'error');
      toast(`Pegado ${v} en "${LABEL[key]}"`, 'success');
    });
    $('[data-same]', row).addEventListener('change', (e) => {
      if (e.target.value) setColor(key, s.theme[e.target.value]);
      e.target.value = '';
    });
  });

  const applyColors = (colors) => Object.entries(colors).forEach(([k, v]) => setColor(k, v));
  $$('[data-preset]', form).forEach((b) => b.addEventListener('click', () => applyColors(PRESETS[b.dataset.preset])));
  $('#reset-colors').addEventListener('click', async () => {
    if (await confirmDialog('¿Volver a los colores originales de la tienda?', { okText: 'Sí, volver' })) applyColors(PRESETS['Azul (original)']);
  });

  // Imágenes (logo y banner)
  $$('.img-pick', form).forEach((box) => {
    const path = box.dataset.img;
    const redraw = () => {
      const url = get(s, path);
      $('.img-box', box).innerHTML = url ? `<img src="${esc(url)}" alt="">` : '<span class="muted small">Sin imagen</span>';
      $('[data-clear]', box)?.classList.toggle('hidden', !url);
      if (!$('[data-clear]', box) && url) box.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-ghost btn-sm" data-clear>Quitar</button>');
      refresh();
    };
    box.addEventListener('click', (e) => {
      if (!e.target.closest('[data-clear]')) return;
      set(s, path, '');
      markDirty();
      redraw();
    });
    $('[data-upload]', box).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const fd = new FormData();
      fd.append('images', file);
      try {
        $('.img-box', box).innerHTML = '<div class="spinner" style="margin:0"></div>';
        const { urls } = await api.upload('/admin/uploads', fd);
        set(s, path, urls[0]);
        markDirty();
      } catch (err) {
        toast(err.message, 'error');
      }
      redraw();
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    try {
      await api.put('/admin/settings', s);
      dirty = false;
      $('#dirty-note').textContent = '';
      toast('Apariencia guardada. Recargá la tienda para verla.', 'success');
      $('#side-name').innerHTML = storeNameHtml(s.store_name, s.branding.highlight_last_word);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  const warn = (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  };
  addEventListener('beforeunload', warn);
  addEventListener('hashchange', () => removeEventListener('beforeunload', warn), { once: true });

  refresh();
}
