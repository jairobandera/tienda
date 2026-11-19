import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { badRequest } from '../../utils/http-error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.resolve(__dirname, '..', '..', '..', 'uploads');
const PRODUCTS_DIR = path.join(UPLOADS_DIR, 'products');
fs.mkdirSync(PRODUCTS_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: PRODUCTS_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}${EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(badRequest('Solo se permiten imágenes JPG, PNG, WEBP, GIF o AVIF'))),
});

export const adminRouter = Router();

adminRouter.post('/', upload.array('images', 10), (req, res) => {
  if (!req.files?.length) throw badRequest('No se recibieron imágenes');
  res.status(201).json({ urls: req.files.map((f) => `/uploads/products/${f.filename}`) });
});
