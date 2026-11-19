import { api } from '../../../js/core/api.js';
import { $, esc, toast } from '../../../js/core/utils.js';
import { setView } from '../ui.js';

export async function render() {
  const view = setView('Configuración');
  const { settings: s } = await api.get('/admin/settings');
  view.innerHTML = `
    <form id="st" class="panel" style="max-width:760px" novalidate>
      <h3>Tienda</h3>
      <div class="form-grid">
        <div class="field"><label for="s-name">Nombre de la tienda</label><input id="s-name" name="store_name" value="${esc(s.store_name)}"></div>
        <div class="field"><label for="s-wa">WhatsApp (con código de país)</label><input id="s-wa" name="whatsapp" value="${esc(s.whatsapp)}" inputmode="numeric"><span class="hint">Ej: 59897961228. Los clientes te escriben a este número.</span></div>
        <div class="field full"><label for="s-ann">Barra de anuncio (arriba de todo)</label><input id="s-ann" name="announcement" value="${esc(s.announcement)}" maxlength="200"></div>
      </div>
      <h3 style="margin-top:8px">Envíos</h3>
      <div class="form-grid">
        <div class="field"><label for="s-ship">Costo de envío (UYU)</label><input id="s-ship" name="shipping_cost" type="number" min="0" value="${s.shipping_cost}"></div>
        <div class="field"><label for="s-free">Envío gratis desde (UYU)</label><input id="s-free" name="free_shipping_threshold" type="number" min="0" value="${s.free_shipping_threshold}"><span class="hint">0 = nunca gratis</span></div>
        <label class="small" style="display:flex;gap:8px;align-items:center;margin-bottom:16px"><input type="checkbox" class="switch-t" name="pickup_enabled" ${s.pickup_enabled ? 'checked' : ''}> Permitir retiro</label>
        <div class="field"><label for="s-pick">Dirección / indicaciones de retiro</label><input id="s-pick" name="pickup_address" value="${esc(s.pickup_address)}"></div>
      </div>
      <h3 style="margin-top:8px">Pagos</h3>
      <div class="form-grid">
        <div class="field"><label for="s-inst">Cuotas máximas con tarjeta</label><input id="s-inst" name="max_installments" type="number" min="1" max="24" value="${s.max_installments}"></div>
        <label class="small" style="display:flex;gap:8px;align-items:center;margin-bottom:16px"><input type="checkbox" class="switch-t" name="cash_enabled" ${s.cash_enabled ? 'checked' : ''}> Permitir "efectivo / transferencia a coordinar"</label>
      </div>
      <p class="muted small">Las credenciales de Mercado Pago se configuran en el archivo <code>.env</code> del servidor (MP_ACCESS_TOKEN).</p>
      <button class="btn btn-primary" type="submit">Guardar configuración</button>
    </form>`;

  $('#st').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      store_name: f.store_name.value.trim(),
      whatsapp: f.whatsapp.value.replace(/\D/g, ''),
      announcement: f.announcement.value.trim(),
      shipping_cost: Number(f.shipping_cost.value) || 0,
      free_shipping_threshold: Number(f.free_shipping_threshold.value) || 0,
      pickup_enabled: f.pickup_enabled.checked,
      pickup_address: f.pickup_address.value.trim(),
      max_installments: Number(f.max_installments.value) || 12,
      cash_enabled: f.cash_enabled.checked,
    };
    try {
      await api.put('/admin/settings', body);
      toast('Configuración guardada', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}
