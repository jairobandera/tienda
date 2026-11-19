import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

export function notFoundApi(req, res) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.code === '23505') return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  if (err?.code === '23503') return res.status(409).json({ error: 'El registro está siendo usado por otros datos' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err?.name === 'MulterError') return res.status(400).json({ error: `Error al subir archivo: ${err.message}` });
  if (err?.status >= 400 && err.status < 500) return res.status(err.status).json({ error: err.expose ? err.message : 'Solicitud inválida' });

  console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({ error: 'Error interno del servidor', ...(env.isProd ? {} : { debug: err.message }) });
}
