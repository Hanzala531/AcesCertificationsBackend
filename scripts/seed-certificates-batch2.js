/**
 * seed-certificates-batch2.js
 * ---------------------------------------------------------------------------
 * A SECOND batch of realistic, assessment-ready certificates across new
 * industries (IT/Software, Construction, Education, Finance, Logistics) — fully
 * distinct from the ESG batch. Each gets badge tiers, sections/sub-sections,
 * mixed question types (NO document-upload), and proper hierarchical short codes
 * identical to UI-created certificates.
 *
 * Non-destructive & idempotent: existing certs (by code) are updated in place
 * (short codes regenerated); new ones are created fully. Safe to re-run.
 *
 *   node scripts/seed-certificates-batch2.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const Q_SCORE = 10;

const BADGE_TIERS = [
  { label: 'Bronze', color: '#CD7F32', min: 40, max: 59 },
  { label: 'Silver', color: '#C0C0C0', min: 60, max: 79 },
  { label: 'Gold', color: '#FFD700', min: 80, max: 89 },
  { label: 'Emerald', color: '#00C853', min: 90, max: 100 },
];

const INDUSTRIES = [
  'Information Technology & Software',
  'Construction & Real Estate',
  'Education & Training',
  'Financial Services',
  'Logistics & Transportation',
];

const b = (q, hint) => ({ q, type: 'boolean', hint });
const t = (q, hint) => ({ q, type: 'text', hint });
const n = (q, hint) => ({ q, type: 'number', hint });
const r = (q, hint) => ({ q, type: 'rating', hint });
const mc = (q, options, hint) => ({ q, type: 'multiple_choice', options, hint });
const cb = (q, options, hint) => ({ q, type: 'checkbox', options, hint });

const CERTIFICATES = [
  // ───────────────────────── Information Technology & Software ──────────────
  {
    code: 'ACES-ISEC-001',
    name: 'Information Security Management',
    industry: 'Information Technology & Software',
    description:
      'Assesses an organization’s information security governance, access control, and incident readiness against ACES security standards.',
    disclosure_price: 180, assured_price: 700, validity_years: 1,
    mains: [
      { name: 'Governance & Risk', sections: [
        { name: 'Security Policy', questions: [
          b('Is there a documented information-security policy approved by management?'),
          b('Are information-security risk assessments performed at least annually?'),
          mc('How often is the security policy formally reviewed?', ['Never', 'Annually', 'Semi-annually', 'Quarterly']),
          r('Rate the maturity of your risk-management process (1-5).'),
        ]},
        { name: 'Access Control', questions: [
          b('Is role-based access control enforced across systems?'),
          b('Is multi-factor authentication required for privileged/admin accounts?'),
          cb('Which access controls are in place?', ['Least privilege', 'Periodic access reviews', 'MFA', 'Single sign-on', 'Session timeouts']),
        ], subs: [
          { name: 'Privileged Access', questions: [
            b('Are privileged account activities logged and monitored?'),
            n('How many privileged/admin accounts currently exist?'),
          ]},
        ]},
      ]},
      { name: 'Operations', sections: [
        { name: 'Incident & Continuity', questions: [
          b('Is there a documented incident-response plan?'),
          n('How many security incidents were recorded in the last 12 months?'),
          b('Are backups regularly tested for restorability?'),
          t('Describe your patch-management process for critical systems.'),
        ]},
      ]},
    ],
  },
  {
    code: 'ACES-SDQ-001',
    name: 'Software Development Quality',
    industry: 'Information Technology & Software',
    description:
      'Evaluates engineering practices, testing, and secure development across the software delivery lifecycle.',
    disclosure_price: 150, assured_price: 580, validity_years: 1,
    mains: [
      { name: 'Development Practices', sections: [
        { name: 'Code Quality', questions: [
          b('Are code reviews mandatory before changes are merged?'),
          b('Are automated tests executed in your CI pipeline?'),
          mc('What is your approximate automated test coverage?', ['None', 'Under 50%', '50-80%', 'Over 80%']),
          r('Rate the maturity of your CI/CD pipeline (1-5).'),
        ]},
        { name: 'Release Management', questions: [
          b('Are all changes tracked in version control?'),
          cb('Which delivery practices do you use?', ['Branch protection', 'Automated builds', 'Staging environment', 'Rollback plan', 'Feature flags']),
        ]},
      ]},
      { name: 'Security & Compliance', sections: [
        { name: 'Secure Development', questions: [
          b('Are third-party dependencies scanned for known vulnerabilities?'),
          b('Are secrets and credentials kept out of source code?'),
          t('Describe how you triage and remediate security vulnerabilities.'),
        ]},
      ]},
    ],
  },

  // ───────────────────────── Construction & Real Estate ────────────────────
  {
    code: 'ACES-CSS-001',
    name: 'Construction Site Safety',
    industry: 'Construction & Real Estate',
    description:
      'A practical site-safety assessment covering hazard management, work at height, and workforce welfare on construction sites.',
    disclosure_price: 160, assured_price: 620, validity_years: 1,
    mains: [
      { name: 'Site Safety', sections: [
        { name: 'Hazard Management', questions: [
          b('Are site-specific risk assessments completed before work begins?'),
          b('Is PPE provided and its use enforced on site?'),
          mc('How often are toolbox-talk safety briefings held?', ['Never', 'Monthly', 'Weekly', 'Daily']),
          n('How many reportable incidents occurred in the last 12 months?'),
        ]},
        { name: 'Equipment & Work at Height', questions: [
          b('Is scaffolding inspected by a competent person before use?'),
          cb('Which controls are in place?', ['Edge protection', 'Harnesses', 'Exclusion zones', 'Equipment inspections', 'Permit-to-work']),
          r('Rate the standard of site housekeeping (1-5).'),
        ]},
      ]},
      { name: 'Workforce', sections: [
        { name: 'Training & Welfare', questions: [
          b('Are workers inducted before starting on site?'),
          b('Are adequate welfare facilities provided?'),
          t('Describe your site emergency-response procedure.'),
        ]},
      ]},
    ],
  },
  {
    code: 'ACES-GBE-001',
    name: 'Green Building & Energy Efficiency',
    industry: 'Construction & Real Estate',
    description:
      'Assesses energy performance, resource efficiency, and occupant wellbeing for buildings and developments.',
    disclosure_price: 150, assured_price: 600, validity_years: 1,
    mains: [
      { name: 'Energy & Resources', sections: [
        { name: 'Energy Performance', questions: [
          b('Is building energy performance monitored and reported?'),
          mc('What share of energy comes from renewable sources?', ['None', 'Under 25%', '25-50%', 'Over 50%']),
          n('What is the building energy-use intensity (kWh/m²/year)?'),
          r('Rate the maturity of your energy-management system (1-5).'),
        ]},
        { name: 'Water & Materials', questions: [
          cb('Which sustainable features are in place?', ['Low-flow fixtures', 'Rainwater harvesting', 'Recycled materials', 'Green roof', 'EV charging']),
          b('Is construction/operational waste diverted from landfill?'),
        ]},
      ]},
      { name: 'Indoor Environment', sections: [
        { name: 'Occupant Wellbeing', questions: [
          b('Is indoor air quality monitored?'),
          r('Rate the provision of natural daylight (1-5).'),
          t('Describe one initiative that improved occupant comfort.'),
        ]},
      ]},
    ],
  },

  // ───────────────────────── Education & Training ──────────────────────────
  {
    code: 'ACES-EQS-001',
    name: 'Education Quality & Safeguarding',
    industry: 'Education & Training',
    description:
      'Evaluates safeguarding, health & safety, and education-quality practices for schools and training providers.',
    disclosure_price: 130, assured_price: 520, validity_years: 1,
    mains: [
      { name: 'Safeguarding', sections: [
        { name: 'Child Protection', questions: [
          b('Is there a documented safeguarding/child-protection policy?'),
          b('Are staff background-checked before being hired?'),
          mc('How often is safeguarding training delivered?', ['Never', 'Annually', 'Each term', 'Monthly']),
          n('How many safeguarding concerns were reported last year?'),
        ]},
        { name: 'Health & Safety', questions: [
          b('Are emergency drills conducted regularly?'),
          cb('Which safety measures are in place?', ['First-aid trained staff', 'Secure entry', 'CCTV', 'Visitor sign-in', 'Risk assessments']),
        ]},
      ]},
      { name: 'Education Quality', sections: [
        { name: 'Teaching & Outcomes', questions: [
          b('Is the curriculum reviewed and updated regularly?'),
          r('Rate the maturity of your student-feedback process (1-5).'),
          t('Describe how you measure and improve learning outcomes.'),
        ]},
      ]},
    ],
  },

  // ───────────────────────── Financial Services ────────────────────────────
  {
    code: 'ACES-AML-001',
    name: 'Anti-Money Laundering & KYC',
    industry: 'Financial Services',
    description:
      'Assesses customer due diligence, transaction monitoring, and AML governance for financial institutions.',
    disclosure_price: 200, assured_price: 800, validity_years: 1,
    mains: [
      { name: 'Customer Due Diligence', sections: [
        { name: 'Know Your Customer', questions: [
          b('Are documented KYC/CDD procedures in place?'),
          b('Is customer identity verified for all new accounts?'),
          mc('How often is customer risk reassessed?', ['Never', 'At onboarding only', 'Annually', 'Continuously']),
          r('Rate the maturity of your AML control framework (1-5).'),
        ]},
        { name: 'Transaction Monitoring', questions: [
          b('Are transactions monitored for suspicious activity?'),
          cb('Which controls are in place?', ['Sanctions screening', 'PEP checks', 'Transaction limits', 'SAR filing', 'Audit trail']),
          n('How many suspicious-activity reports were filed last year?'),
        ]},
      ]},
      { name: 'Governance', sections: [
        { name: 'Oversight', questions: [
          b('Is a designated AML/compliance officer appointed?'),
          b('Do relevant staff receive AML training?'),
          t('Describe your process for escalating and reporting suspicious transactions.'),
        ]},
      ]},
    ],
  },

  // ───────────────────────── Logistics & Transportation ────────────────────
  {
    code: 'ACES-FSC-001',
    name: 'Fleet Safety & Compliance',
    industry: 'Logistics & Transportation',
    description:
      'Evaluates vehicle maintenance, driver management, and regulatory compliance for transport and delivery fleets.',
    disclosure_price: 140, assured_price: 560, validity_years: 1,
    mains: [
      { name: 'Vehicle & Driver Safety', sections: [
        { name: 'Vehicle Maintenance', questions: [
          b('Are vehicles inspected on a documented schedule?'),
          n('How many vehicles are in the fleet?'),
          mc('How often are vehicles serviced?', ['Ad-hoc', 'Annually', 'Quarterly', 'Per mileage schedule']),
          r('Rate the quality of your maintenance record-keeping (1-5).'),
        ]},
        { name: 'Driver Management', questions: [
          b('Are driver licences and records checked regularly?'),
          cb('Which driver controls are in place?', ['Fatigue management', 'Telematics', 'Defensive-driving training', 'Drug/alcohol policy', 'Journey planning']),
          n('How many road incidents occurred in the last 12 months?'),
        ]},
      ]},
      { name: 'Compliance', sections: [
        { name: 'Regulatory', questions: [
          b('Are hours-of-service / tachograph rules complied with?'),
          t('Describe how you handle vehicle defects reported by drivers.'),
        ]},
      ]},
    ],
  },
  {
    code: 'ACES-WHS-001',
    name: 'Warehouse Health & Safety',
    industry: 'Logistics & Transportation',
    description:
      'Assesses material-handling safety, fire readiness, and workforce training in warehousing and distribution centres.',
    disclosure_price: 130, assured_price: 520, validity_years: 1,
    mains: [
      { name: 'Operational Safety', sections: [
        { name: 'Material Handling', questions: [
          b('Are forklift operators trained and certified?'),
          b('Is storage racking inspected by a competent person?'),
          mc('How often are safety inspections carried out?', ['Annually', 'Quarterly', 'Monthly', 'Weekly']),
          n('How many lost-time injuries occurred in the last 12 months?'),
        ]},
        { name: 'Fire & Emergency', questions: [
          cb('Which fire-safety measures are in place?', ['Extinguishers', 'Sprinklers', 'Marked exits', 'Alarms', 'Evacuation drills']),
          b('Are evacuation routes kept clear and clearly marked?'),
          r('Rate the standard of warehouse housekeeping (1-5).'),
        ]},
      ]},
      { name: 'Workforce', sections: [
        { name: 'Training', questions: [
          b('Is manual-handling training provided to staff?'),
          t('Describe your near-miss reporting and follow-up process.'),
        ]},
      ]},
    ],
  },
];

async function upsertIndustry(client, name, adminId) {
  const res = await client.query(
    `INSERT INTO industry (name, created_by, updated_by)
     VALUES ($1, $2, $2)
     ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [name, adminId],
  );
  return res.rows[0].id;
}

async function insertQuestion(client, certId, msId, sId, ssId, q, rank, number, certNo) {
  if (q.type === 'file' || q.type === 'pdf') {
    throw new Error(`Document-upload question type "${q.type}" is not allowed`);
  }
  const isThird = !!ssId;
  const isBoolean = q.type === 'boolean';
  await client.query(
    `INSERT INTO questions (
       certificate_id, main_section_id, section_id, sub_section_id,
       question, type, is_third_level, rank, question_number, certificate_question_number,
       hint, options, score, yes_score, no_score, is_compulsory
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16)`,
    [
      certId, msId, sId, ssId,
      q.q, q.type, isThird, rank, number, certNo,
      q.hint || null,
      q.options ? JSON.stringify(q.options) : null,
      Q_SCORE,
      isBoolean ? Q_SCORE : null,
      isBoolean ? 0 : null,
      false,
    ],
  );
}

// Mirrors the app's recalculateHierarchicalShortCodes.
async function applyShortCodes(client, certId) {
  await client.query(
    `UPDATE main_section ms SET short_code = c.short_code || ms.rank::text
       FROM certificates c
      WHERE ms.certificate_id = c.id AND ms.certificate_id = $1
        AND c.short_code IS NOT NULL AND ms.rank IS NOT NULL`, [certId]);
  await client.query(
    `UPDATE sections s SET short_code = ms.short_code || '.' || s.rank::text
       FROM main_section ms
      WHERE s.main_id = ms.id AND s.certificate_id = $1
        AND ms.short_code IS NOT NULL AND s.rank IS NOT NULL`, [certId]);
  await client.query(
    `UPDATE sub_section ss SET short_code = s.short_code || '.' || ss.rank::text
       FROM sections s
      WHERE ss.section_id = s.id AND ss.certificate_id = $1
        AND s.short_code IS NOT NULL AND ss.rank IS NOT NULL`, [certId]);
  await client.query(
    `UPDATE questions q SET short_code = s.short_code || '.0.' || q.question_number::text
       FROM sections s
      WHERE q.section_id = s.id AND q.certificate_id = $1
        AND q.is_third_level = FALSE AND q.parent_question_id IS NULL
        AND s.short_code IS NOT NULL AND q.question_number IS NOT NULL`, [certId]);
  await client.query(
    `UPDATE questions q SET short_code = s.short_code || '.' || ss.rank::text || '.' || q.question_number::text
       FROM sub_section ss JOIN sections s ON s.id = ss.section_id
      WHERE q.sub_section_id = ss.id AND q.certificate_id = $1
        AND q.is_third_level = TRUE AND q.parent_question_id IS NULL
        AND s.short_code IS NOT NULL AND ss.rank IS NOT NULL AND q.question_number IS NOT NULL`, [certId]);
}

async function seedCertificate(client, cert, industryId, adminId) {
  const parts = cert.code.split('-');
  const baseShortCode = `${parts[1]}${parseInt(parts[2], 10)}`;

  const existing = await client.query(
    `SELECT id FROM certificates WHERE certificate_id = $1`, [cert.code],
  );
  if (existing.rows[0]) {
    const existingId = existing.rows[0].id;
    await client.query(
      `UPDATE certificates SET short_code = $2, updated_at = NOW() WHERE id = $1`,
      [existingId, baseShortCode],
    );
    await applyShortCodes(client, existingId);
    const qc = await client.query(
      `SELECT count(*)::int AS n FROM questions WHERE certificate_id = $1`, [existingId],
    );
    return { certId: existingId, qCount: qc.rows[0].n };
  }

  const certRes = await client.query(
    `INSERT INTO certificates (
       certificate_id, short_code, name, description, industry_ids,
       disclosure_price, assured_price, validity_years, is_published, created_by, updated_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9,$9)
     RETURNING id`,
    [
      cert.code, baseShortCode, cert.name, cert.description, [industryId],
      cert.disclosure_price, cert.assured_price, cert.validity_years || 1, adminId,
    ],
  );
  const certId = certRes.rows[0].id;

  const badgeRes = await client.query(
    `INSERT INTO badges (certificate_id, name, color, slot) VALUES ($1, $2, $3, 1) RETURNING id`,
    [certId, 'ACES ESG Rating', BADGE_TIERS[BADGE_TIERS.length - 1].color],
  );
  const badgeId = badgeRes.rows[0].id;
  for (const tier of BADGE_TIERS) {
    await client.query(
      `INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1,$2,$3,$4)`,
      [badgeId, tier.color, tier.min, tier.max],
    );
  }

  let certNo = 0;
  let mRank = 0;
  let qCount = 0;
  for (const main of cert.mains) {
    mRank++;
    const msId = (await client.query(
      `INSERT INTO main_section (certificate_id, name, rank) VALUES ($1,$2,$3) RETURNING id`,
      [certId, main.name, mRank],
    )).rows[0].id;

    let sRank = 0;
    for (const sec of main.sections) {
      sRank++;
      const sId = (await client.query(
        `INSERT INTO sections (certificate_id, main_id, name, rank) VALUES ($1,$2,$3,$4) RETURNING id`,
        [certId, msId, sec.name, sRank],
      )).rows[0].id;

      let qRank = 0;
      for (const q of sec.questions || []) {
        qRank++; certNo++; qCount++;
        await insertQuestion(client, certId, msId, sId, null, q, qRank, qRank, certNo);
      }

      let ssRank = 0;
      for (const sub of sec.subs || []) {
        ssRank++;
        const ssId = (await client.query(
          `INSERT INTO sub_section (certificate_id, main_id, section_id, name, rank) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [certId, msId, sId, sub.name, ssRank],
        )).rows[0].id;
        let sqRank = 0;
        for (const q of sub.questions || []) {
          sqRank++; certNo++; qCount++;
          await insertQuestion(client, certId, msId, sId, ssId, q, sqRank, sqRank, certNo);
        }
      }
    }
  }

  await applyShortCodes(client, certId);
  return { certId, qCount };
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const adminRes = await client.query(
      `SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`,
    );
    const adminId = adminRes.rows[0] ? adminRes.rows[0].id : null;

    const industryIds = {};
    for (const name of INDUSTRIES) {
      industryIds[name] = await upsertIndustry(client, name, adminId);
    }

    const summary = [];
    for (const cert of CERTIFICATES) {
      const industryId = industryIds[cert.industry];
      if (!industryId) throw new Error(`Unknown industry "${cert.industry}" for ${cert.code}`);
      const { qCount } = await seedCertificate(client, cert, industryId, adminId);
      const base = `${cert.code.split('-')[1]}${parseInt(cert.code.split('-')[2], 10)}`;
      summary.push({ code: cert.code, name: cert.name, industry: cert.industry, base, questions: qCount });
    }

    await client.query('COMMIT');

    console.log(`\n✓ Industries ensured: ${INDUSTRIES.length}`);
    console.log(`✓ Certificates seeded: ${summary.length}`);
    let total = 0;
    for (const s of summary) {
      total += s.questions;
      console.log(`    ${s.code.padEnd(15)} [${s.base.padEnd(6)}] ${s.name}  (${s.industry}) — ${s.questions} q`);
    }
    console.log(`\n  Total questions: ${total}`);
    console.log('  Bronze/Silver/Gold/Emerald badges + full hierarchical short codes. No document-upload questions.\n');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  const detail =
    e && (e.code === 'ETIMEDOUT' || e.code === 'ENETUNREACH')
      ? 'cannot reach the database host. Run from an environment that can connect to DATABASE_URL.'
      : (e && e.message) || String(e);
  console.error('SEED FAILED:', detail);
  process.exit(1);
});
