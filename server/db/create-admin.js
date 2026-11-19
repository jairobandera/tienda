import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';

/**
 * Crea o actualiza el usuario administrador con los datos de ADMIN_* del .env.
 * También acepta argumentos: npm run create-admin -- email@x.com clave "Nombre"
 */
export async function createAdmin({ email, password, name } = {}) {
  email = (email || env.admin.email || '').trim().toLowerCase();
  password = password || env.admin.password;
  name = name || env.admin.name;
  if (!email || !password) throw new Error('Definí ADMIN_EMAIL y ADMIN_PASSWORD en el .env');
  if (password.length < 8) throw new Error('La contraseña del admin debe tener al menos 8 caracteres');
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash
     RETURNING id, email`,
    [name, email, hash],
  );
  return rows[0];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [email, password, name] = process.argv.slice(2);
  createAdmin({ email, password, name })
    .then((u) => console.log(`✔ Administrador listo: ${u.email}`))
    .catch((err) => {
      console.error('✖', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
