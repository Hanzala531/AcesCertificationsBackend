/**
 * Diagnostic: list all chat threads + participants for one assessment.
 * Usage: ASSESSMENT_ID=<uuid> node scripts/debug-chat-threads.js
 */
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

(async () => {
  const assessmentId = process.env.ASSESSMENT_ID || '7819b573-a727-4a0c-a39e-6c8be127a4a7';
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const threads = (await client.query(
    `SELECT ct.id, ct.thread_type, ct.question_id, ct.status,
            ct.created_at, ct.updated_at,
            q.question AS question_text,
            (SELECT COUNT(*) FROM chat_messages cm WHERE cm.thread_id = ct.id) AS msg_count,
            (SELECT COUNT(*) FROM chat_participants cp WHERE cp.thread_id = ct.id) AS p_count
     FROM chat_threads ct
     LEFT JOIN questions q ON q.id = ct.question_id
     WHERE ct.assessment_id = $1
     ORDER BY ct.created_at`,
    [assessmentId],
  )).rows;

  console.log(`\n${threads.length} chat thread(s) for assessment ${assessmentId}:\n`);
  for (const t of threads) {
    console.log(`Thread ${t.id}`);
    console.log(`  type=${t.thread_type}  status=${t.status}  msgs=${t.msg_count}  participants=${t.p_count}`);
    console.log(`  question_id=${t.question_id || '(none)'}  question="${(t.question_text || '').slice(0, 80)}"`);

    const parts = (await client.query(
      `SELECT cp.user_id, cp.role, u.email
       FROM chat_participants cp
       LEFT JOIN users u ON u.id = cp.user_id
       WHERE cp.thread_id = $1
       ORDER BY cp.role, u.email`,
      [t.id],
    )).rows;
    for (const p of parts) {
      console.log(`    [${p.role}] ${p.email || p.user_id}`);
    }
    console.log('');
  }

  await client.end();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
