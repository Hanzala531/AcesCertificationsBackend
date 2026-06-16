/**
 * Cleanup with retry + pacing.
 *   1. Delete the partial Manufacturing cert
 *   2. Delete every existing question on the Hospitality cert
 */
const axios = require('axios');

const CONFIG = {
  BASE_URL: 'http://localhost:3001/api',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'SecurePassword123!',
};

const HOSPITALITY_ID = '5ebbb6bb-63f0-4e33-8a5b-1ad2d1bb86f1';
const PARTIAL_MFG_ID = 'c0bdb934-29bd-41fb-acbb-cf0a87ca775a';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry a function on transient network errors. Up to 5 tries with backoff.
async function withRetry(fn, label) {
  let lastErr;
  for (let i = 0; i < 5; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const code = e.code || e.response?.status;
      const transient =
        e.code === 'ECONNRESET' ||
        e.code === 'ETIMEDOUT' ||
        e.code === 'ECONNREFUSED' ||
        e.code === 'EAI_AGAIN' ||
        code === 502 || code === 503 || code === 504 || code === 429;
      if (!transient) throw e;
      const wait = 500 * Math.pow(2, i);
      console.warn(`   ↻ retry ${i + 1}/5 for ${label}: ${e.code || code} — waiting ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

(async () => {
  const { data: login } = await withRetry(
    () => axios.post(`${CONFIG.BASE_URL}/auth/login`, {
      email: CONFIG.ADMIN_EMAIL, password: CONFIG.ADMIN_PASSWORD,
    }),
    'login',
  );
  const token = login?.tokens?.access_token;
  const client = axios.create({
    baseURL: CONFIG.BASE_URL,
    timeout: 30000,
    headers: { Authorization: `Bearer ${token}` },
  });

  // 1. Delete partial Manufacturing cert
  console.log(`\n→ Deleting partial Manufacturing cert ${PARTIAL_MFG_ID}...`);
  try {
    await withRetry(() => client.delete(`/certificates/${PARTIAL_MFG_ID}`), 'delete cert');
    console.log('   ✓ Deleted');
  } catch (e) {
    console.log(`   ⚠ Skip (${e.response?.status}: ${e.response?.data?.message || e.message})`);
  }

  // 2. Find all questions on Hospitality cert
  console.log(`\n→ Fetching Hospitality cert structure...`);
  const { data: cert } = await withRetry(
    () => client.get(`/certificates/${HOSPITALITY_ID}?include=sections,subsections,questions`),
    'fetch structure',
  );
  const root = cert?.data || cert;

  const questionIds = [];
  function walk(o) {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o && typeof o === 'object') {
      if (Array.isArray(o.questions)) {
        for (const q of o.questions) if (q?.id) questionIds.push(q.id);
      }
      Object.values(o).forEach(walk);
    }
  }
  walk(root);
  console.log(`   found ${questionIds.length} questions to delete`);

  let deleted = 0, failed = 0;
  for (const qid of questionIds) {
    try {
      await withRetry(() => client.delete(`/questions/${qid}`), `delete q ${qid}`);
      deleted += 1;
      if (deleted % 10 === 0) console.log(`   ... ${deleted}/${questionIds.length}`);
      await sleep(150); // pace ~6 req/s to avoid hammering
    } catch (e) {
      failed += 1;
    }
  }
  console.log(`   ✓ Deleted ${deleted}, failed ${failed}`);
})().catch((e) => {
  console.error('FAIL', e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
