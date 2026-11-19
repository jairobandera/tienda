/* Componentes de UI del panel: modal, confirmación, helpers de vista. */
import { $, esc } from '../../js/core/utils.js';

export function setView(title, actionsHtml = '') {
  $('#view-title').textContent = title;
  $('#view-actions').innerHTML = actionsHtml;
  document.title = `${title} | Admin Tienda Kairos`;
  return $('#view');
}

/** Abre un modal. Devuelve { el, close }. */
export function openModal({ title, body, footer = '', wide = false, onClose }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2><button type="button" data-close aria-label="Cerrar">×</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  const close = () => {
    bg.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  bg.addEventListener('mousedown', (e) => e.target === bg && close());
  bg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  document.addEventListener('keydown', onKey);
  document.body.append(bg);
  bg.querySelector('input, select, textarea')?.focus();
  return { el: bg, close };
}

export function confirmDialog(message, { okText = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = openModal({
      title: 'Confirmar',
      body: `<p style="margin:0">${esc(message)}</p>`,
      footer: `<button class="btn btn-ghost" data-close>Cancelar</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>`,
      onClose: () => !answered && resolve(false),
    });
    m.el.querySelector('[data-ok]').addEventListener('click', () => {
      answered = true;
      m.close();
      resolve(true);
    });
  });
}

export const emptyRow = (cols, text) => `<tr><td colspan="${cols}" class="muted" style="text-align:center;padding:32px">${esc(text)}</td></tr>`;

/** Convierte ISO -> valor para <input type="datetime-local"> en hora local. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
