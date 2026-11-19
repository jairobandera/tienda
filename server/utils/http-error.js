export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Tenés que iniciar sesión') => new HttpError(401, msg);
export const forbidden = (msg = 'No tenés permisos para esta acción') => new HttpError(403, msg);
export const notFound = (msg = 'No encontrado') => new HttpError(404, msg);
export const conflict = (msg) => new HttpError(409, msg);

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
