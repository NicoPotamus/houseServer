import { User } from '../model/types.js';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// Create account
export async function createAccount(pool: Pool, user: Omit<User, 'id'>): Promise<User> {
  const hash = await bcrypt.hash(user.password, 10);
  const result = await pool.query(
    'INSERT INTO users (name, email, password, storage_quota, files) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [user.name || null, user.email, hash, user.storage_quota || 1073741824, user.files || null]
  );
  return result.rows[0];
}

// Login
export async function login(pool: Pool, email: string, password: string): Promise<User | null> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password);
  return valid ? user : null;
}

// Update account (by id)
export async function updateAccount(pool: Pool, id: number, updates: Partial<Omit<User, 'id'>>): Promise<User | null> {
  const fields = [];
  const values = [];
  let idx = 1;
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'password' && value) {
      fields.push(`${key} = $${idx}`);
      values.push(await bcrypt.hash(value as string, 10));
    } else if (value !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
    }
    idx++;
  }
  if (fields.length === 0) return null;
  values.push(id);
  const result = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

// Delete account (by id)
export async function deleteAccount(pool: Pool, id: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
}

// Helper: get user by username
export async function getUserByUsername(pool: Pool, username: string) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [username]);
  return result.rows[0];
}

// Helper: upsert user-server mapping by user id and device id
export async function upsertUserServer(pool: Pool, userId: number, deviceId: string, status: string = 'online') {
  await pool.query(`
    INSERT INTO user_servers (user_id, device_id, last_seen, status)
    VALUES ($1, $2, NOW(), $3)
    ON CONFLICT (user_id, device_id)
    DO UPDATE SET last_seen = NOW(), status = $3
  `, [userId, deviceId, status]);
}

// Helper: upsert user-server mapping by username
export async function upsertUserServerByUsername(pool: Pool, username: string, deviceId: string) {
  const user = await getUserByUsername(pool, username);
  if (!user) throw new Error('User not found');
  await upsertUserServer(pool, user.id, deviceId, 'online');
}

// Helper: verify user credentials
export async function verifyUserCredentials(pool: Pool, username: string, password: string) {
  const user = await getUserByUsername(pool, username);
  if (!user) return false;
  const valid = await bcrypt.compare(password, user.password);
  return valid ? user : null;
}