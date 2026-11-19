import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { apiRouter } from './routes.js';
import { errorHandler, notFoundApi } from './middleware/errors.js';
import { UPLOADS_DIR } from './modules/uploads/uploads.routes.js';
import { getSettings, themeCss } from './modules/settings/settings.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

/** Rutas "lindas" del frontend -> archivo HTML. */
const PAGES = {
  '/': 'index.html',
  '/buscar': 'buscar.html',
  '/p/:slug': 'producto.html',
  '/carrito': 'carrito.html',
  '/checkout': 'checkout.html',
  '/compra/:id': 'compra.html',
  '/ingresar': 'ingresar.html',
  '/registro': 'registro.html',
  '/mi-cuenta': 'mi-cuenta.html',
  '/admin': 'admin/index.html',
};

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: env.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', apiRouter);
  app.use('/api', notFoundApi);

  // Colores elegidos en el panel. Se revalida siempre (ETag), así un cambio se ve al recargar.
  app.get('/theme.css', async (req, res) => {
    res.set('Cache-Control', 'no-cache').type('text/css').send(themeCss(await getSettings()));
  });

  app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', immutable: true, fallthrough: false }));
  app.use(express.static(PUBLIC_DIR, { index: false, maxAge: env.isProd ? '1d' : 0 }));

  for (const [route, file] of Object.entries(PAGES)) {
    app.get(route, (req, res) => res.sendFile(path.join(PUBLIC_DIR, file)));
  }

  app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html')));
  app.use(errorHandler);
  return app;
}
