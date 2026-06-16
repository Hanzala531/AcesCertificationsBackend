/**
 * Seeds the structure (Main Sections → Sections → Subsections) for the
 * "Certified in Hospitality Management" certificate.
 *
 * USAGE:
 *   1. Create the certificate manually first and copy its UUID.
 *   2. Set the env vars below (or edit the CONFIG block).
 *   3. Run:  node scripts/seed-hospitality-management.js
 *
 * REQUIRES: admin or subadmin credentials.
 */

const axios = require('axios');

// ─────────────────────────────────────────────────────────────
// CONFIG — override via env vars or edit defaults
// ─────────────────────────────────────────────────────────────
const CONFIG = {
  BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001/api',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'changeme',
  CERTIFICATE_ID: process.env.CERTIFICATE_ID || '00000000-0000-0000-0000-000000000000',
};

// ─────────────────────────────────────────────────────────────
// Hospitality Management hierarchy
// ─────────────────────────────────────────────────────────────
const HIERARCHY = [
  {
    name: 'Guest Experience & Service Excellence',
    sections: [
      {
        name: 'Front Office & Reservations',
        subsections: ['Check-in / Check-out Standards', 'Reservation Accuracy & Booking Systems'],
      },
      {
        name: 'Concierge & Guest Relations',
        subsections: ['Concierge Service Quality', 'VIP & Repeat Guest Programs'],
      },
      {
        name: 'Complaint Handling & Service Recovery',
        subsections: ['Complaint Logging & Escalation', 'Service Recovery Procedures'],
      },
    ],
  },
  {
    name: 'Operations & Property Management',
    sections: [
      {
        name: 'Housekeeping Standards',
        subsections: ['Room Cleaning Protocols', 'Public Area Maintenance'],
      },
      {
        name: 'Maintenance & Engineering',
        subsections: ['Preventive Maintenance Schedules', 'Equipment Inspection Logs'],
      },
      {
        name: 'Facility Management',
        subsections: ['Building Compliance', 'Asset Lifecycle Tracking'],
      },
    ],
  },
  {
    name: 'Food & Beverage Management',
    sections: [
      {
        name: 'Restaurant Operations',
        subsections: ['Service Standards & Etiquette', 'Menu Quality & Consistency'],
      },
      {
        name: 'Banquet & Event Services',
        subsections: ['Event Setup & Coordination', 'Catering Logistics'],
      },
      {
        name: 'Bar & Beverage Service',
        subsections: ['Responsible Alcohol Service', 'Inventory & Stock Control'],
      },
    ],
  },
  {
    name: 'Human Resources & Staff Development',
    sections: [
      {
        name: 'Recruitment & Onboarding',
        subsections: ['Hiring Standards', 'New Employee Induction'],
      },
      {
        name: 'Training & Performance Management',
        subsections: ['Skill Development Programs', 'Performance Appraisal Cycles'],
      },
      {
        name: 'Employee Welfare & Engagement',
        subsections: ['Workplace Wellbeing', 'Recognition & Rewards'],
      },
    ],
  },
  {
    name: 'Health, Safety & Hygiene',
    sections: [
      {
        name: 'Food Safety (HACCP)',
        subsections: ['Temperature Control & Storage', 'Cross-Contamination Prevention'],
      },
      {
        name: 'Fire Safety & Emergency Procedures',
        subsections: ['Fire Drills & Evacuation Plans', 'Emergency Equipment Inspection'],
      },
      {
        name: 'Health & Sanitation',
        subsections: ['Personal Hygiene Standards', 'Cleaning & Disinfection Schedules'],
      },
    ],
  },
  {
    name: 'Sustainability & Environmental Responsibility',
    sections: [
      {
        name: 'Energy & Water Management',
        subsections: ['Energy Audits & Efficiency', 'Water Conservation Practices'],
      },
      {
        name: 'Waste Management',
        subsections: ['Recycling & Segregation', 'Food Waste Reduction'],
      },
      {
        name: 'Sustainable Sourcing',
        subsections: ['Local & Ethical Procurement', 'Eco-friendly Supplies'],
      },
    ],
  },
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
  console.log(`\n[1/4] Logging in as ${CONFIG.ADMIN_EMAIL}...`);
  const client = makeClient();
  const { data } = await client.post('/auth/login', {
    email: CONFIG.ADMIN_EMAIL,
    password: CONFIG.ADMIN_PASSWORD,
  });
  // The login response shape varies; try common fields
  const token =
    data?.data?.tokens?.access_token ||
    data?.data?.access_token ||
    data?.tokens?.access_token ||
    data?.access_token ||
    data?.token;
  if (!token) {
    throw new Error('Login succeeded but no access token in response: ' + JSON.stringify(data));
  }
  console.log('    ✓ Logged in');
  return token;
}

async function createMainSections(client, certificateId, sections) {
  console.log(`\n[2/4] Creating ${sections.length} main section(s)...`);
  const payload = { sections: sections.map((s, i) => ({ name: s.name, rank: i + 1 })) };
  const { data } = await client.post(
    `/certificates/${certificateId}/main-sections`,
    payload,
  );
  const created = data?.data || [];
  console.log(`    ✓ Created ${created.length} main sections`);
  // Map name → id
  const idByName = new Map();
  for (const item of created) idByName.set(item.name, item.id);
  return idByName;
}

async function createChildren(client, parentId, parentType, names) {
  const payload = {
    parent_type: parentType,
    sections: names.map((name, i) => ({ name, rank: i + 1 })),
  };
  const { data } = await client.post(`/sections/${parentId}/subsections`, payload);
  const created = data?.data || [];
  const idByName = new Map();
  for (const item of created) idByName.set(item.name, item.id);
  return idByName;
}

// Build a sensible 3-question pack for any leaf subsection.
// Allowed types: boolean, text, multiple_choice, rating, number, checkbox.
// AVOIDED: file (no document upload questions per requirement).
function buildQuestionsFor(subsectionName) {
  return [
    {
      question: `Is "${subsectionName}" documented as a written policy and consistently implemented across the property?`,
      type: 'boolean',
      hint: 'Look for a current written SOP and evidence of routine practice (logs, observations, training records).',
      criteria: 'A written, dated, version-controlled policy exists AND staff demonstrate consistent practice during walk-through.',
      weightage: 10,
    },
    {
      question: `How would you rate the maturity of your "${subsectionName}" practices?`,
      type: 'rating',
      hint: '1 = Ad-hoc / no process, 5 = Optimised, measured, continuously improved.',
      criteria: 'Rating reflects evidence of process maturity, KPIs tracked, periodic review, and improvement actions.',
      weightage: 5,
    },
    {
      question: `How is "${subsectionName}" reviewed and improved over time?`,
      type: 'multiple_choice',
      hint: 'Select the option that best matches your current review cadence.',
      criteria: 'Higher score for more frequent, structured review with corrective action tracking.',
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

async function addQuestionsTo(client, sectionId, subsectionName) {
  const payload = {
    section_type: 'sub_section',
    questions: buildQuestionsFor(subsectionName),
  };
  const { data } = await client.post(`/sections/${sectionId}/questions`, payload);
  return (data?.data || []).length;
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('━━━ Hospitality Management Certificate Seeder ━━━');
  console.log(`Backend:        ${CONFIG.BASE_URL}`);
  console.log(`Certificate ID: ${CONFIG.CERTIFICATE_ID}`);

  if (CONFIG.CERTIFICATE_ID === '00000000-0000-0000-0000-000000000000') {
    throw new Error('Set CERTIFICATE_ID env var (or edit CONFIG) to the real certificate UUID.');
  }

  const token = await login();
  const client = makeClient(token);

  const mainIds = await createMainSections(client, CONFIG.CERTIFICATE_ID, HIERARCHY);

  console.log(`\n[3/4] Creating Level-2 sections...`);
  const sectionIdsByPath = new Map(); // "main/section" → id
  for (const main of HIERARCHY) {
    const mainId = mainIds.get(main.name);
    if (!mainId) {
      console.warn(`    ⚠ skipping "${main.name}" — no id returned`);
      continue;
    }
    const ids = await createChildren(
      client,
      mainId,
      'main',
      main.sections.map((s) => s.name),
    );
    for (const [name, id] of ids) {
      sectionIdsByPath.set(`${main.name}/${name}`, id);
    }
    console.log(`    ✓ ${main.name}: ${ids.size} section(s)`);
  }

  console.log(`\n[4/5] Creating Level-3 subsections...`);
  const subsectionIdByPath = new Map(); // "main/section/sub" → id
  for (const main of HIERARCHY) {
    for (const section of main.sections) {
      const sectionId = sectionIdsByPath.get(`${main.name}/${section.name}`);
      if (!sectionId) {
        console.warn(`    ⚠ skipping "${section.name}" — no id`);
        continue;
      }
      if (!section.subsections?.length) continue;
      const ids = await createChildren(client, sectionId, 'section', section.subsections);
      for (const [name, id] of ids) {
        subsectionIdByPath.set(`${main.name}/${section.name}/${name}`, id);
      }
      console.log(`    ✓ ${section.name}: ${ids.size} subsection(s)`);
    }
  }

  console.log(`\n[5/5] Adding questions to each subsection (3 per leaf, no file uploads)...`);
  let totalQuestions = 0;
  for (const main of HIERARCHY) {
    for (const section of main.sections) {
      for (const subName of section.subsections || []) {
        const subId = subsectionIdByPath.get(`${main.name}/${section.name}/${subName}`);
        if (!subId) continue;
        const added = await addQuestionsTo(client, subId, subName);
        totalQuestions += added;
        console.log(`    ✓ ${subName}: ${added} question(s)`);
      }
    }
  }

  console.log('\n━━━ DONE ━━━');
  console.log(`Main sections:   ${mainIds.size}`);
  console.log(`Sections (L2):   ${sectionIdsByPath.size}`);
  console.log(`Subsections (L3):${subsectionIdByPath.size}`);
  console.log(`Questions:       ${totalQuestions}`);
}

main().catch((err) => {
  if (err.response) {
    console.error('\n✗ FAILED');
    console.error('  status:', err.response.status);
    console.error('  url:   ', err.config?.url);
    console.error('  body:  ', JSON.stringify(err.response.data, null, 2));
  } else {
    console.error('\n✗ FAILED:', err.message);
  }
  process.exit(1);
});
