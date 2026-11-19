import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';
import { migrate } from './migrate.js';
import { createAdmin } from './create-admin.js';
import { slugify } from '../utils/slugify.js';

const CATEGORIES = ['Tecnología', 'Hogar', 'Deportes', 'Moda', 'Herramientas', 'Juguetes'];

const PRODUCTS = [
  ['Auriculares inalámbricos Bluetooth con cancelación de ruido', 'Tecnología', 'Kairos Audio', 2490, 25, true],
  ['Smartwatch deportivo resistente al agua', 'Tecnología', 'FitPro', 3290, 12, true],
  ['Parlante portátil 20W con luces LED', 'Tecnología', 'Kairos Audio', 1890, 30, false],
  ['Cargador rápido USB-C 65W', 'Tecnología', 'VoltMax', 990, 50, false],
  ['Juego de sábanas 2 plazas algodón 400 hilos', 'Hogar', 'Dormilón', 1590, 18, false],
  ['Freidora de aire 5 litros digital', 'Hogar', 'CookEasy', 4990, 9, true],
  ['Set de 3 sartenes antiadherentes', 'Hogar', 'CookEasy', 2790, 14, false],
  ['Lámpara de escritorio LED regulable', 'Hogar', 'Luminar', 1190, 22, false],
  ['Pelota de fútbol profesional N°5', 'Deportes', 'GolMax', 1290, 40, false],
  ['Mancuernas ajustables 20 kg (par)', 'Deportes', 'IronFit', 5490, 6, true],
  ['Mat de yoga antideslizante 6mm', 'Deportes', 'ZenFit', 890, 35, false],
  ['Campera rompeviento unisex', 'Moda', 'Urbano', 2190, 20, false],
  ['Mochila urbana impermeable 25L', 'Moda', 'Urbano', 1790, 28, true],
  ['Taladro percutor inalámbrico 20V con 2 baterías', 'Herramientas', 'ProTool', 6490, 7, true],
  ['Set de destornilladores de precisión 32 piezas', 'Herramientas', 'ProTool', 790, 45, false],
  ['Bloques de construcción 500 piezas', 'Juguetes', 'MiniMundo', 1490, 16, false],
];

async function seed() {
  await migrate();

  for (const [i, name] of CATEGORIES.entries()) {
    await pool.query(
      `INSERT INTO categories (name, slug, sort_order) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING`,
      [name, slugify(name), i],
    );
  }
  const { rows: cats } = await pool.query('SELECT id, name FROM categories');
  const catId = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  const { rows: [{ count }] } = await pool.query('SELECT count(*) FROM products');
  if (count === 0) {
    for (const [title, cat, brand, price, stock, featured] of PRODUCTS) {
      await pool.query(
        `INSERT INTO products (title, slug, description, brand, price, stock, category_id, featured)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          title,
          slugify(title),
          `${title}.\n\nProducto ${brand} con garantía oficial de 6 meses. Envíos a todo Uruguay.\n\n• Producto nuevo y en caja sellada\n• Factura incluida\n• Consultas por WhatsApp`,
          brand,
          price,
          stock,
          catId[cat],
          featured,
        ],
      );
    }
    console.log(`✔ ${PRODUCTS.length} productos de ejemplo creados`);
  }

  try {
    const admin = await createAdmin();
    console.log(`✔ Administrador: ${admin.email}`);
  } catch (err) {
    console.warn(`⚠ No se creó el administrador: ${err.message}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seed()
    .then(() => console.log('✔ Datos iniciales cargados'))
    .catch((err) => {
      console.error('✖ Error en seed:', err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
