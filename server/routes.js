import { Router } from 'express';
import { requireAdmin } from './middleware/auth.js';
import { query } from './config/db.js';

import authRoutes from './modules/auth/auth.routes.js';
import cartRoutes from './modules/cart/cart.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import * as products from './modules/products/products.routes.js';
import * as categories from './modules/categories/categories.routes.js';
import * as promotions from './modules/promotions/promotions.routes.js';
import * as orders from './modules/orders/orders.routes.js';
import * as settings from './modules/settings/settings.routes.js';
import * as uploads from './modules/uploads/uploads.routes.js';
import * as customers from './modules/customers/customers.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', async (req, res) => {
  await query('SELECT 1');
  res.json({ ok: true, time: new Date().toISOString() });
});

// ---------- Público / clientes ----------
apiRouter.use('/auth', authRoutes);
apiRouter.use('/products', products.publicRouter);
apiRouter.use('/categories', categories.publicRouter);
apiRouter.use('/promotions', promotions.publicRouter);
apiRouter.use('/settings', settings.publicRouter);
apiRouter.use('/cart', cartRoutes);
apiRouter.use('/orders', orders.userRouter);
apiRouter.use('/payments', paymentRoutes);

// ---------- Administración ----------
const admin = Router();
admin.use(requireAdmin);
admin.use('/products', products.adminRouter);
admin.use('/categories', categories.adminRouter);
admin.use('/promotions', promotions.adminRouter);
admin.use('/orders', orders.adminRouter);
admin.use('/customers', customers.adminRouter);
admin.use('/settings', settings.adminRouter);
admin.use('/uploads', uploads.adminRouter);
apiRouter.use('/admin', admin);
