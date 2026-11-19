# Tienda Kairos

E-commerce estilo marketplace para vender **productos propios**. Frontend en HTML/CSS/JS (sin frameworks), backend en **Node.js + Express**, base de datos **PostgreSQL** y pagos con **Mercado Pago** (Checkout Pro).

## Funcionalidades

**Tienda**
- Portada con banners de promociones (con cuenta regresiva), ofertas, destacados, categorías y novedades.
- Buscador con autocompletado (sin importar tildes), filtros por categoría, precio, ofertas y stock, orden y paginación.
- Página de producto con galería, precio tachado, % OFF, stock, cuotas y productos relacionados.
- Carrito: funciona como invitado (localStorage) y se fusiona con el de la cuenta al iniciar sesión.
- **Para comprar es obligatorio tener cuenta** (registro / inicio de sesión).
- Checkout: envío a domicilio (departamentos de Uruguay) o retiro, dirección guardada para próximas compras.
- Pagos: **Mercado Pago** (crédito en cuotas, débito, efectivo en Abitab/RedPagos, dinero en cuenta) o **efectivo / transferencia a coordinar** (configurable).
- Tras comprar, botón para **enviar el detalle de la compra por WhatsApp** al +598 97 961 228 (configurable).
- "Mi cuenta": historial de compras, estado, reintentar pago, datos personales y contraseña.

**Panel de administración** (`/admin`)
- Resumen: ventas totales / mes / hoy, ticket promedio, gráfico de 30 días, medios de pago, más vendidos, stock bajo.
- Pedidos: filtros por estado, medio de pago, fechas y búsqueda; detalle con cliente, teléfono (link a WhatsApp), dirección, medio de pago, cuotas e ID de pago; cambio de estado, código de seguimiento, notas internas; exportar a CSV (Excel).
- Productos: alta/edición con subida de imágenes (arrastrar y soltar), stock, destacado, pausar/publicar, descuento propio y **descuento masivo** a los seleccionados.
- **Ofertas y descuentos**: promociones tipo *Black Friday* para toda la tienda, por categorías o por productos, con fecha de inicio/fin y banner. Siempre se aplica el mayor descuento.
- Categorías, clientes (compras y total gastado) y configuración (envío, envío gratis desde, retiro, cuotas, WhatsApp, barra de anuncio).

## Requisitos
- Node.js 20 o superior
- PostgreSQL 13 o superior

## Instalación

```bash
npm install
cp .env.example .env        # en Windows: copy .env.example .env
```

Editá `.env`:
- `DATABASE_URL`: conexión a tu Postgres (creá antes la base, ej. `CREATE DATABASE tienda_kairos;`).
- `JWT_SECRET`: una cadena larga y aleatoria.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: tu usuario administrador.
- `MP_ACCESS_TOKEN`: tu Access Token de Mercado Pago (ver abajo).

```bash
npm run db:setup     # crea las tablas, categorías/productos de ejemplo y el admin
npm run dev          # http://localhost:3000
```

Ingresá con el email/contraseña de admin y vas a ser redirigido a `/admin`.

> Para cambiar/crear el admin más adelante: `npm run create-admin -- email@dominio.com ClaveSegura123 "Tu Nombre"`

## Mercado Pago
1. Entrá a <https://www.mercadopago.com.uy/developers/panel/app> y creá una aplicación (Checkout Pro).
2. Copiá el **Access Token** (de prueba para testear, de producción para vender) en `MP_ACCESS_TOKEN`.
3. En producción, `APP_URL` debe ser tu dominio con **https**: así se activan el retorno automático y el **webhook** (`https://tudominio.com/api/payments/webhook`).
4. Opcional: en *Webhooks* configurá esa URL con el evento **Pagos** y copiá la clave secreta en `MP_WEBHOOK_SECRET` para validar las notificaciones.

Sin `MP_ACCESS_TOKEN` y en desarrollo se activa un **pago simulado** que permite probar todo el flujo (aprobar, pendiente, rechazar).

Seguridad: el precio y el total se calculan siempre en el servidor, y cada pago se consulta a la API de Mercado Pago (no se confía en el navegador ni en el webhook); además se verifica que el monto cobrado cubra el total.

## Estructura

```
server/
  config/          env y pool de PostgreSQL
  db/              schema.sql, migración, seed, create-admin
  middleware/      auth (JWT en cookie httpOnly), validación (zod), errores
  modules/         un módulo por dominio (routes + service)
    auth/ products/ categories/ cart/ orders/ payments/ promotions/ settings/ uploads/ customers/
  routes.js        monta los módulos (/api y /api/admin)
  app.js           express, seguridad, estáticos y rutas de páginas
public/
  css/ js/core/    utilidades compartidas (api, sesión, carrito, layout)
  js/pages/        un script por página
  admin/           panel de administración (SPA por hash, vistas cargadas bajo demanda)
uploads/           imágenes subidas de productos
```

## Rendimiento y escalabilidad
- Precios finales calculados en una vista SQL (`v_products`) con el mejor descuento vigente.
- Índices en columnas de búsqueda/orden e índice trigram (`pg_trgm`) para búsquedas por texto.
- Compresión gzip, caché HTTP de estáticos e imágenes, paginación, pool de conexiones.
- Módulos independientes: agregar uno nuevo es crear `server/modules/<nombre>` y montarlo en `routes.js`.
- Sin estado en el servidor (JWT): se puede correr en varias instancias detrás de un balanceador. Si escalás horizontalmente, mové `uploads/` a un almacenamiento compartido (S3, Cloudinary, etc.).

## Producción (resumen)
- `NODE_ENV=production`, `APP_URL=https://tudominio.com`, `JWT_SECRET` de 32+ caracteres, `DB_SSL=true` si tu proveedor lo requiere.
- `npm run db:migrate` en cada despliegue (es idempotente) y `npm start`.
- Hosting sugerido: Render / Railway / un VPS con Nginx + PM2; Postgres administrado (Neon, Supabase, Railway).

## Logo
Por ahora la marca es texto ("Tienda **Kairos**"). Cuando tengas el logo, reemplazá el contenido de `.logo` en `public/js/core/layout.js` y `public/favicon.svg`.
