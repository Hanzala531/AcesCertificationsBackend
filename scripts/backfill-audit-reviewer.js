/**
 * One-shot backfill: copy assigned_reviewer_id from certificate_assessments
 * into audits for any non-archived audits row that's missing it.
 * Safe to run repeatedly.
 */
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set in .env');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query(`
    UPDATE audits a
    SET assigned_reviewer_id = ca.assigned_reviewer_id, updated_at = NOW()
    FROM certificate_assessments ca
    WHERE a.assessment_id = ca.id
      AND a.is_archived = FALSE
      AND a.assigned_reviewer_id IS NULL
      AND ca.assigned_reviewer_id IS NOT NULL
    RETURNING a.assessment_id, a.assigned_reviewer_id
  `);
  console.log(`Backfilled ${res.rowCount} audits row(s).`);
  for (const r of res.rows) console.log(`  ${r.assessment_id} → ${r.assigned_reviewer_id}`);
  await client.end();
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
