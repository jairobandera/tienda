import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { requireAuth, optionalAuth, signToken, setAuthCookie, clearAuthCookie } from '../../middleware/auth.js';
import * as service from './auth.service.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
});

const email = z.string().trim().toLowerCase().email('Email inválido').max(160);
const password = z.string().min(8, 'Mínimo 8 caracteres').max(100);
const phone = z.string().trim().max(40).regex(/^[+\d\s()-]*$/, 'Teléfono inválido').optional().or(z.literal(''));

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá tu nombre').max(120),
  email,
  password,
  phone,
});
const loginSchema = z.object({ email, password: z.string().min(1).max(100) });
const profileSchema = z.object({ name: z.string().trim().min(2).max(120), phone });
const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });

function respondWithSession(res, user, status = 200) {
  setAuthCookie(res, signToken(user));
  res.status(status).json({ user });
}

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const user = await service.register(req.body);
  respondWithSession(res, user, 201);
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const user = await service.login(req.body);
  respondWithSession(res, user);
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Devuelve { user: null } a los visitantes (sin 401) para no ensuciar la consola del navegador.
router.get('/me', optionalAuth, async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await service.getProfile(req.user.id).catch(() => null);
  if (!user) clearAuthCookie(res);
  res.json({ user });
});

router.put('/me', requireAuth, validate(profileSchema), async (req, res) => {
  res.json({ user: await service.updateProfile(req.user.id, req.body) });
});

router.put('/me/password', requireAuth, validate(passwordSchema), async (req, res) => {
  await service.changePassword(req.user.id, req.body);
  res.json({ ok: true });
});

router.get('/me/address', requireAuth, async (req, res) => {
  res.json({ address: await service.getDefaultAddress(req.user.id) });
});

export default router;
