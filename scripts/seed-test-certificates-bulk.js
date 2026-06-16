/**
 * Bulk-creates several "test" certificates across multiple industries,
 * each with a complete structure: industries → certificate → main sections
 * → sections → subsections → questions (3 per leaf, no file uploads).
 *
 * Every certificate's description is set to:
 *   "this is created by the backend dev as a test certificate"
 *
 * USAGE:
 *   node scripts/seed-test-certificates-bulk.js
 */
const axios = require('axios');

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001/api',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'SecurePassword123!',
};

const TEST_DESCRIPTION = 'this is created by the backend dev as a test certificate';

// Industries we want present (case-insensitive match against existing)
const INDUSTRIES_NEEDED = [
  'Manufacturing',
  'Healthcare',
  'Retail',
  'Education',
  'Construction',
  'Logistics',
  'Finance',
  'Food & Agriculture',
  'Energy & Utilities',
];

// Certificates to seed. Each has exactly the same shape of hierarchy:
// 6 main sections × 3 sections × 2 subsections.
function makeHierarchy(domain) {
  return [
    {
      name: 'Governance & Compliance',
      sections: [
        { name: 'Regulatory Compliance', subsections: [`${domain} Regulatory Reporting`, 'License & Permit Management'] },
        { name: 'Internal Policies', subsections: ['Policy Documentation', 'Code of Conduct Enforcement'] },
        { name: 'Audit Readiness', subsections: ['Audit Trail Maintenance', 'Evidence Repository'] },
      ],
    },
    {
      name: 'Operations & Process Excellence',
      sections: [
        { name: 'Process Standardisation', subsections: ['SOP Coverage', 'Process Improvement Reviews'] },
        { name: 'Quality Management', subsections: ['Quality Control Checks', 'Non-conformance Tracking'] },
        { name: 'Performance Monitoring', subsections: ['KPI Dashboards', 'Operational Reporting Cadence'] },
      ],
    },
    {
      name: 'Risk & Safety Management',
      sections: [
        { name: 'Risk Assessment', subsections: ['Risk Register Maintenance', 'Mitigation Plan Tracking'] },
        { name: 'Incident Management', subsections: ['Incident Reporting', 'Root Cause Analysis'] },
        { name: 'Business Continuity', subsections: ['Continuity Plans', 'Recovery Drills'] },
      ],
    },
    {
      name: 'People & Capability',
      sections: [
        { name: 'Recruitment & Onboarding', subsections: ['Hiring Standards', 'Induction Programs'] },
        { name: 'Training & Development', subsections: ['Skill Development', 'Competency Assessments'] },
        { name: 'Employee Wellbeing', subsections: ['Wellness Programs', 'Recognition & Rewards'] },
      ],
    },
    {
      name: 'Customer & Stakeholder Engagement',
      sections: [
        { name: 'Customer Experience', subsections: ['Service Quality Standards', 'Customer Satisfaction Measurement'] },
        { name: 'Complaint Handling', subsections: ['Complaint Logging & Escalation', 'Service Recovery Procedures'] },
        { name: 'Stakeholder Communication', subsections: ['Transparency Reporting', 'Engagement Channels'] },
      ],
    },
    {
      name: 'Sustainability & Ethics',
      sections: [
        { name: 'Environmental Responsibility', subsections: ['Resource Efficiency', 'Waste Reduction'] },
        { name: 'Ethical Sourcing', subsections: ['Supplier Code of Conduct', 'Ethical Procurement Reviews'] },
        { name: 'Community Impact', subsections: ['Community Programs', 'Social Impact Reporting'] },
      ],
    },
  ];
}

// 8 certificates across 8 industries
const CERTIFICATES = [
  { name: 'Certified in Manufacturing Excellence',           industry: 'Manufacturing',         certCode: 'TEST-MFG-001',    domain: 'Manufacturing' },
  { name: 'Certified in Healthcare Quality & Patient Safety', industry: 'Healthcare',           certCode: 'TEST-HC-001',     domain: 'Healthcare' },
  { name: 'Certified in Retail Operations Excellence',       industry: 'Retail',                certCode: 'TEST-RET-001',    domain: 'Retail' },
  { name: 'Certified in Information Security Management',    industry: 'technology',            certCode: 'TEST-ISM-001',    domain: 'Information Security' },
  { name: 'Certified in Education & Training Standards',     industry: 'Education',             certCode: 'TEST-EDU-001',    domain: 'Education' },
  { name: 'Certified in Construction Site Management',       industry: 'Construction',          certCode: 'TEST-CON-001',    domain: 'Construction' },
  { name: 'Certified in Logistics & Supply Chain Excellence',industry: 'Logistics',             certCode: 'TEST-LOG-001',    domain: 'Logistics' },
  { name: 'Certified in Financial Services Compliance',      industry: 'Finance',               certCode: 'TEST-FIN-001',    domain: 'Finance' },
];

// 3-question template per subsection (no file uploads)
function buildQuestionsFor(subsectionName) {
  return [
    {
      question: `Is "${subsectionName}" documented as a written policy and consistently implemented?`,
      type: 'boolean',
      hint: 'Look for a current written SOP and evidence of routine practice.',
      criteria: 'A written, version-controlled policy exists and staff demonstrate consistent practice.',
      weightage: 10,
    },
    {
      question: `How would you rate the maturity of your "${subsectionName}" practices?`,
      type: 'rating',
      hint: '1 = Ad-hoc / no process, 5 = Optimised, measured, continuously improved.',
      criteria: 'Higher rating reflects evidence of measurement, periodic review, and improvement actions.',
      weightage: 5,
    },
    {
      question: `How is "${subsectionName}" reviewed and improved over time?`,
      type: 'multiple_choice',
      hint: 'Select the option that best matches your current cadence.',
      criteria: 'Higher score for more frequent, structured reviews with corrective action tracking.',
      options: [
        'Reviewed at least quarterly with documented improvement actions',
        'Reviewed annually as part of broader audits',
        'Reviewed only on incidents or complaints',
        'No formal review process in place',
      ],
      weightage: 4,
    },
  ];
}

const STANDARD_BADGES = [
  {
    slot: 1, name: 'Gold',
    colors: [
      { color: '#FFD700', min_score: 90, max_score: 100 },
      { color: '#FFA500', min_score: 80, max_score: 89 },
    ],
  },
  { slot: 2, name: 'Silver', colors: [{ color: '#C0C0C0', min_score: 65, max_score: 79 }] },
  { slot: 3, name: 'Bronze', colors: [{ color: '#CD7F32', min_score: 50, max_score: 64 }] },
];

// ─────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────
function makeClient(token) {
  return axios.create({
    baseURL: CONFIG.BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function login() {
  console.log(`\n🔑 Logging in as ${CONFIG.ADMIN_EMAIL}...`);
  const { data } = await makeClient().post('/auth/login', {
    email: CONFIG.ADMIN_EMAIL, password: CONFIG.ADMIN_PASSWORD,
  });
  const token = data?.tokens?.access_token || data?.data?.tokens?.access_token || data?.access_token;
  if (!token) throw new Error('No access_token in login response: ' + JSON.stringify(data));
  return token;
}

async function listIndustries(client) {
  const { data } = await client.get('/industries?page=1&limit=100');
  // Try common shapes
  const raw = data?.data?.industries || data?.data?.data || data?.data || [];
  return Array.isArray(raw) ? raw : raw.industries || [];
}

async function ensureIndustries(client, needed) {
  console.log(`\n🏭 Ensuring ${needed.length} industries exist...`);
  const existing = await listIndustries(client);
  const byName = new Map(existing.map((i) => [String(i.name).toLowerCase(), i]));
  console.log(`   existing: ${existing.map((i) => i.name).join(', ') || '(none)'}`);

  const result = new Map(); // name → id (case as DB stores)
  for (const e of existing) result.set(String(e.name).toLowerCase(), e.id);

  for (const name of needed) {
    if (result.has(name.toLowerCase())) continue;
    try {
      const { data } = await client.post('/industries', { name });
      const id = data?.data?.id || data?.id;
      if (id) {
        result.set(name.toLowerCase(), id);
        console.log(`   + created: ${name}`);
      }
    } catch (err) {
      console.warn(`   ⚠ failed to create "${name}": ${err.response?.data?.message || err.message}`);
    }
  }
  return result; // lowercase → id
}

async function createCertificate(client, cfg, industryIdByName) {
  const indId = industryIdByName.get(cfg.industry.toLowerCase());
  if (!indId) throw new Error(`Industry "${cfg.industry}" not found`);

  const payload = {
    certificate_id: cfg.certCode,
    name: cfg.name,
    industry_ids: [indId],
    disclosure_price: 1500,
    assured_price: 2500,
    validity_years: 1,
    description: TEST_DESCRIPTION,
    is_published: true,
    badges: STANDARD_BADGES,
  };
  const { data } = await client.post('/certificates', payload);
  const id = data?.data?.id || data?.id;
  if (!id) throw new Error('No certificate id returned: ' + JSON.stringify(data));
  return id;
}

async function createMainSections(client, certificateId, hierarchy) {
  const payload = { sections: hierarchy.map((m, i) => ({ name: m.name, rank: i + 1 })) };
  const { data } = await client.post(`/certificates/${certificateId}/main-sections`, payload);
  const created = data?.data || [];
  const map = new Map();
  for (const item of created) map.set(item.name, item.id);
  return map;
}

async function createChildren(client, parentId, parentType, names) {
  const payload = {
    parent_type: parentType,
    sections: names.map((name, i) => ({ name, rank: i + 1 })),
  };
  const { data } = await client.post(`/sections/${parentId}/subsections`, payload);
  const created = data?.data || [];
  const map = new Map();
  for (const item of created) map.set(item.name, item.id);
  return map;
}

async function addQuestionsTo(client, sectionId, subsectionName) {
  await client.post(`/sections/${sectionId}/questions`, {
    section_type: 'sub_section',
    questions: buildQuestionsFor(subsectionName),
  });
}

async function seedFullStructure(client, certificateId, hierarchy) {
  const mainIds = await createMainSections(client, certificateId, hierarchy);
  let secCount = 0, subCount = 0, qCount = 0;
  for (const main of hierarchy) {
    const mid = mainIds.get(main.name);
    if (!mid) continue;
    const secIds = await createChildren(client, mid, 'main', main.sections.map((s) => s.name));
    for (const sec of main.sections) {
      const sid = secIds.get(sec.name);
      if (!sid) continue;
      secCount += 1;
      const subIds = await createChildren(client, sid, 'section', sec.subsections);
      for (const subName of sec.subsections) {
        const subId = subIds.get(subName);
        if (!subId) continue;
        subCount += 1;
        await addQuestionsTo(client, subId, subName);
        qCount += 3;
      }
    }
  }
  return { mains: mainIds.size, sections: secCount, subsections: subCount, questions: qCount };
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('━━━ Bulk Test-Certificate Seeder ━━━');
  console.log(`Backend: ${CONFIG.BASE_URL}`);

  const token = await login();
  const client = makeClient(token);

  const industryIdByName = await ensureIndustries(client, INDUSTRIES_NEEDED);

  console.log(`\n📜 Creating ${CERTIFICATES.length} certificates...`);
  const summary = [];
  for (const cfg of CERTIFICATES) {
    process.stdout.write(`\n→ ${cfg.name}\n`);
    try {
      const certId = await createCertificate(client, cfg, industryIdByName);
      console.log(`   created cert id: ${certId}`);
      const stats = await seedFullStructure(client, certId, makeHierarchy(cfg.domain));
      console.log(`   structure: ${stats.mains} main / ${stats.sections} sections / ${stats.subsections} subsections / ${stats.questions} questions`);
      summary.push({ name: cfg.name, id: certId, ...stats });
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data;
      console.error(`   ✗ FAILED: ${status} ${JSON.stringify(body || err.message)}`);
      summary.push({ name: cfg.name, error: status || err.message });
    }
  }

  console.log('\n━━━ SUMMARY ━━━');
  for (const row of summary) {
    if (row.error) console.log(`✗ ${row.name}  →  ${row.error}`);
    else console.log(`✓ ${row.name}  →  ${row.id}`);
  }
}

main().catch((e) => {
  console.error('FATAL:', e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
