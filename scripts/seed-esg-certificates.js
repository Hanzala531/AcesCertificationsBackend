/**
 * seed-esg-certificates.js
 * ---------------------------------------------------------------------------
 * Seeds 5 realistic industries and 10 practical, assessment-ready certificates
 * (each with badge tiers + score ranges, sections/sub-sections, and a mix of
 * boolean / text / number / rating / multiple_choice / checkbox questions).
 *
 * NO document-upload (file/pdf) questions are created.
 *
 * Scoring model (matches score-calculation.service):
 *   - every question max = score (10)
 *   - boolean: yes_score=10, no_score=0  (so Yes/No actually moves the score)
 *   - non-boolean: full score when answered
 *   - badge assigned from final_percentage via badge_colors ranges
 *
 * Idempotent: re-running deletes the seeded certificates by code (cascade) and
 * re-creates them. Industries are upserted by name. Safe on a fresh DB.
 *
 *   npx ts-node --transpile-only scripts/seed-esg-certificates.js   # or:
 *   node scripts/seed-esg-certificates.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const Q_SCORE = 10;

// Badge tiers shared by every certificate (percentage ranges).
const BADGE_TIERS = [
  { label: 'Bronze', color: '#CD7F32', min: 40, max: 59 },
  { label: 'Silver', color: '#C0C0C0', min: 60, max: 79 },
  { label: 'Gold', color: '#FFD700', min: 80, max: 89 },
  { label: 'Emerald', color: '#00C853', min: 90, max: 100 },
];

const INDUSTRIES = [
  'Hospitality & Tourism',
  'Food & Beverage',
  'Manufacturing',
  'Healthcare',
  'Retail & E-commerce',
];

// Shorthand question builders
const b = (q, hint) => ({ q, type: 'boolean', hint });
const t = (q, hint) => ({ q, type: 'text', hint });
const n = (q, hint) => ({ q, type: 'number', hint });
const r = (q, hint) => ({ q, type: 'rating', hint });
const mc = (q, options, hint) => ({ q, type: 'multiple_choice', options, hint });
const cb = (q, options, hint) => ({ q, type: 'checkbox', options, hint });

const CERTIFICATES = [
  // ───────────────────────────── Hospitality & Tourism ─────────────────────
  {
    code: 'ACES-HOSP-001',
    name: 'Sustainable Hotel Operations',
    industry: 'Hospitality & Tourism',
    description:
      'Assesses a hotel or resort against sustainable operations practices covering energy, water, waste, and guest engagement.',
    disclosure_price: 120, assured_price: 450, validity_years: 1,
    mains: [
      { name: 'Resource Efficiency', sections: [
        { name: 'Energy Management', questions: [
          b('Does the property use energy-efficient lighting (LED) in guest and common areas?', 'Consider lobbies, corridors, and rooms'),
          b('Are HVAC systems serviced on a documented maintenance schedule?'),
          mc('What share of energy comes from renewable sources?', ['None', 'Under 25%', '25-50%', 'Over 50%']),
          n('How many kWh per occupied room-night did the property consume last year?', 'Approximate annual average'),
        ]},
        { name: 'Water & Waste', questions: [
          b('Is a linen and towel reuse program offered to guests?'),
          cb('Which water-saving measures are in place?', ['Low-flow taps', 'Dual-flush toilets', 'Rainwater harvesting', 'Greywater reuse', 'Pool covers']),
          r('Rate the maturity of your waste segregation program (1-5).', '1 = none, 5 = fully segregated & tracked'),
        ]},
      ]},
      { name: 'Guest & Community', sections: [
        { name: 'Responsible Engagement', questions: [
          b('Are guests informed about the property’s sustainability initiatives?'),
          t('Describe one community or local-sourcing initiative the property supports.'),
          mc('How often is staff trained on sustainability practices?', ['Never', 'Annually', 'Quarterly', 'Monthly']),
        ]},
      ]},
    ],
  },
  {
    code: 'ACES-HOSP-002',
    name: 'Responsible Tourism & Guest Safety',
    industry: 'Hospitality & Tourism',
    description:
      'Evaluates guest safety, accessibility, and responsible tourism practices for accommodation and tour operators.',
    disclosure_price: 100, assured_price: 400, validity_years: 1,
    mains: [
      { name: 'Guest Safety', sections: [
        { name: 'Health & Emergency', questions: [
          b('Is there a documented emergency response and evacuation plan?'),
          b('Are first-aid trained staff available on every shift?'),
          n('How many emergency drills were conducted in the past 12 months?'),
          r('Rate the visibility and clarity of safety signage on site (1-5).'),
        ]},
        { name: 'Accessibility', questions: [
          b('Are accessible rooms/facilities available for guests with disabilities?'),
          cb('Which accessibility features are provided?', ['Step-free access', 'Accessible bathrooms', 'Braille signage', 'Hearing-loop systems', 'Reserved parking']),
        ]},
      ]},
      { name: 'Responsible Tourism', sections: [
        { name: 'Local Impact', questions: [
          b('Do you prioritise hiring from the local community?'),
          mc('What proportion of suppliers are local (within the region)?', ['Under 25%', '25-50%', '50-75%', 'Over 75%']),
          t('Describe how you minimise the environmental impact of guest activities/excursions.'),
        ]},
      ]},
    ],
  },

  // ───────────────────────────── Food & Beverage ───────────────────────────
  {
    code: 'ACES-FNB-001',
    name: 'Food Safety & Hygiene Management',
    industry: 'Food & Beverage',
    description:
      'A practical food safety and hygiene assessment for restaurants, caterers, and food producers based on HACCP principles.',
    disclosure_price: 130, assured_price: 500, validity_years: 1,
    mains: [
      { name: 'Hygiene Controls', sections: [
        { name: 'Personal & Kitchen Hygiene', questions: [
          b('Do all food handlers complete documented food-hygiene training?'),
          b('Are handwashing stations stocked and accessible in all prep areas?'),
          mc('How frequently are deep-cleaning schedules carried out?', ['Ad-hoc', 'Monthly', 'Weekly', 'Daily']),
          r('Rate the overall cleanliness standard of food-contact surfaces (1-5).'),
        ]},
        { name: 'Temperature & Storage', questions: [
          b('Are cold-chain temperatures logged at least twice daily?'),
          n('At what temperature (°C) is the main chiller maintained?', 'Target is typically 0-5°C'),
          cb('Which storage controls are in place?', ['FIFO stock rotation', 'Allergen separation', 'Labelled use-by dates', 'Raw/cooked separation', 'Pest control']),
        ]},
      ]},
      { name: 'HACCP & Traceability', sections: [
        { name: 'Hazard Management', questions: [
          b('Is a documented HACCP plan in place and reviewed annually?'),
          b('Can every ingredient be traced to its supplier?'),
          t('Describe how you manage a food-safety incident or product recall.'),
        ]},
      ]},
    ],
  },
  {
    code: 'ACES-FNB-002',
    name: 'Sustainable Sourcing & Packaging',
    industry: 'Food & Beverage',
    description:
      'Assesses responsible sourcing, packaging, and food-waste reduction for food and beverage businesses.',
    disclosure_price: 110, assured_price: 420, validity_years: 1,
    mains: [
      { name: 'Sourcing', sections: [
        { name: 'Responsible Procurement', questions: [
          b('Do you maintain a documented responsible-sourcing policy?'),
          mc('What share of key ingredients is certified (e.g. Fairtrade, RSPO, MSC)?', ['None', 'Under 25%', '25-50%', 'Over 50%']),
          b('Do you audit suppliers for ethical and environmental practices?'),
          t('Name one ingredient you have switched to a more sustainable alternative.'),
        ]},
      ]},
      { name: 'Packaging & Waste', sections: [
        { name: 'Materials', questions: [
          cb('Which packaging improvements have you implemented?', ['Recyclable materials', 'Compostable materials', 'Reduced packaging', 'Reusable containers', 'Recycled content']),
          r('Rate the maturity of your food-waste reduction program (1-5).'),
          n('By what percentage have you reduced single-use plastics in the last year?'),
        ]},
      ]},
    ],
  },

  // ───────────────────────────── Manufacturing ─────────────────────────────
  {
    code: 'ACES-MFG-001',
    name: 'Workplace Health & Safety (Manufacturing)',
    industry: 'Manufacturing',
    description:
      'Evaluates occupational health and safety management on the factory floor, including PPE, machine safety, and incident handling.',
    disclosure_price: 140, assured_price: 550, validity_years: 1,
    mains: [
      { name: 'Operational Safety', sections: [
        { name: 'Machine & Process Safety', questions: [
          b('Are machine guards and lockout/tagout procedures in place and enforced?'),
          b('Are risk assessments completed for all high-risk tasks?'),
          mc('How often are workplace safety inspections conducted?', ['Annually', 'Quarterly', 'Monthly', 'Weekly']),
          n('How many lost-time injuries occurred in the last 12 months?'),
        ]},
        { name: 'PPE & Training', questions: [
          b('Is appropriate PPE provided free of charge to all workers?'),
          cb('Which PPE categories are issued?', ['Eye protection', 'Hearing protection', 'Respiratory protection', 'Hand protection', 'Foot protection']),
          r('Rate the effectiveness of your safety induction for new workers (1-5).'),
        ]},
      ]},
      { name: 'Incident Management', sections: [
        { name: 'Reporting & Response', questions: [
          b('Is there a no-blame incident and near-miss reporting system?'),
          t('Describe your process for investigating and closing out incidents.'),
        ]},
      ]},
    ],
  },
  {
    code: 'ACES-MFG-002',
    name: 'Environmental Management & Emissions',
    industry: 'Manufacturing',
    description:
      'Assesses environmental management, emissions, and resource efficiency for manufacturing operations.',
    disclosure_price: 150, assured_price: 600, validity_years: 1,
    mains: [
      { name: 'Emissions & Energy', sections: [
        { name: 'Carbon & Energy', questions: [
          b('Do you measure and report your greenhouse-gas emissions?'),
          mc('Which emission scopes do you track?', ['None', 'Scope 1 only', 'Scope 1 & 2', 'Scope 1, 2 & 3']),
          n('What was your total energy consumption (MWh) last year?'),
          b('Have you set a documented emissions-reduction target?'),
        ]},
      ]},
      { name: 'Resource Stewardship', sections: [
        { name: 'Water, Waste & Materials', questions: [
          cb('Which environmental controls are in place?', ['Wastewater treatment', 'Hazardous-waste handling', 'Material recycling', 'Air-emission controls', 'Spill containment']),
          r('Rate the maturity of your environmental management system (1-5).', 'e.g. ISO 14001 alignment'),
          t('Describe one initiative that reduced your environmental footprint.'),
        ]},
      ]},
    ],
  },

  // ───────────────────────────── Healthcare ────────────────────────────────
  {
    code: 'ACES-HLTH-001',
    name: 'Patient Safety & Care Quality',
    industry: 'Healthcare',
    description:
      'Assesses patient-safety culture, clinical governance, and care-quality practices for clinics and healthcare facilities.',
    disclosure_price: 160, assured_price: 650, validity_years: 1,
    mains: [
      { name: 'Patient Safety', sections: [
        { name: 'Clinical Governance', questions: [
          b('Is there a documented patient-safety and incident-reporting policy?'),
          b('Are clinical protocols reviewed and updated regularly?'),
          mc('How often are patient-safety audits conducted?', ['Annually', 'Quarterly', 'Monthly', 'Continuously']),
          r('Rate the strength of your patient-safety culture (1-5).'),
        ]},
        { name: 'Medication Safety', questions: [
          b('Are medication administration records double-checked for high-risk drugs?'),
          n('How many medication-related incidents were reported last year?'),
        ]},
      ]},
      { name: 'Care Quality', sections: [
        { name: 'Patient Experience', questions: [
          b('Do you collect and act on patient feedback?'),
          cb('Which quality measures do you track?', ['Wait times', 'Readmission rates', 'Patient satisfaction', 'Infection rates', 'Complaint resolution']),
          t('Describe one improvement made as a result of patient feedback.'),
        ]},
      ]},
    ],
  },
  {
    code: 'ACES-HLTH-002',
    name: 'Medical Waste & Infection Control',
    industry: 'Healthcare',
    description:
      'Evaluates infection prevention, hygiene, and safe handling and disposal of medical waste.',
    disclosure_price: 140, assured_price: 560, validity_years: 1,
    mains: [
      { name: 'Infection Control', sections: [
        { name: 'Prevention Practices', questions: [
          b('Is there a documented infection-prevention and control program?'),
          b('Are hand-hygiene compliance audits performed?'),
          mc('How frequently are high-touch surfaces disinfected?', ['Daily', 'Several times daily', 'Hourly', 'After each patient']),
          r('Rate staff adherence to PPE and isolation protocols (1-5).'),
        ]},
      ]},
      { name: 'Waste Handling', sections: [
        { name: 'Segregation & Disposal', questions: [
          b('Is clinical waste segregated at the point of generation?'),
          cb('Which waste streams are separately managed?', ['Sharps', 'Infectious waste', 'Pharmaceutical waste', 'General waste', 'Chemical waste']),
          b('Is medical waste disposed of through a licensed contractor?'),
          n('How many waste-handling incidents occurred in the last year?'),
        ]},
      ]},
    ],
  },

  // ───────────────────────────── Retail & E-commerce ───────────────────────
  {
    code: 'ACES-RET-001',
    name: 'Ethical Labor & Supply Chain',
    industry: 'Retail & E-commerce',
    description:
      'Assesses labor practices, supplier ethics, and supply-chain transparency for retailers and e-commerce businesses.',
    disclosure_price: 120, assured_price: 480, validity_years: 1,
    mains: [
      { name: 'Labor Practices', sections: [
        { name: 'Fair Employment', questions: [
          b('Do you pay all workers at or above the legal minimum wage?'),
          b('Is there a policy prohibiting child and forced labor?'),
          r('Rate the maturity of your diversity and inclusion practices (1-5).'),
          mc('How are worker grievances handled?', ['No formal process', 'Informal', 'Documented process', 'Independent channel']),
        ]},
      ]},
      { name: 'Supply Chain', sections: [
        { name: 'Supplier Oversight', questions: [
          b('Do suppliers sign a code of conduct covering labor and ethics?'),
          b('Do you conduct supplier audits?'),
          cb('Which supply-chain risks do you actively monitor?', ['Labor rights', 'Environmental impact', 'Anti-corruption', 'Conflict minerals', 'Animal welfare']),
          t('Describe how you ensure transparency in your supply chain.'),
        ]},
      ]},
    ],
  },
  {
    code: 'ACES-RET-002',
    name: 'Data Privacy & Consumer Protection',
    industry: 'Retail & E-commerce',
    description:
      'Evaluates data-protection, privacy, and fair consumer practices for online and offline retail businesses.',
    disclosure_price: 130, assured_price: 520, validity_years: 1,
    mains: [
      { name: 'Data Protection', sections: [
        { name: 'Privacy Governance', questions: [
          b('Do you have a published privacy policy explaining data use?'),
          b('Is customer data encrypted in transit and at rest?'),
          mc('How do you obtain consent for marketing communications?', ['Pre-ticked opt-in', 'No consent', 'Explicit opt-in', 'Double opt-in']),
          n('How many data-breach incidents occurred in the last 12 months?'),
        ]},
        { name: 'Access & Rights', questions: [
          b('Can customers request access to, or deletion of, their data?'),
          r('Rate the maturity of your data-protection controls (1-5).'),
        ]},
      ]},
      { name: 'Consumer Protection', sections: [
        { name: 'Fair Practices', questions: [
          b('Are pricing, fees, and return policies clearly disclosed before purchase?'),
          cb('Which consumer protections do you provide?', ['Transparent pricing', 'Clear returns policy', 'Secure payments', 'Accessible support', 'Honest advertising']),
          t('Describe how you handle and resolve customer complaints.'),
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
    throw new Error(`Document-upload question type "${q.type}" is not allowed by this seed`);
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

// Replicates the app's recalculateHierarchicalShortCodes so seeded certificates
// get the SAME hierarchical codes a UI-created certificate would:
//   certificate.short_code = base                       (e.g. HOSP1)
//   main_section            = base || rank               (HOSP11)
//   section                 = main || '.' || rank        (HOSP11.1)
//   sub_section             = section || '.' || rank      (HOSP11.1.1)
//   question (level 2)      = section || '.0.' || number  (HOSP11.1.0.1)
//   question (level 3)      = section || '.' || subRank || '.' || number
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
  // Unique base short code derived from the cert code: ACES-HOSP-001 -> HOSP1
  const parts = cert.code.split('-');
  const baseShortCode = `${parts[1]}${parseInt(parts[2], 10)}`;

  // Non-destructive idempotency: if the certificate already exists (it may now
  // have assessments and cannot be safely deleted), just set its base short code
  // and (re)generate the hierarchical codes from its existing structure.
  const existing = await client.query(
    `SELECT id FROM certificates WHERE certificate_id = $1`,
    [cert.code],
  );
  if (existing.rows[0]) {
    const existingId = existing.rows[0].id;
    await client.query(
      `UPDATE certificates SET short_code = $2, updated_at = NOW() WHERE id = $1`,
      [existingId, baseShortCode],
    );
    await applyShortCodes(client, existingId);
    const qc = await client.query(
      `SELECT count(*)::int AS n FROM questions WHERE certificate_id = $1`,
      [existingId],
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

  // Badge + tier ranges
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

  // Structure + questions
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

  // Generate hierarchical short codes for the whole certificate tree.
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
      summary.push({ code: cert.code, name: cert.name, industry: cert.industry, questions: qCount });
    }

    await client.query('COMMIT');

    console.log(`\n✓ Seeded ${INDUSTRIES.length} industries:`);
    INDUSTRIES.forEach((i) => console.log(`    - ${i}`));
    console.log(`\n✓ Seeded ${summary.length} certificates (admin owner: ${adminId || 'none'}):`);
    let total = 0;
    for (const s of summary) {
      total += s.questions;
      console.log(`    ${s.code.padEnd(15)} ${s.name}  [${s.industry}] — ${s.questions} questions`);
    }
    console.log(`\n  Total questions: ${total}`);
    console.log('  Each certificate has a Bronze/Silver/Gold/Emerald badge (40/60/80/90 thresholds).');
    console.log('  No document-upload questions were created.\n');
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
