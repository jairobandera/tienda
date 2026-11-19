import { Router } from 'express';
import { adminListCustomers } from '../orders/orders.service.js';

export const adminRouter = Router();

adminRouter.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 120);
  const page = Math.max(1, Number(req.query.page) || 1);
  res.json({ customers: await adminListCustomers({ q, page }) });
});
