require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const CERT_ID = '394645ed-6c39-443b-9249-023543ad50c0'; // Workplace Safety Basics
const SCORE = 75; // Enough for Bronze

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create badges for the test certificate
    const bronzeId = (await client.query(
      `INSERT INTO badges (certificate_id, name, color, slot) VALUES ($1, 'Bronze', '#CD7F32', 1) RETURNING id`, [CERT_ID]
    )).rows[0].id;
    const silverId = (await client.query(
      `INSERT INTO badges (certificate_id, name, color, slot) VALUES ($1, 'Silver', '#C0C0C0', 2) RETURNING id`, [CERT_ID]
    )).rows[0].id;
    const goldId = (await client.query(
      `INSERT INTO badges (certificate_id, name, color, slot) VALUES ($1, 'Gold', '#FFD700', 3) RETURNING id`, [CERT_ID]
    )).rows[0].id;

    // Badge color ranges
    await client.query(
      `INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1, '#CD7F32', 0, 74)`, [bronzeId]
    );
    await client.query(
      `INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1, '#C0C0C0', 75, 89)`, [silverId]
    );
    await client.query(
      `INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1, '#FFD700', 90, 100)`, [goldId]
    );
    console.log('Badges created: Bronze, Silver, Gold');

    // 2. Get all questions for the cert
    const questions = (await client.query(
      `SELECT id, type, options FROM questions WHERE certificate_id = $1 ORDER BY certificate_question_number`, [CERT_ID]
    )).rows;
    console.log('Questions found:', questions.length);

    // 3. Get all organizations
    const orgs = (await client.query(
      `SELECT o.id as org_id, o.user_id, o.name FROM organization o`
    )).rows;
    console.log('Organizations found:', orgs.length);

    // 4. Get first branch per org (if any)
    const branches = (await client.query(
      `SELECT DISTINCT ON (organization_id) id, organization_id FROM branches ORDER BY organization_id, created_at`
    )).rows;
    const branchMap = {};
    branches.forEach(b => { branchMap[b.organization_id] = b.id; });

    let created = 0;

    for (const org of orgs) {
      const branchId = branchMap[org.org_id] || null;

      // Create a fake completed payment
      const paymentId = (await client.query(
        `INSERT INTO payments (user_id, certificate_id, payment_type, amount, currency, status, is_paid, paid_at)
         VALUES ($1, $2, 'self_disclosure', 50, 'USD', 'completed', true, NOW())
         RETURNING id`,
        [org.user_id, CERT_ID]
      )).rows[0].id;

      // Create assessment
      const assessmentId = (await client.query(
        `INSERT INTO certificate_assessments (organization_id, branch_id, certificate_id, payment_id, assessment_type, badge_id, score, is_submitted, status, submitted_at, completed_at)
         VALUES ($1, $2, $3, $4, 'self_disclosure', $5, $6, true, 'completed', NOW(), NOW())
         RETURNING id`,
        [org.org_id, branchId, CERT_ID, paymentId, silverId, SCORE]
      )).rows[0].id;

      // Create answers for each question
      for (const q of questions) {
        let responseType = q.type;
        let responseValue = '';

        switch (q.type) {
          case 'boolean':
            responseValue = 'yes';
            break;
          case 'text':
            responseValue = 'We have comprehensive safety measures in place including regular inspections and documentation.';
            break;
          case 'rating':
            responseValue = '4';
            break;
          case 'number':
            responseValue = '5';
            break;
          case 'multiple_choice':
            responseValue = q.options ? q.options[0] : 'Monthly';
            break;
          case 'checkbox':
            responseValue = q.options ? JSON.stringify(q.options.slice(0, 3)) : '["Option A"]';
            break;
          case 'file':
          case 'pdf':
            responseType = 'pdf';
            responseValue = 'https://example.com/safety-doc.pdf';
            break;
          default:
            responseValue = 'N/A';
        }

        await client.query(
          `INSERT INTO assessment_queries (certificate_assessment_id, question_id, response_type, response_value)
           VALUES ($1, $2, $3, $4)`,
          [assessmentId, q.id, responseType, responseValue]
        );
      }

      // Create organization badge
      await client.query(
        `INSERT INTO organization_badges (organization_id, branch_id, certificate_id, badge_name, color, score, assessment_id, assessed_by_user_id, accessed_by_user_id)
         VALUES ($1, $2, $3, 'silver', '#C0C0C0', $4, $5, $6, $6)`,
        [org.org_id, branchId, CERT_ID, SCORE, assessmentId, org.user_id]
      );

      created++;
      console.log(`  [${created}/${orgs.length}] ${org.name} - Assessment + Badge created`);
    }

    await client.query('COMMIT');
    console.log(`\n=== DONE === ${created} assessments created with Silver badge (score: ${SCORE})`);

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
