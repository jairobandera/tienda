import { badRequest } from '../utils/http-error.js';

/**
 * Valida req.body (o req.query) con un schema de zod.
 * - body: reemplaza req.body por los datos validados
 * - query: deja los datos en req.validQuery (en Express 5 req.query es de solo lectura)
 */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(source === 'query' ? req.query : req.body ?? {});
  if (!result.success) {
    const fields = result.error.flatten().fieldErrors;
    const first = Object.entries(fields)[0];
    const msg = first ? `${first[0]}: ${first[1][0]}` : result.error.issues[0]?.message;
    throw badRequest(`Datos inválidos (${msg})`, fields);
  }
  if (source === 'query') req.validQuery = result.data;
  else req.body = result.data;
  next();
};

export const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('ID inválido');
  return id;
};
