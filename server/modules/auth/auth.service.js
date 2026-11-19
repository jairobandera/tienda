import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { HttpError, conflict, notFound } from '../../utils/http-error.js';

const PUBLIC_FIELDS = 'id, name, email, phone, role, created_at';

export async function register({ name, email, password, phone }) {
  const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount) throw conflict('Ya existe una cuenta con ese email');
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, phone) VALUES ($1, $2, $3, $4) RETURNING ${PUBLIC_FIELDS}`,
    [name, email, hash, phone || null],
  );
  return rows[0];
}

export async function login({ email, password }) {
  const { rows } = await query(`SELECT ${PUBLIC_FIELDS}, password_hash FROM users WHERE email = $1`, [email]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Email o contraseña incorrectos');
  delete user.password_hash;
  return user;
}

export async function getProfile(id) {
  const { rows } = await query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [id]);
  if (!rows[0]) throw notFound('Usuario no encontrado');
  return rows[0];
}

export async function updateProfile(id, { name, phone }) {
  const { rows } = await query(
    `UPDATE users SET name = $2, phone = $3 WHERE id = $1 RETURNING ${PUBLIC_FIELDS}`,
    [id, name, phone || null],
  );
  return rows[0];
}

export async function changePassword(id, { currentPassword, newPassword }) {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [id]);
  if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    throw new HttpError(400, 'La contraseña actual no es correcta');
  }
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, await bcrypt.hash(newPassword, 12)]);
}

export async function getDefaultAddress(userId, db = { query }) {
  const { rows } = await db.query(
    'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC LIMIT 1',
    [userId],
  );
  return rows[0] || null;
}

/** Guarda (o actualiza) la dirección por defecto del usuario. */
export async function saveDefaultAddress(db, userId, a) {
  const current = await getDefaultAddress(userId, db);
  const values = [a.street, a.number || null, a.apartment || null, a.city, a.department, a.postalCode || null, a.notes || null];
  if (current) {
    await db.query(
      `UPDATE addresses SET street=$2, number=$3, apartment=$4, city=$5, department=$6, postal_code=$7, notes=$8 WHERE id=$1`,
      [current.id, ...values],
    );
  } else {
    await db.query(
      `INSERT INTO addresses (user_id, street, number, apartment, city, department, postal_code, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [userId, ...values],
    );
  }
}
