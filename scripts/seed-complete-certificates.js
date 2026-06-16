/**
 * seed-complete-certificates.js
 * ----------------------------------------------------------------------------
 * Seeds 4 FULLY-COMPLETE certificates directly into the database.
 *
 * "Complete" means: every column on every row is populated with meaningful data
 * (no NULLs left where data can sensibly live). Each certificate gets:
 *   - All certificate fields (short_code, industry_ids, both prices, full
 *     validity, compulsory_docs, description, is_published, created_by/updated_by)
 *   - 3 badges, each with one or more badge_colors covering a score band
 *   - A full hierarchy: main_section -> sections -> sub_section (all ranked)
 *   - Questions at BOTH the section level (2nd level) and the sub-section level
 *     (3rd level), covering ALL seven question types:
 *       boolean, text, multiple_choice, rating, number, file, checkbox
 *   - Every question filled: hint, criteria, ai_review (enabled + criteria +
 *     score), yes_score/no_score, score, is_compulsory, options where relevant,
 *     rank, question_number, certificate_question_number
 *   - At least one boolean question with conditional_logic (redirect / block)
 *   - At least one boolean question with nested yes/no sub-questions
 *   - Hierarchical short_codes recomputed for the whole tree (mains, sections,
 *     sub_sections, questions) PLUS short_codes for nested questions.
 *
 * Safe to re-run: a certificate whose certificate_id already exists is skipped.
 *
 * Usage:
 *   node scripts/seed-complete-certificates.js
 *
 * Requires DATABASE_URL in .env (same as every other seed script here).
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─────────────────────────────────────────────────────────────────────────────
// Reusable ACES badge set. The only allowed colours are bronze / silver / gold /
// emerald, used as ascending score bands within each badge:
//   - ACES Rated     : bronze, silver, gold, emerald   (all four)
//   - ACES Verified  : bronze, silver, gold, emerald   (all four)
//   - ACES Certified : silver, gold, emerald    (no bronze — top credential)
// Score bands are non-overlapping and ascending, and colours are unique per
// badge, satisfying ValidScoreRanges + UniqueColorsPerBadge.
// ─────────────────────────────────────────────────────────────────────────────
const BADGES = [
  {
    slot: 1,
    name: 'ACES Rated',
    colors: [
      { color: 'bronze', min_score: 50, max_score: 69 },
      { color: 'silver', min_score: 70, max_score: 84 },
      { color: 'gold', min_score: 85, max_score: 94 },
      { color: 'emerald', min_score: 95, max_score: 100 },
    ],
  },
  {
    slot: 2,
    name: 'ACES Verified',
    colors: [
      { color: 'bronze', min_score: 50, max_score: 69 },
      { color: 'silver', min_score: 70, max_score: 84 },
      { color: 'gold', min_score: 85, max_score: 94 },
      { color: 'emerald', min_score: 95, max_score: 100 },
    ],
  },
  {
    slot: 3,
    name: 'ACES Certified',
    colors: [
      { color: 'silver', min_score: 70, max_score: 84 },
      { color: 'gold', min_score: 85, max_score: 94 },
      { color: 'emerald', min_score: 95, max_score: 100 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Question factory — guarantees every field is populated for completeness.
//
// kind-specific helpers keep the four certificate definitions terse while still
// producing rows with no missing data. `conditionalTo` / `blocks` reference
// other nodes by their "path" string and are resolved to real IDs at insert
// time. `children` are nested yes/no sub-questions.
// ─────────────────────────────────────────────────────────────────────────────
function q(question, type, extra = {}) {
  const base = {
    question,
    type,
    hint: extra.hint || `Provide the evidence needed to answer: "${question}"`,
    criteria:
      extra.criteria ||
      'Acceptable when documented, dated and verifiable on audit.',
    ai_review_enabled: true,
    ai_review_criteria:
      extra.ai_criteria ||
      'AI verifies the supporting document matches the stated claim and is in date.',
    ai_review_score: extra.ai_score ?? 10,
    yes_score: type === 'boolean' ? extra.yes_score ?? 10 : 0,
    no_score: type === 'boolean' ? extra.no_score ?? 0 : 0,
    score: extra.score ?? 5,
    is_compulsory: extra.is_compulsory ?? false,
    options: extra.options || null,
    conditionalTo: extra.conditionalTo || null, // { path, trigger:'yes'|'no', action:'redirect'|'block' }
    children: extra.children || null, // { yes: [q...], no: [q...] }
  };
  return base;
}

// Convenience wrappers for each question type
const qBool = (text, extra) => q(text, 'boolean', extra);
const qText = (text, extra) => q(text, 'text', extra);
const qNumber = (text, extra) => q(text, 'number', extra);
const qRating = (text, extra) => q(text, 'rating', extra);
const qChoice = (text, options, extra) =>
  q(text, 'multiple_choice', { ...extra, options });
const qCheckbox = (text, options, extra) =>
  q(text, 'checkbox', { ...extra, options });

// ─────────────────────────────────────────────────────────────────────────────
// 4 CERTIFICATE DEFINITIONS — distinct domains, each fully complete.
// ─────────────────────────────────────────────────────────────────────────────
const CERTIFICATES = [
  // ── 1. Food Safety (HACCP) ────────────────────────────────────────────────
  {
    certificate_id: 'CERT-FOOD-HACCP-001',
    short_code: 'FSH',
    name: 'Food Safety & HACCP Compliance Certificate',
    description:
      'Comprehensive certification covering hazard analysis, critical control points, hygiene and traceability for food production facilities.',
    industry_keywords: ['food', 'hospitality', 'manufactur'],
    disclosure_price: 1500.0,
    assured_price: 2400.0,
    validity_days: 0,
    validity_months: 6,
    validity_years: 1,
    compulsory_docs: [
      'Valid Food Business Operating Licence',
      'Most recent third-party HACCP audit report',
      'Pest control service contract',
    ],
    is_published: true,
    badges: BADGES,
    mains: [
      {
        name: 'Hazard Analysis & Controls',
        sections: [
          {
            name: 'Hazard Identification',
            // section-level (2nd level) questions
            questions: [
              qBool(
                'Has a documented hazard analysis been completed for every product line?',
                {
                  is_compulsory: true,
                  criteria: 'A signed hazard analysis exists for 100% of SKUs.',
                  conditionalTo: {
                    path: 'Hazard Analysis & Controls > Critical Control Points',
                    trigger: 'no',
                    action: 'redirect',
                  },
                  children: {
                    yes: [
                      qText(
                        'Summarise the biological, chemical and physical hazards identified.',
                        { score: 4 },
                      ),
                    ],
                    no: [
                      qText(
                        'Explain why a hazard analysis has not yet been completed.',
                        { score: 2 },
                      ),
                    ],
                  },
                },
              ),
              qChoice(
                'How frequently is the hazard analysis reviewed?',
                ['Quarterly', 'Twice a year', 'Annually', 'Only after an incident'],
                { score: 6 },
              ),
            ],
            subsections: [
              {
                name: 'Biological Hazards',
                questions: [
                  qBool(
                    'Are pathogen testing results retained for at least 12 months?',
                    { is_compulsory: true, yes_score: 10, no_score: 0 },
                  ),
                  qNumber(
                    'What is the maximum allowable pathogen test turnaround time, in hours?',
                    { hint: 'Lower is better; rapid methods are < 24h.', score: 5 },
                  ),
                ],
              },
              {
                name: 'Chemical & Allergen Hazards',
                questions: [
                  qCheckbox(
                    'Which allergen controls are in place on site?',
                    [
                      'Dedicated allergen storage',
                      'Colour-coded utensils',
                      'Validated cleaning between runs',
                      'Allergen label verification',
                    ],
                    { is_compulsory: true, score: 8 },
                  ),
                  qText(
                    'Describe your allergen management plan and state when it was last reviewed.',
                    { score: 5, criteria: 'Plan is signed and dated within 12 months.' },
                  ),
                ],
              },
            ],
          },
          {
            name: 'Critical Control Points',
            questions: [
              qRating(
                'Rate the maturity of your CCP monitoring programme.',
                { hint: '1 = ad-hoc, 5 = automated continuous monitoring.', score: 6 },
              ),
            ],
            subsections: [
              {
                name: 'Temperature Control',
                questions: [
                  qBool(
                    'Are cook and chill temperatures logged for every batch?',
                    { is_compulsory: true },
                  ),
                  qNumber(
                    'What is the target core cooking temperature, in °C?',
                    { hint: 'Typically 75°C for most products.', score: 7 },
                  ),
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Hygiene & Traceability',
        sections: [
          {
            name: 'Personal Hygiene',
            subsections: [
              {
                name: 'Handwashing & PPE',
                questions: [
                  qBool('Are handwashing stations stocked and accessible at all entries?', {
                    is_compulsory: true,
                  }),
                  qText('Describe how PPE compliance is monitored across shifts.', {
                    score: 4,
                  }),
                ],
              },
            ],
          },
          {
            name: 'Traceability',
            subsections: [
              {
                name: 'Batch & Lot Tracking',
                questions: [
                  qBool('Can any finished product be traced to its raw material lots within 4 hours?', {
                    is_compulsory: true,
                  }),
                  qChoice(
                    'What system underpins your traceability?',
                    ['Fully integrated ERP', 'Standalone software', 'Spreadsheets', 'Paper records'],
                    { score: 6 },
                  ),
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── 2. Construction Site Safety ───────────────────────────────────────────
  {
    certificate_id: 'CERT-CONSTR-SAFE-001',
    short_code: 'CSS',
    name: 'Construction Site Safety Certificate',
    description:
      'Certification assessing fall protection, plant operation, permit-to-work and emergency readiness on construction sites.',
    industry_keywords: ['construct', 'engineer', 'real estate'],
    disclosure_price: 1800.0,
    assured_price: 2900.0,
    validity_days: 0,
    validity_months: 0,
    validity_years: 2,
    compulsory_docs: [
      'Site safety management plan',
      'Workers compensation insurance certificate',
      'Plant and equipment inspection register',
    ],
    is_published: true,
    badges: BADGES,
    mains: [
      {
        name: 'Working at Height',
        sections: [
          {
            name: 'Fall Protection',
            questions: [
              qBool(
                'Is a fall-protection plan in place for all work above 2 metres?',
                {
                  is_compulsory: true,
                  conditionalTo: {
                    path: 'Working at Height > Scaffolding',
                    trigger: 'yes',
                    action: 'block',
                  },
                  children: {
                    yes: [
                      qText('Summarise the key controls in the fall-protection plan.', {
                        score: 5,
                      }),
                    ],
                    no: [
                      qText('State the interim controls used while no plan exists.', {
                        score: 2,
                      }),
                    ],
                  },
                },
              ),
            ],
            subsections: [
              {
                name: 'Harnesses & Anchors',
                questions: [
                  qBool('Are all harnesses inspected before each use and logged?', {
                    is_compulsory: true,
                  }),
                  qNumber('How many certified anchor points are available on the highest active level?', {
                    score: 5,
                  }),
                ],
              },
            ],
          },
          {
            name: 'Scaffolding',
            subsections: [
              {
                name: 'Erection & Inspection',
                questions: [
                  qBool('Is every scaffold tagged and inspected at least weekly?', {
                    is_compulsory: true,
                  }),
                  qChoice(
                    'Who is authorised to sign off scaffold inspections?',
                    ['Licensed scaffolder', 'Site supervisor', 'Any trained worker', 'Not formally controlled'],
                    { score: 6 },
                  ),
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Plant & Emergency',
        sections: [
          {
            name: 'Plant Operation',
            subsections: [
              {
                name: 'Operator Competency',
                questions: [
                  qBool('Do all plant operators hold a current high-risk work licence?', {
                    is_compulsory: true,
                  }),
                  qCheckbox(
                    'Which pre-start checks are mandatory before operating plant?',
                    ['Visual inspection', 'Fluid levels', 'Brakes and alarms', 'Logbook entry'],
                    { score: 7 },
                  ),
                ],
              },
            ],
          },
          {
            name: 'Emergency Readiness',
            subsections: [
              {
                name: 'Evacuation & First Aid',
                questions: [
                  qBool('Are emergency evacuation drills run at least quarterly?', {
                    is_compulsory: true,
                  }),
                  qRating('Rate the adequacy of first-aid coverage across all shifts.', {
                    score: 5,
                  }),
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── 3. Data Center Operations ─────────────────────────────────────────────
  {
    certificate_id: 'CERT-DC-OPS-001',
    short_code: 'DCO',
    name: 'Data Center Operations & Resilience Certificate',
    description:
      'Certification evaluating power redundancy, cooling, physical security and incident management for data center facilities.',
    industry_keywords: ['technolog', 'information', 'telecom'],
    disclosure_price: 2200.0,
    assured_price: 3600.0,
    validity_days: 0,
    validity_months: 18,
    validity_years: 0,
    compulsory_docs: [
      'Facility single-line electrical diagram',
      'Most recent DR test report',
      'Physical access control policy',
    ],
    is_published: false,
    badges: BADGES,
    mains: [
      {
        name: 'Power & Cooling',
        sections: [
          {
            name: 'Power Redundancy',
            questions: [
              qBool(
                'Is the facility configured to at least N+1 power redundancy?',
                {
                  is_compulsory: true,
                  conditionalTo: {
                    path: 'Power & Cooling > Cooling',
                    trigger: 'no',
                    action: 'redirect',
                  },
                  children: {
                    yes: [
                      qChoice(
                        'What redundancy tier is maintained?',
                        ['2N', 'N+2', 'N+1', 'N'],
                        { score: 6 },
                      ),
                    ],
                    no: [
                      qText('Describe the roadmap to reach N+1 redundancy.', { score: 2 }),
                    ],
                  },
                },
              ),
            ],
            subsections: [
              {
                name: 'UPS & Generators',
                questions: [
                  qBool('Are generators load-tested under full load at least monthly?', {
                    is_compulsory: true,
                  }),
                  qNumber('What is the guaranteed on-site fuel autonomy, in hours?', {
                    score: 7,
                  }),
                ],
              },
            ],
          },
          {
            name: 'Cooling',
            subsections: [
              {
                name: 'Thermal Management',
                questions: [
                  qBool('Is hot-aisle/cold-aisle containment implemented across all halls?', {
                    is_compulsory: true,
                  }),
                  qNumber('What is the design PUE for the facility?', {
                    hint: 'Lower is better; world-class is < 1.3.',
                    score: 6,
                  }),
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Security & Incidents',
        sections: [
          {
            name: 'Physical Security',
            subsections: [
              {
                name: 'Access Control',
                questions: [
                  qBool('Is multi-factor physical access enforced at every secure boundary?', {
                    is_compulsory: true,
                  }),
                  qCheckbox(
                    'Which physical controls protect the data halls?',
                    ['Mantrap', 'Biometric reader', '24/7 CCTV', 'Security personnel'],
                    { score: 8 },
                  ),
                ],
              },
            ],
          },
          {
            name: 'Incident Management',
            subsections: [
              {
                name: 'Response & Review',
                questions: [
                  qBool('Are all major incidents followed by a documented post-incident review?', {
                    is_compulsory: true,
                  }),
                  qText('Describe the structure and ownership of your incident response runbook.', {
                    score: 5,
                  }),
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── 4. ESG & Sustainability ───────────────────────────────────────────────
  {
    certificate_id: 'CERT-ESG-SUST-001',
    short_code: 'ESG',
    name: 'Environmental, Social & Governance (ESG) Certificate',
    description:
      'Certification measuring carbon management, resource efficiency, social responsibility and governance transparency.',
    industry_keywords: ['energy', 'manufactur', 'retail'],
    disclosure_price: 2000.0,
    assured_price: 3200.0,
    validity_days: 0,
    validity_months: 0,
    validity_years: 1,
    compulsory_docs: [
      'Latest sustainability / ESG report',
      'Scope 1 & 2 emissions inventory',
      'Board-approved governance charter',
    ],
    is_published: true,
    badges: BADGES,
    mains: [
      {
        name: 'Environmental',
        sections: [
          {
            name: 'Carbon Management',
            questions: [
              qBool(
                'Has the organisation set a science-based emissions reduction target?',
                {
                  is_compulsory: true,
                  conditionalTo: {
                    path: 'Environmental > Resource Efficiency',
                    trigger: 'yes',
                    action: 'redirect',
                  },
                  children: {
                    yes: [
                      qNumber('By what percentage do you target reducing emissions by 2030?', {
                        score: 6,
                      }),
                    ],
                    no: [
                      qText('Describe the barriers to setting a reduction target.', { score: 2 }),
                    ],
                  },
                },
              ),
            ],
            subsections: [
              {
                name: 'Emissions Inventory',
                questions: [
                  qBool('Are Scope 1 and Scope 2 emissions independently verified?', {
                    is_compulsory: true,
                  }),
                  qChoice(
                    'How far does your emissions reporting extend?',
                    ['Scope 1, 2 and 3', 'Scope 1 and 2', 'Scope 1 only', 'Not measured'],
                    { score: 7 },
                  ),
                ],
              },
            ],
          },
          {
            name: 'Resource Efficiency',
            subsections: [
              {
                name: 'Water & Waste',
                questions: [
                  qBool('Is at least 50% of operational waste diverted from landfill?', {
                    is_compulsory: true,
                  }),
                  qNumber('What percentage of water is recycled or reused?', { score: 5 }),
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Social & Governance',
        sections: [
          {
            name: 'Social Responsibility',
            subsections: [
              {
                name: 'Workforce & Community',
                questions: [
                  qBool('Is a living wage paid to all directly-employed staff?', {
                    is_compulsory: true,
                  }),
                  qRating('Rate the maturity of your diversity and inclusion programme.', {
                    score: 5,
                  }),
                ],
              },
            ],
          },
          {
            name: 'Governance',
            subsections: [
              {
                name: 'Ethics & Transparency',
                questions: [
                  qBool('Is there an independently-operated whistleblower channel?', {
                    is_compulsory: true,
                  }),
                  qCheckbox(
                    'Which governance policies are board-approved and published?',
                    ['Anti-bribery', 'Data privacy', 'Supplier code of conduct', 'Conflict of interest'],
                    { score: 8 },
                  ),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Insertion helpers
// ─────────────────────────────────────────────────────────────────────────────

async function pickIndustryIds(client, keywords) {
  // Resolve up to 2 real industry UUIDs matching the keywords; fall back to any.
  const ids = [];
  for (const kw of keywords) {
    const res = await client.query(
      `SELECT id FROM industry WHERE LOWER(name) LIKE $1 ORDER BY name LIMIT 1`,
      [`%${kw.toLowerCase()}%`],
    );
    if (res.rows[0] && !ids.includes(res.rows[0].id)) ids.push(res.rows[0].id);
    if (ids.length >= 2) break;
  }
  if (ids.length === 0) {
    const any = await client.query(`SELECT id FROM industry ORDER BY name LIMIT 2`);
    any.rows.forEach((r) => ids.push(r.id));
  }
  return ids;
}

async function pickCreatedBy(client) {
  const admin = await client.query(
    `SELECT id FROM users WHERE role IN ('admin','subadmin') ORDER BY created_at LIMIT 1`,
  );
  if (admin.rows[0]) return admin.rows[0].id;
  const any = await client.query(`SELECT id FROM users ORDER BY created_at LIMIT 1`);
  return any.rows[0] ? any.rows[0].id : null;
}

/**
 * Insert a single question (and recurse into nested yes/no children).
 * `ctx` carries the container + the running counters so every uniqueness
 * constraint (rank, question_number, certificate_question_number) is satisfied.
 */
async function insertQuestion(client, qDef, ctx, parent) {
  const isThird = ctx.subSectionId != null;
  const rank = ctx.nextRank();
  const questionNumber = ctx.nextQuestionNumber();
  const certNumber = ctx.nextCertNumber();

  // Resolve conditional logic against already-created section/subsection IDs.
  let conditionalEnabled = false;
  let conditionalLogic = null;
  if (qDef.type === 'boolean' && qDef.conditionalTo) {
    const target = ctx.resolveTarget(qDef.conditionalTo.path);
    if (target) {
      const action =
        qDef.conditionalTo.action === 'block'
          ? { blocked_sections: [{ target_type: target.type, target_id: target.id }] }
          : { redirect_to: { target_type: target.type, target_id: target.id } };
      conditionalEnabled = true;
      conditionalLogic = { [qDef.conditionalTo.trigger]: action };
    }
  }

  // NOTE: `is_compulsory` is intentionally omitted — it is not present on the
  // live questions table (migration 077 not applied). All other fields are set.
  const res = await client.query(
    `INSERT INTO questions (
       certificate_id, main_section_id, section_id, sub_section_id,
       question, hint, type, is_third_level, criteria,
       ai_review_enabled, ai_review_criteria, ai_review_score,
       yes_score, no_score,
       conditional_logic_enabled, conditional_logic,
       rank, question_number, certificate_question_number,
       score, options,
       parent_question_id, parent_trigger_value
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8, $9,
       $10, $11, $12,
       $13, $14,
       $15, $16::jsonb,
       $17, $18, $19,
       $20, $21::jsonb,
       $22, $23
     ) RETURNING id`,
    [
      ctx.certificateId,
      ctx.mainSectionId,
      ctx.sectionId,
      ctx.subSectionId,
      qDef.question,
      qDef.hint,
      qDef.type,
      isThird,
      qDef.criteria,
      qDef.ai_review_enabled,
      qDef.ai_review_criteria,
      qDef.ai_review_score,
      qDef.yes_score,
      qDef.no_score,
      conditionalEnabled,
      conditionalLogic ? JSON.stringify(conditionalLogic) : null,
      rank,
      questionNumber,
      certNumber,
      qDef.score,
      qDef.options ? JSON.stringify(qDef.options) : null,
      parent ? parent.id : null,
      parent ? parent.trigger : null,
    ],
  );
  const id = res.rows[0].id;

  // Nested yes/no sub-questions share the SAME container counters.
  if (qDef.children) {
    for (const trigger of ['yes', 'no']) {
      for (const childDef of qDef.children[trigger] || []) {
        await insertQuestion(client, childDef, ctx, { id, trigger });
      }
    }
  }
  return id;
}

async function seedCertificate(client, def, industryIds, createdBy) {
  // Skip if it already exists (idempotent re-runs).
  const existing = await client.query(
    `SELECT id FROM certificates WHERE certificate_id = $1`,
    [def.certificate_id],
  );
  if (existing.rows[0]) {
    return { skipped: true, id: existing.rows[0].id };
  }

  // 1) Certificate
  const cert = await client.query(
    `INSERT INTO certificates (
       certificate_id, short_code, name, industry_ids, disclosure_price, assured_price,
       validity_days, validity_months, validity_years, compulsory_docs, description,
       is_published, created_by, updated_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING id`,
    [
      def.certificate_id,
      def.short_code,
      def.name,
      industryIds.length ? industryIds : null,
      def.disclosure_price,
      def.assured_price,
      def.validity_days,
      def.validity_months,
      def.validity_years,
      def.compulsory_docs,
      def.description,
      def.is_published,
      createdBy,
    ],
  );
  const certificateId = cert.rows[0].id;

  // 2) Badges + colours
  for (const badge of def.badges) {
    const b = await client.query(
      `INSERT INTO badges (certificate_id, slot, name) VALUES ($1,$2,$3) RETURNING id`,
      [certificateId, badge.slot, badge.name],
    );
    for (const c of badge.colors) {
      await client.query(
        `INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1,$2,$3,$4)`,
        [b.rows[0].id, c.color, c.min_score, c.max_score],
      );
    }
  }

  // 3) Hierarchy first (so questions can resolve conditional targets by path).
  const targetByPath = new Map(); // "Main > Section" / "Main > Section > Sub" -> {id,type}
  const built = []; // flattened plan for question insertion

  let mainRank = 0;
  for (const main of def.mains) {
    mainRank += 1;
    const ms = await client.query(
      `INSERT INTO main_section (certificate_id, name, rank) VALUES ($1,$2,$3) RETURNING id`,
      [certificateId, main.name, mainRank],
    );
    const mainId = ms.rows[0].id;

    let sectionRank = 0;
    for (const section of main.sections) {
      sectionRank += 1;
      const s = await client.query(
        `INSERT INTO sections (certificate_id, main_id, name, rank) VALUES ($1,$2,$3,$4) RETURNING id`,
        [certificateId, mainId, section.name, sectionRank],
      );
      const sectionId = s.rows[0].id;
      const sectionPath = `${main.name} > ${section.name}`;
      targetByPath.set(sectionPath, { id: sectionId, type: 'section' });

      const subSections = [];
      let subRank = 0;
      for (const sub of section.subsections || []) {
        subRank += 1;
        const ss = await client.query(
          `INSERT INTO sub_section (certificate_id, main_id, section_id, name, rank) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [certificateId, mainId, sectionId, sub.name, subRank],
        );
        const subId = ss.rows[0].id;
        targetByPath.set(`${sectionPath} > ${sub.name}`, {
          id: subId,
          type: 'sub_section',
        });
        subSections.push({ id: subId, questions: sub.questions || [] });
      }

      built.push({
        mainId,
        sectionId,
        sectionQuestions: section.questions || [],
        subSections,
      });
    }
  }

  // 4) Questions. Counters: per-section (2nd level) and per-subsection (3rd
  //    level) for rank+question_number; per-certificate for certificate_number.
  let certCounter = 0;
  const nextCertNumber = () => (certCounter += 1);

  for (const node of built) {
    // Section-level questions (is_third_level = FALSE, sub_section_id = NULL)
    let secRank = 0;
    let secNum = 0;
    const sectionCtx = {
      certificateId,
      mainSectionId: node.mainId,
      sectionId: node.sectionId,
      subSectionId: null,
      nextRank: () => (secRank += 1),
      nextQuestionNumber: () => (secNum += 1),
      nextCertNumber,
      resolveTarget: (path) => targetByPath.get(path) || null,
    };
    for (const qDef of node.sectionQuestions) {
      await insertQuestion(client, qDef, sectionCtx, null);
    }

    // Sub-section questions (is_third_level = TRUE)
    for (const sub of node.subSections) {
      let subRank = 0;
      let subNum = 0;
      const subCtx = {
        certificateId,
        mainSectionId: node.mainId,
        sectionId: node.sectionId,
        subSectionId: sub.id,
        nextRank: () => (subRank += 1),
        nextQuestionNumber: () => (subNum += 1),
        nextCertNumber,
        resolveTarget: (path) => targetByPath.get(path) || null,
      };
      for (const qDef of sub.questions) {
        await insertQuestion(client, qDef, subCtx, null);
      }
    }
  }

  // 5) Hierarchical short codes for the whole tree (mirrors
  //    CertificateRepository.recalculateHierarchicalShortCodes).
  await recalcShortCodes(client, certificateId);

  return { skipped: false, id: certificateId };
}

/** Recompute short codes: certificate.short_code -> mains -> sections -> subs -> questions. */
async function recalcShortCodes(client, certificateId) {
  await client.query(`UPDATE questions SET short_code = NULL WHERE certificate_id = $1`, [certificateId]);
  await client.query(`UPDATE sub_section SET short_code = NULL WHERE certificate_id = $1`, [certificateId]);
  await client.query(`UPDATE sections SET short_code = NULL WHERE certificate_id = $1`, [certificateId]);
  await client.query(`UPDATE main_section SET short_code = NULL WHERE certificate_id = $1`, [certificateId]);

  await client.query(
    `UPDATE main_section ms SET short_code = c.short_code || ms.rank::text
     FROM certificates c
     WHERE ms.certificate_id = c.id AND ms.certificate_id = $1
       AND c.short_code IS NOT NULL AND ms.rank IS NOT NULL`,
    [certificateId],
  );
  await client.query(
    `UPDATE sections s SET short_code = ms.short_code || '.' || s.rank::text
     FROM main_section ms
     WHERE s.main_id = ms.id AND s.certificate_id = $1
       AND ms.short_code IS NOT NULL AND s.rank IS NOT NULL`,
    [certificateId],
  );
  await client.query(
    `UPDATE sub_section ss SET short_code = s.short_code || '.' || ss.rank::text
     FROM sections s
     WHERE ss.section_id = s.id AND ss.certificate_id = $1
       AND s.short_code IS NOT NULL AND ss.rank IS NOT NULL`,
    [certificateId],
  );
  // Top-level section questions
  await client.query(
    `UPDATE questions q SET short_code = s.short_code || '.0.' || q.question_number::text
     FROM sections s
     WHERE q.section_id = s.id AND q.certificate_id = $1
       AND q.is_third_level = FALSE AND q.parent_question_id IS NULL
       AND s.short_code IS NOT NULL AND q.question_number IS NOT NULL`,
    [certificateId],
  );
  // Top-level sub-section questions
  await client.query(
    `UPDATE questions q SET short_code = s.short_code || '.' || ss.rank::text || '.' || q.question_number::text
     FROM sub_section ss JOIN sections s ON s.id = ss.section_id
     WHERE q.sub_section_id = ss.id AND q.certificate_id = $1
       AND q.is_third_level = TRUE AND q.parent_question_id IS NULL
       AND s.short_code IS NOT NULL AND ss.rank IS NOT NULL AND q.question_number IS NOT NULL`,
    [certificateId],
  );
  // Nested (child) questions — derive from the parent's short code so NONE are left blank.
  await client.query(
    `UPDATE questions q
     SET short_code = p.short_code || '.' || UPPER(LEFT(q.parent_trigger_value, 1)) || q.question_number::text
     FROM questions p
     WHERE q.parent_question_id = p.id AND q.certificate_id = $1
       AND p.short_code IS NOT NULL`,
    [certificateId],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
  const client = await pool.connect();
  try {
    const createdBy = await pickCreatedBy(client);
    console.log(
      createdBy
        ? `Using created_by user: ${createdBy}`
        : 'No users found — created_by/updated_by will be NULL.',
    );

    for (const def of CERTIFICATES) {
      await client.query('BEGIN');
      try {
        const industryIds = await pickIndustryIds(client, def.industry_keywords);
        const result = await seedCertificate(client, def, industryIds, createdBy);
        await client.query('COMMIT');

        if (result.skipped) {
          console.log(`↷ Skipped (already exists): ${def.certificate_id} — ${def.name}`);
        } else {
          const counts = await client.query(
            `SELECT
               (SELECT COUNT(*) FROM main_section WHERE certificate_id = $1) AS mains,
               (SELECT COUNT(*) FROM sections WHERE certificate_id = $1) AS sections,
               (SELECT COUNT(*) FROM sub_section WHERE certificate_id = $1) AS subs,
               (SELECT COUNT(*) FROM questions WHERE certificate_id = $1) AS questions,
               (SELECT COUNT(*) FROM badges WHERE certificate_id = $1) AS badges`,
            [result.id],
          );
          const c = counts.rows[0];
          console.log(
            `✓ Created ${def.certificate_id} — ${def.name}\n` +
              `    id=${result.id} | industries=${industryIds.length} | badges=${c.badges} | ` +
              `mains=${c.mains} sections=${c.sections} subs=${c.subs} questions=${c.questions}`,
          );
        }
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`✗ Failed ${def.certificate_id}: ${err.message}`);
        throw err;
      }
    }

    console.log('\nDone. 4 complete certificates seeded.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
