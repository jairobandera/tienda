import 'dotenv/config';

function required(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Falta la variable de entorno ${key} (revisá tu archivo .env)`);
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: Number(process.env.PORT || 3000),
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  databaseUrl: required('DATABASE_URL'),
  dbSsl: process.env.DB_SSL === 'true',
  jwtSecret: required('JWT_SECRET'),
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  mp: {
    accessToken: process.env.MP_ACCESS_TOKEN || '',
    webhookSecret: process.env.MP_WEBHOOK_SECRET || '',
  },
  whatsapp: (process.env.WHATSAPP_NUMBER || '59897961228').replace(/\D/g, ''),
  currency: process.env.CURRENCY || 'UYU',
  admin: {
    name: process.env.ADMIN_NAME || 'Administrador',
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
  },
};

if (env.isProd && env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
}

/** Pago simulado: solo en desarrollo y sin credenciales de Mercado Pago. */
env.simulatePayments = !env.isProd && !env.mp.accessToken;
