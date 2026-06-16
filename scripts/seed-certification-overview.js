/**
 * Seed script for Certification Overview API testing.
 *
 * Creates test data covering ALL scenarios:
 *   - IN_PROGRESS: SD in_progress, SD completed (no cert issued), assured submitted/ai_reviewing/improvement_requested
 *   - ACTIVE: issued certificates (not expired, not blocked)
 *   - FAILED: assessments with status failed / rejected
 *   - EXPIRED: issued certificates with expiry_date in the past
 *
 * Edge cases:
 *   - SD completed but assured not started
 *   - Assured in review
 *   - Certificate issued → related assessments excluded from in_progress
 *   - Expired certificates
 *   - Failed assessments mixed with active ones
 *   - Null branch_id assessments
 *   - Multiple orgs, multiple branches, multiple certificates
 *
 * Usage:
 *   node scripts/seed-certification-overview.js
 *
 * Requires DATABASE_URL in .env
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Helpers ────────────────────────────────────────────────────────────────

let certSeq = 0;
const nextCertNumber = () => `SEED-OV-${Date.now()}-${++certSeq}`;

async function createUser(client, email, role) {
  const res = await client.query(
    `INSERT INTO users (email, password, role, is_active, is_verified, email_verified)
     VALUES ($1, '$2b$10$dummyhashforseeding000000000000000000000000000000', $2, true, true, true)
     ON CONFLICT (email) DO UPDATE SET role = $2
     RETURNING id`,
    [email, role],
  );
  return res.rows[0].id;
}

async function createOrg(client, userId, name) {
  const bizId = 'BIZ-SEED-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const res = await client.query(
    `INSERT INTO organization (user_id, name, business_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, name, bizId],
  );
  return res.rows[0].id;
}

async function createBranch(client, orgId, name, isMain = false) {
  const res = await client.query(
    `INSERT INTO branches (organization_id, name, is_main, city, country)
     VALUES ($1, $2, $3, 'Test City', 'Test Country')
     RETURNING id`,
    [orgId, name, isMain],
  );
  return res.rows[0].id;
}

async function createCertificate(client, adminId, name, certCode) {
  const res = await client.query(
    `INSERT INTO certificates (certificate_id, name, industry_ids, disclosure_price, assured_price, validity_years, is_published, created_by, updated_by)
     VALUES ($1, $2, '{}', 100, 200, 1, true, $3, $3)
     ON CONFLICT (certificate_id) DO UPDATE SET name = $2
     RETURNING id`,
    [certCode, name, adminId],
  );
  return res.rows[0].id;
}

async function createBadge(client, certId, name, slot, color, score) {
  const res = await client.query(
    `INSERT INTO badges (certificate_id, name, slot, color, score)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (certificate_id, slot) DO UPDATE SET name = $2, color = $4, score = $5
     RETURNING id`,
    [certId, name, slot, color, score],
  );
  return res.rows[0].id;
}

async function createPayment(client, userId, certId, type, paid = true) {
  const res = await client.query(
    `INSERT INTO payments (user_id, certificate_id, payment_type, amount, currency, status, is_paid, paid_at)
     VALUES ($1, $2, $3, 100, 'USD', $4, $5, $6)
     RETURNING id`,
    [userId, certId, type, paid ? 'completed' : 'pending', paid, paid ? new Date() : null],
  );
  return res.rows[0].id;
}

async function createAssessment(client, { orgId, branchId, certId, paymentId, type, status, score, badgeId, submitted }) {
  const res = await client.query(
    `INSERT INTO certificate_assessments
       (organization_id, branch_id, certificate_id, payment_id, assessment_type, status, score, badge_id, is_submitted, submitted_at, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      orgId,
      branchId || null,
      certId,
      paymentId,
      type,
      status,
      score || null,
      badgeId || null,
      submitted || false,
      submitted ? new Date() : null,
      status === 'completed' ? new Date() : null,
    ],
  );
  return res.rows[0].id;
}

async function createIssuedCertificate(client, { assessmentId, certId, certName, orgId, branchId, badgeId, badgeName, badgeColor, issuedBy, expiryDate, isBlocked }) {
  const res = await client.query(
    `INSERT INTO issued_certificates
       (assessment_id, certificate_id, certificate_name, organization_id, branch_id, badge_id, badge_name, badge_color, certificate_number, review_score, issued_by, issued_at, expiry_date, is_blocked, block_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13, $14)
     RETURNING id`,
    [
      assessmentId,
      certId,
      certName,
      orgId,
      branchId || null,
      badgeId || null,
      badgeName || null,
      badgeColor || null,
      nextCertNumber(),
      85,
      issuedBy,
      expiryDate || null,
      isBlocked || false,
      isBlocked ? 'Blocked for testing' : null,
    ],
  );
  return res.rows[0].id;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('=== Seeding Certification Overview test data ===\n');

    // ── Admin user (for issuing certs) ──
    const adminId = await createUser(client, 'seed-admin-overview@aces.test', 'admin');
    console.log('Admin user:', adminId);

    // ── Certificates ──
    const cert1Id = await createCertificate(client, adminId, 'ISO 27001 - Information Security', 'SEED-ISO27001');
    const cert2Id = await createCertificate(client, adminId, 'ISO 14001 - Environmental Mgmt', 'SEED-ISO14001');
    const cert3Id = await createCertificate(client, adminId, 'SOC 2 Type II', 'SEED-SOC2');
    console.log('Certificates:', { cert1Id, cert2Id, cert3Id });

    // Badges for cert1
    const badge1Gold = await createBadge(client, cert1Id, 'Gold', 3, '#FFD700', 90);
    const badge1Silver = await createBadge(client, cert1Id, 'Silver', 2, '#C0C0C0', 75);
    const badge1Bronze = await createBadge(client, cert1Id, 'Bronze', 1, '#CD7F32', 50);

    // Badges for cert2
    const badge2Gold = await createBadge(client, cert2Id, 'Gold', 3, '#FFD700', 90);
    const badge2Silver = await createBadge(client, cert2Id, 'Silver', 2, '#C0C0C0', 75);

    // Badges for cert3
    const badge3Gold = await createBadge(client, cert3Id, 'Gold', 3, '#FFD700', 90);

    console.log('Badges created for all certificates\n');

    // ═══════════════════════════════════════════════════════════════════════
    // ORG 1: TechCorp — Full lifecycle (all 4 sections populated)
    // ═══════════════════════════════════════════════════════════════════════
    const org1UserId = await createUser(client, 'seed-org1-overview@aces.test', 'organization');
    const org1Id = await createOrg(client, org1UserId, 'TechCorp Industries');
    const org1Branch1 = await createBranch(client, org1Id, 'TechCorp HQ', true);
    const org1Branch2 = await createBranch(client, org1Id, 'TechCorp West');
    const org1Branch3 = await createBranch(client, org1Id, 'TechCorp East');
    console.log('ORG 1 - TechCorp:', { org1Id, branches: [org1Branch1, org1Branch2, org1Branch3] });

    // --- IN_PROGRESS scenarios for Org1 ---

    // 1a. SD in_progress (just started) — cert1, branch1
    let payId = await createPayment(client, org1UserId, cert1Id, 'self_disclosure');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch1, certId: cert1Id, paymentId: payId, type: 'self_disclosure', status: 'in_progress' });
    console.log('  [in_progress] SD in_progress — cert1, branch1');

    // 1b. SD submitted — cert1, branch2
    payId = await createPayment(client, org1UserId, cert1Id, 'self_disclosure');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch2, certId: cert1Id, paymentId: payId, type: 'self_disclosure', status: 'submitted', submitted: true });
    console.log('  [in_progress] SD submitted — cert1, branch2');

    // 1c. SD ai_reviewing — cert2, branch1
    payId = await createPayment(client, org1UserId, cert2Id, 'self_disclosure');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch1, certId: cert2Id, paymentId: payId, type: 'self_disclosure', status: 'ai_reviewing', submitted: true });
    console.log('  [in_progress] SD ai_reviewing — cert2, branch1');

    // 1d. SD completed but no cert issued yet — cert2, branch2  (edge case: SD done, assured not started)
    payId = await createPayment(client, org1UserId, cert2Id, 'self_disclosure');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch2, certId: cert2Id, paymentId: payId, type: 'self_disclosure', status: 'completed', score: 88, badgeId: badge2Gold, submitted: true });
    console.log('  [in_progress] SD completed (no cert issued) — cert2, branch2');

    // 1e. SD completed + assured in_progress — cert3, branch1 (edge case: assured in review)
    payId = await createPayment(client, org1UserId, cert3Id, 'self_disclosure');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch1, certId: cert3Id, paymentId: payId, type: 'self_disclosure', status: 'completed', score: 92, badgeId: badge3Gold, submitted: true });
    payId = await createPayment(client, org1UserId, cert3Id, 'assured');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch1, certId: cert3Id, paymentId: payId, type: 'assured', status: 'in_progress' });
    console.log('  [in_progress] SD completed + assured in_progress — cert3, branch1');

    // 1f. Assured submitted (being audited) — cert1, branch3
    payId = await createPayment(client, org1UserId, cert1Id, 'self_disclosure');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch3, certId: cert1Id, paymentId: payId, type: 'self_disclosure', status: 'completed', score: 80, submitted: true });
    payId = await createPayment(client, org1UserId, cert1Id, 'assured');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch3, certId: cert1Id, paymentId: payId, type: 'assured', status: 'submitted', submitted: true });
    console.log('  [in_progress] SD completed + assured submitted — cert1, branch3');

    // 1g. Assured improvement_requested — cert2, branch3
    payId = await createPayment(client, org1UserId, cert2Id, 'self_disclosure');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch3, certId: cert2Id, paymentId: payId, type: 'self_disclosure', status: 'completed', score: 70, submitted: true });
    payId = await createPayment(client, org1UserId, cert2Id, 'assured');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch3, certId: cert2Id, paymentId: payId, type: 'assured', status: 'improvement_requested', submitted: true });
    console.log('  [in_progress] assured improvement_requested — cert2, branch3');

    // 1h. Assessment with NULL branch_id (org-level, no branch)
    payId = await createPayment(client, org1UserId, cert3Id, 'self_disclosure');
    await createAssessment(client, { orgId: org1Id, branchId: null, certId: cert3Id, paymentId: payId, type: 'self_disclosure', status: 'in_progress' });
    console.log('  [in_progress] SD in_progress, NULL branch — cert3, org-level');

    // --- ACTIVE scenarios for Org1 ---

    // 2a. Active issued certificate — cert1, branch1 of a DIFFERENT combo (using new assessment)
    //     We need a completed assured assessment + issued cert
    //     Use cert2 branch1 — but wait, that has SD ai_reviewing. Let's create a new cert combo.
    //     Actually let's use cert1 at org level (null branch).
    payId = await createPayment(client, org1UserId, cert1Id, 'self_disclosure');
    let asmtId = await createAssessment(client, { orgId: org1Id, branchId: null, certId: cert1Id, paymentId: payId, type: 'self_disclosure', status: 'completed', score: 95, badgeId: badge1Gold, submitted: true });
    payId = await createPayment(client, org1UserId, cert1Id, 'assured');
    const asmtAssuredId = await createAssessment(client, { orgId: org1Id, branchId: null, certId: cert1Id, paymentId: payId, type: 'assured', status: 'completed', score: 93, badgeId: badge1Gold, submitted: true });
    await createIssuedCertificate(client, {
      assessmentId: asmtAssuredId, certId: cert1Id, certName: 'ISO 27001', orgId: org1Id, branchId: null,
      badgeId: badge1Gold, badgeName: 'Gold', badgeColor: '#FFD700', issuedBy: adminId,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    });
    console.log('  [active] Issued cert — cert1, org-level (expires in 1 year)');

    // 2b. Active certificate with no expiry
    payId = await createPayment(client, org1UserId, cert2Id, 'assured');
    const asmtForActive2 = await createAssessment(client, { orgId: org1Id, branchId: org1Branch1, certId: cert2Id, paymentId: payId, type: 'assured', status: 'completed', score: 78, badgeId: badge2Silver, submitted: true });
    // Note: cert2/branch1 also has SD ai_reviewing, but the issued cert should cause exclusion from in_progress
    // Actually, the SD is ai_reviewing for cert2/branch1, and now we also issue. This tests the "cert issued → exclude from in_progress" rule.
    await createIssuedCertificate(client, {
      assessmentId: asmtForActive2, certId: cert2Id, certName: 'ISO 14001', orgId: org1Id, branchId: org1Branch1,
      badgeId: badge2Silver, badgeName: 'Silver', badgeColor: '#C0C0C0', issuedBy: adminId,
      expiryDate: null, // No expiry
    });
    console.log('  [active] Issued cert (no expiry) — cert2, branch1');

    // --- FAILED scenarios for Org1 ---

    // 3a. SD failed — cert3, branch2
    payId = await createPayment(client, org1UserId, cert3Id, 'self_disclosure');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch2, certId: cert3Id, paymentId: payId, type: 'self_disclosure', status: 'failed', score: 20, submitted: true });
    console.log('  [failed] SD failed — cert3, branch2');

    // 3b. Assured rejected — cert3, branch3
    payId = await createPayment(client, org1UserId, cert3Id, 'assured');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch3, certId: cert3Id, paymentId: payId, type: 'assured', status: 'rejected', score: 30, submitted: true });
    console.log('  [failed] Assured rejected — cert3, branch3');

    // 3c. SD rejected — cert1, branch2 (same branch has in_progress SD too — mixed states)
    payId = await createPayment(client, org1UserId, cert1Id, 'self_disclosure');
    await createAssessment(client, { orgId: org1Id, branchId: org1Branch2, certId: cert1Id, paymentId: payId, type: 'self_disclosure', status: 'rejected', score: 15, submitted: true });
    console.log('  [failed] SD rejected — cert1, branch2 (same branch has in_progress too)');

    // --- EXPIRED scenarios for Org1 ---

    // 4a. Expired cert — cert1, branch2
    payId = await createPayment(client, org1UserId, cert1Id, 'assured');
    const asmtForExpired1 = await createAssessment(client, { orgId: org1Id, branchId: org1Branch2, certId: cert1Id, paymentId: payId, type: 'assured', status: 'completed', score: 85, badgeId: badge1Silver, submitted: true });
    await createIssuedCertificate(client, {
      assessmentId: asmtForExpired1, certId: cert1Id, certName: 'ISO 27001', orgId: org1Id, branchId: org1Branch2,
      badgeId: badge1Silver, badgeName: 'Silver', badgeColor: '#C0C0C0', issuedBy: adminId,
      expiryDate: new Date('2025-01-15'), // Expired
    });
    console.log('  [expired] Expired cert — cert1, branch2 (expired 2025-01-15)');

    // 4b. Expired cert — cert2, branch2
    payId = await createPayment(client, org1UserId, cert2Id, 'assured');
    const asmtForExpired2 = await createAssessment(client, { orgId: org1Id, branchId: org1Branch2, certId: cert2Id, paymentId: payId, type: 'assured', status: 'completed', score: 90, badgeId: badge2Gold, submitted: true });
    await createIssuedCertificate(client, {
      assessmentId: asmtForExpired2, certId: cert2Id, certName: 'ISO 14001', orgId: org1Id, branchId: org1Branch2,
      badgeId: badge2Gold, badgeName: 'Gold', badgeColor: '#FFD700', issuedBy: adminId,
      expiryDate: new Date('2024-06-01'), // Long expired
    });
    console.log('  [expired] Expired cert — cert2, branch2 (expired 2024-06-01)\n');

    // ═══════════════════════════════════════════════════════════════════════
    // ORG 2: GreenEnergy — Mostly in_progress + some failed
    // ═══════════════════════════════════════════════════════════════════════
    const org2UserId = await createUser(client, 'seed-org2-overview@aces.test', 'organization');
    const org2Id = await createOrg(client, org2UserId, 'GreenEnergy Solutions');
    const org2Branch1 = await createBranch(client, org2Id, 'GreenEnergy Main', true);
    const org2Branch2 = await createBranch(client, org2Id, 'GreenEnergy Solar Division');
    console.log('ORG 2 - GreenEnergy:', { org2Id, branches: [org2Branch1, org2Branch2] });

    // SD in_progress for all 3 certs on branch1
    for (const [certId, certName] of [[cert1Id, 'ISO 27001'], [cert2Id, 'ISO 14001'], [cert3Id, 'SOC 2']]) {
      payId = await createPayment(client, org2UserId, certId, 'self_disclosure');
      await createAssessment(client, { orgId: org2Id, branchId: org2Branch1, certId, paymentId: payId, type: 'self_disclosure', status: 'in_progress' });
    }
    console.log('  [in_progress] 3x SD in_progress — all certs, branch1');

    // SD completed + assured ai_reviewing on branch2 for cert1
    payId = await createPayment(client, org2UserId, cert1Id, 'self_disclosure');
    await createAssessment(client, { orgId: org2Id, branchId: org2Branch2, certId: cert1Id, paymentId: payId, type: 'self_disclosure', status: 'completed', score: 82, submitted: true });
    payId = await createPayment(client, org2UserId, cert1Id, 'assured');
    await createAssessment(client, { orgId: org2Id, branchId: org2Branch2, certId: cert1Id, paymentId: payId, type: 'assured', status: 'ai_reviewing', submitted: true });
    console.log('  [in_progress] SD completed + assured ai_reviewing — cert1, branch2');

    // Failed: SD failed on branch2 for cert2
    payId = await createPayment(client, org2UserId, cert2Id, 'self_disclosure');
    await createAssessment(client, { orgId: org2Id, branchId: org2Branch2, certId: cert2Id, paymentId: payId, type: 'self_disclosure', status: 'failed', score: 25, submitted: true });
    console.log('  [failed] SD failed — cert2, branch2\n');

    // ═══════════════════════════════════════════════════════════════════════
    // ORG 3: FinanceFirst — All active + some expired
    // ═══════════════════════════════════════════════════════════════════════
    const org3UserId = await createUser(client, 'seed-org3-overview@aces.test', 'organization');
    const org3Id = await createOrg(client, org3UserId, 'FinanceFirst Corp');
    const org3Branch1 = await createBranch(client, org3Id, 'FinanceFirst HQ', true);
    const org3Branch2 = await createBranch(client, org3Id, 'FinanceFirst Trading');
    console.log('ORG 3 - FinanceFirst:', { org3Id, branches: [org3Branch1, org3Branch2] });

    // Active: cert1 issued on branch1 (expires in 2 years)
    payId = await createPayment(client, org3UserId, cert1Id, 'assured');
    asmtId = await createAssessment(client, { orgId: org3Id, branchId: org3Branch1, certId: cert1Id, paymentId: payId, type: 'assured', status: 'completed', score: 96, badgeId: badge1Gold, submitted: true });
    await createIssuedCertificate(client, {
      assessmentId: asmtId, certId: cert1Id, certName: 'ISO 27001', orgId: org3Id, branchId: org3Branch1,
      badgeId: badge1Gold, badgeName: 'Gold', badgeColor: '#FFD700', issuedBy: adminId,
      expiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
    });
    console.log('  [active] Issued cert — cert1, branch1');

    // Active: cert2 issued on branch1 (no expiry)
    payId = await createPayment(client, org3UserId, cert2Id, 'assured');
    asmtId = await createAssessment(client, { orgId: org3Id, branchId: org3Branch1, certId: cert2Id, paymentId: payId, type: 'assured', status: 'completed', score: 88, badgeId: badge2Silver, submitted: true });
    await createIssuedCertificate(client, {
      assessmentId: asmtId, certId: cert2Id, certName: 'ISO 14001', orgId: org3Id, branchId: org3Branch1,
      badgeId: badge2Silver, badgeName: 'Silver', badgeColor: '#C0C0C0', issuedBy: adminId,
      expiryDate: null,
    });
    console.log('  [active] Issued cert (no expiry) — cert2, branch1');

    // Active: cert3 issued on branch2
    payId = await createPayment(client, org3UserId, cert3Id, 'assured');
    asmtId = await createAssessment(client, { orgId: org3Id, branchId: org3Branch2, certId: cert3Id, paymentId: payId, type: 'assured', status: 'completed', score: 91, badgeId: badge3Gold, submitted: true });
    await createIssuedCertificate(client, {
      assessmentId: asmtId, certId: cert3Id, certName: 'SOC 2 Type II', orgId: org3Id, branchId: org3Branch2,
      badgeId: badge3Gold, badgeName: 'Gold', badgeColor: '#FFD700', issuedBy: adminId,
      expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
    });
    console.log('  [active] Issued cert — cert3, branch2');

    // Expired: cert1 on branch2 (expired last month)
    payId = await createPayment(client, org3UserId, cert1Id, 'assured');
    asmtId = await createAssessment(client, { orgId: org3Id, branchId: org3Branch2, certId: cert1Id, paymentId: payId, type: 'assured', status: 'completed', score: 76, badgeId: badge1Silver, submitted: true });
    await createIssuedCertificate(client, {
      assessmentId: asmtId, certId: cert1Id, certName: 'ISO 27001', orgId: org3Id, branchId: org3Branch2,
      badgeId: badge1Silver, badgeName: 'Silver', badgeColor: '#C0C0C0', issuedBy: adminId,
      expiryDate: new Date('2026-03-01'), // Expired last month
    });
    console.log('  [expired] Expired cert — cert1, branch2');

    // Expired: cert2 on branch2 (expired long ago)
    payId = await createPayment(client, org3UserId, cert2Id, 'assured');
    asmtId = await createAssessment(client, { orgId: org3Id, branchId: org3Branch2, certId: cert2Id, paymentId: payId, type: 'assured', status: 'completed', score: 55, badgeId: badge2Silver, submitted: true });
    await createIssuedCertificate(client, {
      assessmentId: asmtId, certId: cert2Id, certName: 'ISO 14001', orgId: org3Id, branchId: org3Branch2,
      badgeId: badge2Silver, badgeName: 'Silver', badgeColor: '#C0C0C0', issuedBy: adminId,
      expiryDate: new Date('2024-12-31'),
    });
    console.log('  [expired] Expired cert — cert2, branch2\n');

    // ═══════════════════════════════════════════════════════════════════════
    // ORG 4: EmptyOrg — No data at all (edge case: empty results)
    // ═══════════════════════════════════════════════════════════════════════
    const org4UserId = await createUser(client, 'seed-org4-overview@aces.test', 'organization');
    const org4Id = await createOrg(client, org4UserId, 'EmptyOrg Inc');
    await createBranch(client, org4Id, 'EmptyOrg Main', true);
    console.log('ORG 4 - EmptyOrg:', { org4Id }, '(no assessments or certs — empty result test)\n');

    // ═══════════════════════════════════════════════════════════════════════
    // ORG 5: HealthPlus — Heavy mixed states
    // ═══════════════════════════════════════════════════════════════════════
    const org5UserId = await createUser(client, 'seed-org5-overview@aces.test', 'organization');
    const org5Id = await createOrg(client, org5UserId, 'HealthPlus Medical');
    const org5Branch1 = await createBranch(client, org5Id, 'HealthPlus Central', true);
    const org5Branch2 = await createBranch(client, org5Id, 'HealthPlus Lab');
    const org5Branch3 = await createBranch(client, org5Id, 'HealthPlus Clinic');
    const org5Branch4 = await createBranch(client, org5Id, 'HealthPlus Research');
    console.log('ORG 5 - HealthPlus:', { org5Id, branches: [org5Branch1, org5Branch2, org5Branch3, org5Branch4] });

    // IN_PROGRESS: Multiple assessments across branches
    const org5InProgressConfigs = [
      { branchId: org5Branch1, certId: cert1Id, type: 'self_disclosure', status: 'in_progress' },
      { branchId: org5Branch1, certId: cert2Id, type: 'self_disclosure', status: 'submitted' },
      { branchId: org5Branch2, certId: cert1Id, type: 'self_disclosure', status: 'completed', score: 80 },
      { branchId: org5Branch2, certId: cert1Id, type: 'assured', status: 'in_progress' },
      { branchId: org5Branch2, certId: cert2Id, type: 'self_disclosure', status: 'ai_reviewing' },
      { branchId: org5Branch3, certId: cert3Id, type: 'self_disclosure', status: 'improvement_requested' },
      { branchId: org5Branch4, certId: cert1Id, type: 'self_disclosure', status: 'in_progress' },
      { branchId: org5Branch4, certId: cert2Id, type: 'self_disclosure', status: 'in_progress' },
      { branchId: org5Branch4, certId: cert3Id, type: 'self_disclosure', status: 'in_progress' },
      { branchId: null, certId: cert1Id, type: 'self_disclosure', status: 'submitted' }, // org-level
    ];
    for (const cfg of org5InProgressConfigs) {
      payId = await createPayment(client, org5UserId, cfg.certId, cfg.type);
      await createAssessment(client, { orgId: org5Id, branchId: cfg.branchId, certId: cfg.certId, paymentId: payId, ...cfg });
    }
    console.log(`  [in_progress] ${org5InProgressConfigs.length}x assessments across branches`);

    // ACTIVE: 2 issued certs
    payId = await createPayment(client, org5UserId, cert1Id, 'assured');
    asmtId = await createAssessment(client, { orgId: org5Id, branchId: org5Branch3, certId: cert1Id, paymentId: payId, type: 'assured', status: 'completed', score: 94, badgeId: badge1Gold, submitted: true });
    await createIssuedCertificate(client, {
      assessmentId: asmtId, certId: cert1Id, certName: 'ISO 27001', orgId: org5Id, branchId: org5Branch3,
      badgeId: badge1Gold, badgeName: 'Gold', badgeColor: '#FFD700', issuedBy: adminId,
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    payId = await createPayment(client, org5UserId, cert2Id, 'assured');
    asmtId = await createAssessment(client, { orgId: org5Id, branchId: org5Branch3, certId: cert2Id, paymentId: payId, type: 'assured', status: 'completed', score: 87, badgeId: badge2Silver, submitted: true });
    await createIssuedCertificate(client, {
      assessmentId: asmtId, certId: cert2Id, certName: 'ISO 14001', orgId: org5Id, branchId: org5Branch3,
      badgeId: badge2Silver, badgeName: 'Silver', badgeColor: '#C0C0C0', issuedBy: adminId,
      expiryDate: null,
    });
    console.log('  [active] 2x issued certs — cert1 & cert2, branch3');

    // FAILED: Multiple failed/rejected
    const org5FailedConfigs = [
      { branchId: org5Branch1, certId: cert3Id, type: 'self_disclosure', status: 'failed', score: 10 },
      { branchId: org5Branch1, certId: cert3Id, type: 'assured', status: 'rejected', score: 22 },
      { branchId: org5Branch2, certId: cert3Id, type: 'self_disclosure', status: 'failed', score: 18 },
      { branchId: org5Branch4, certId: cert1Id, type: 'assured', status: 'rejected', score: 35 },
    ];
    for (const cfg of org5FailedConfigs) {
      payId = await createPayment(client, org5UserId, cfg.certId, cfg.type);
      await createAssessment(client, { orgId: org5Id, branchId: cfg.branchId, certId: cfg.certId, paymentId: payId, ...cfg, submitted: true });
    }
    console.log(`  [failed] ${org5FailedConfigs.length}x failed/rejected assessments`);

    // EXPIRED: 1 expired cert
    payId = await createPayment(client, org5UserId, cert3Id, 'assured');
    asmtId = await createAssessment(client, { orgId: org5Id, branchId: org5Branch1, certId: cert3Id, paymentId: payId, type: 'assured', status: 'completed', score: 72, submitted: true });
    await createIssuedCertificate(client, {
      assessmentId: asmtId, certId: cert3Id, certName: 'SOC 2 Type II', orgId: org5Id, branchId: org5Branch1,
      badgeId: null, badgeName: null, badgeColor: null, issuedBy: adminId,
      expiryDate: new Date('2025-12-01'),
    });
    console.log('  [expired] 1x expired cert — cert3, branch1\n');

    await client.query('COMMIT');

    // ── Summary ──
    console.log('=== SEED COMPLETE ===\n');
    console.log('Organizations created:');
    console.log(`  1. TechCorp Industries   (${org1Id}) — user: ${org1UserId}`);
    console.log(`     Full lifecycle: in_progress, active, failed, expired`);
    console.log(`  2. GreenEnergy Solutions  (${org2Id}) — user: ${org2UserId}`);
    console.log(`     Mostly in_progress + some failed`);
    console.log(`  3. FinanceFirst Corp      (${org3Id}) — user: ${org3UserId}`);
    console.log(`     All active + some expired`);
    console.log(`  4. EmptyOrg Inc           (${org4Id}) — user: ${org4UserId}`);
    console.log(`     No data (empty result edge case)`);
    console.log(`  5. HealthPlus Medical     (${org5Id}) — user: ${org5UserId}`);
    console.log(`     Heavy mixed states across 4 branches`);
    console.log('\nTest the API:');
    console.log('  GET /api/certifications/overview');
    console.log('  (authenticate as any org user above)\n');
    console.log('Expected counts per org (approximate):');
    console.log('  TechCorp:     in_progress≈9, active=2, failed=3, expired=2');
    console.log('  GreenEnergy:  in_progress≈5, active=0, failed=1, expired=0');
    console.log('  FinanceFirst: in_progress=0, active=3, failed=0, expired=2');
    console.log('  EmptyOrg:     in_progress=0, active=0, failed=0, expired=0');
    console.log('  HealthPlus:   in_progress≈10, active=2, failed=4, expired=1');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('SEED FAILED:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => process.exit(1));
