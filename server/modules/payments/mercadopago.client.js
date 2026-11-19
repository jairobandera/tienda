import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';

let client = null;

function mp() {
  if (!env.mp.accessToken) throw new HttpError(503, 'Mercado Pago no está configurado (MP_ACCESS_TOKEN)');
  client ??= new MercadoPagoConfig({ accessToken: env.mp.accessToken, options: { timeout: 10_000 } });
  return client;
}

const absoluteUrl = (url) => {
  if (!url) return undefined;
  if (url.startsWith('https://')) return url;
  return env.appUrl.startsWith('https://') ? `${env.appUrl}${url}` : undefined;
};

/** Crea una preferencia de Checkout Pro (tarjetas de crédito/débito, efectivo en redes de cobranza, dinero en cuenta). */
export async function createPreference(order, user, settings) {
  const returnUrl = `${env.appUrl}/compra/${order.id}`;
  const isHttps = env.appUrl.startsWith('https://');

  const items = order.items.map((i) => ({
    id: String(i.product_id ?? i.id),
    title: i.title.slice(0, 250),
    quantity: i.quantity,
    unit_price: Number(i.unit_price),
    currency_id: env.currency,
    picture_url: absoluteUrl(i.image),
  }));
  if (Number(order.shipping_cost) > 0) {
    items.push({ id: 'envio', title: 'Envío a domicilio', quantity: 1, unit_price: Number(order.shipping_cost), currency_id: env.currency });
  }

  const body = {
    items,
    payer: { name: user.name, email: user.email },
    external_reference: String(order.id),
    back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
    statement_descriptor: (settings.store_name || 'TIENDA KAIROS').toUpperCase().slice(0, 22),
    payment_methods: { installments: Number(settings.max_installments) || 12 },
    metadata: { order_id: order.id },
    // Mercado Pago solo acepta auto_return y notification_url con URLs públicas https.
    ...(isHttps && { auto_return: 'approved', notification_url: `${env.appUrl}/api/payments/webhook` }),
  };

  const pref = await new Preference(mp()).create({
    body,
    requestOptions: { idempotencyKey: `order-${order.id}-${Date.now()}` },
  });
  return { id: pref.id, initPoint: pref.init_point };
}

export async function getPayment(id) {
  return new Payment(mp()).get({ id });
}
