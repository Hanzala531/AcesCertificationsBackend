/**
 * create-staff.ts — create (or reset) one auditor and one reviewer account.
 *
 * Each staff account needs BOTH a users row (role) AND a profile row in the
 * auditor/reviewer table with accountStatus = TRUE (login checks this).
 *
 * Idempotent: existing emails get their password/flags reset; profile rows are
 * created if missing and force-activated. Password hashed with bcrypt (12 rounds).
 *
 *   npx ts-node scripts/create-staff.ts
 */
import { Client } from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();
const BCRYPT_ROUNDS = 12;

const STAFF = [
  { role: 'auditor', email: 'auditor@aces.com', password: 'Auditor@123', first: 'Alex', last: 'Auditor' },
  { role: 'reviewer', email: 'reviewer@aces.com', password: 'Reviewer@123', first: 'Riley', last: 'Reviewer' },
];

async function upsertUser(client: Client, email: string, role: string, hash: string): Promise<string> {
  const res = await client.query(
    `INSERT INTO users (email, password, role, is_active, is_verified, email_verified)
     VALUES ($1, $2, $3, TRUE, TRUE, TRUE)
     ON CONFLICT (email) DO UPDATE
       SET password = EXCLUDED.password, role = EXCLUDED.role,
           is_active = TRUE, is_verified = TRUE, email_verified = TRUE,
           is_deleted = FALSE, updated_at = NOW()
     RETURNING id`,
    [email, hash, role],
  );
  return res.rows[0].id as string;
}

async function ensureProfile(client: Client, role: string, userId: string, first: string, last: string) {
  const table = role; // 'auditor' or 'reviewer'
  await client.query(
    `INSERT INTO ${table} (user_id, first_name, last_name)
     SELECT $1, $2, $3
     WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE user_id = $1)`,
    [userId, first, last],
  );
  // Force-activate + refresh names whether the row is new or pre-existing.
  await client.query(
    `UPDATE ${table} SET accountStatus = TRUE, first_name = $2, last_name = $3, updated_at = NOW()
     WHERE user_id = $1`,
    [userId, first, last],
  );
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('No DATABASE_URL found.'); process.exit(2); }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    for (const s of STAFF) {
      const hash = await bcrypt.hash(s.password, BCRYPT_ROUNDS);
      const userId = await upsertUser(client, s.email, s.role, hash);
      await ensureProfile(client, s.role, userId, s.first, s.last);
      console.log(`✓ ${s.role.padEnd(9)} ${s.email}  (id: ${userId})  password: ${s.password}`);
    }
    console.log('\nDone. Both accounts are active and verified — ready to log in.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  const detail = e?.code === 'ETIMEDOUT' || e?.code === 'ENETUNREACH'
    ? 'cannot reach the database host. Run from an environment that can connect to DATABASE_URL.'
    : e?.message || String(e);
  console.error('Failed:', detail);
  process.exit(1);
});
