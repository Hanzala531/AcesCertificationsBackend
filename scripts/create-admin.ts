/**
 * create-admin.ts — create (or reset) an admin user.
 *
 * Usage:
 *   npx ts-node scripts/create-admin.ts
 *   ADMIN_EMAIL=a@b.com ADMIN_PASSWORD=Secret@123 npx ts-node scripts/create-admin.ts
 *
 * Idempotent: if the email already exists, its password/role/flags are updated.
 * Password is hashed with bcrypt (12 rounds) to match the app.
 */
import { Client } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const BCRYPT_ROUNDS = 12;
const EMAIL = process.env.ADMIN_EMAIL || 'admin@aces.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('No DATABASE_URL found in env.');
    process.exit(2);
  }

  const hash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const res = await client.query(
      `INSERT INTO users (email, password, role, is_active, is_verified, email_verified)
       VALUES ($1, $2, 'admin', TRUE, TRUE, TRUE)
       ON CONFLICT (email) DO UPDATE
         SET password = EXCLUDED.password,
             role = 'admin',
             is_active = TRUE,
             is_verified = TRUE,
             email_verified = TRUE,
             is_deleted = FALSE,
             updated_at = NOW()
       RETURNING id, email, role, (xmax = 0) AS inserted`,
      [EMAIL, hash],
    );
    const row = res.rows[0];
    console.log(`✓ Admin ${row.inserted ? 'created' : 'updated'}:`);
    console.log(`    id:    ${row.id}`);
    console.log(`    email: ${row.email}`);
    console.log(`    role:  ${row.role}`);
    console.log(`    password: ${PASSWORD}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  const detail =
    e?.code === 'ETIMEDOUT' || e?.code === 'ENETUNREACH'
      ? 'cannot reach the database host. Run from an environment that can connect to DATABASE_URL.'
      : e?.message || String(e);
  console.error('Failed:', detail);
  process.exit(1);
});
