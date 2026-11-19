import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`🛍  Tienda Kairos corriendo en ${env.appUrl} (puerto ${env.port}, ${env.nodeEnv})`);
  if (env.simulatePayments) console.log('⚠  Sin MP_ACCESS_TOKEN: los pagos se simulan (solo desarrollo).');
});

function shutdown(signal) {
  console.log(`${signal} recibido, cerrando...`);
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
