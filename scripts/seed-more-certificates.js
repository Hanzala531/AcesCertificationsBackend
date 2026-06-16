require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const ALL_INDUSTRY_IDS = [
  '02c5d708-13a1-4d4e-8f6e-d48f5a5e27ae',
  '138951cc-cd80-4576-835e-1840a6b6f85a',
  '802ba2f4-8eae-41b1-8995-5d8092262df4',
  'b1f95cc2-221e-4636-b282-77309ea4417c',
  '03e3f50e-8986-4b9c-8220-2184da874493',
];

const CERTS = [
  {
    code: 'ESG-ENV-001',
    name: 'Environmental Sustainability Standard',
    description: 'Comprehensive environmental management and sustainability practices assessment.',
    price: 75,
    assuredPrice: 150,
    mainSections: [
      {
        name: 'Carbon Emissions',
        sections: [
          {
            name: 'Emission Tracking',
            questions: [
              { q: 'Does your organization track greenhouse gas emissions?', type: 'boolean', w: 2, hint: 'Including Scope 1 and Scope 2 emissions' },
              { q: 'What is your annual CO2 emission in metric tons?', type: 'number', w: 1, hint: 'Approximate value is acceptable' },
              { q: 'Describe your emission reduction strategy.', type: 'text', w: 1, hint: 'Include targets and timelines' },
            ],
          },
          {
            name: 'Renewable Energy',
            questions: [
              { q: 'What percentage of energy comes from renewable sources?', type: 'number', w: 2, hint: 'Enter 0-100' },
              { q: 'Which renewable sources do you use?', type: 'checkbox', w: 1, hint: 'Select all that apply', options: ['Solar', 'Wind', 'Hydro', 'Geothermal', 'Biomass'] },
            ],
          },
        ],
      },
      {
        name: 'Waste Management',
        sections: [
          {
            name: 'Waste Reduction',
            questions: [
              { q: 'Do you have a waste reduction policy?', type: 'boolean', w: 2, hint: 'Documented and enforced policy' },
              { q: 'Rate your waste segregation practices (1-5).', type: 'rating', w: 1, hint: '1=None, 5=Comprehensive' },
              { q: 'How is hazardous waste disposed?', type: 'multiple_choice', w: 1, hint: 'Select primary method', options: ['Licensed contractor', 'On-site treatment', 'Municipal collection', 'Recycling facility'] },
            ],
          },
          {
            name: 'Recycling Program',
            subSections: [
              {
                name: 'Paper & Plastics',
                questions: [
                  { q: 'Is there an active recycling program for paper and plastics?', type: 'boolean', w: 1, hint: 'Available to all departments' },
                  { q: 'What is your recycling rate percentage?', type: 'number', w: 1, hint: 'Approximate percentage' },
                ],
              },
              {
                name: 'E-Waste',
                questions: [
                  { q: 'How is electronic waste handled?', type: 'text', w: 1, hint: 'Describe disposal or recycling process' },
                  { q: 'How many devices were recycled last year?', type: 'number', w: 1, hint: 'Computers, phones, etc.' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'ESG-SOC-001',
    name: 'Social Responsibility & Labor Standards',
    description: 'Assessment of labor practices, diversity, and community engagement.',
    price: 60,
    assuredPrice: 120,
    mainSections: [
      {
        name: 'Labor Practices',
        sections: [
          {
            name: 'Employee Rights',
            questions: [
              { q: 'Do employees have freedom of association?', type: 'boolean', w: 2, hint: 'Right to form or join unions' },
              { q: 'What is your employee turnover rate?', type: 'number', w: 1, hint: 'Annual percentage' },
              { q: 'Describe your grievance resolution process.', type: 'text', w: 1, hint: 'Include escalation steps' },
              { q: 'Rate employee satisfaction (1-5).', type: 'rating', w: 1, hint: 'Based on latest survey' },
            ],
          },
          {
            name: 'Working Conditions',
            questions: [
              { q: 'Is overtime voluntary and compensated?', type: 'boolean', w: 2, hint: 'Per local labor laws' },
              { q: 'Average weekly working hours per employee?', type: 'number', w: 1, hint: 'Standard hours excluding overtime' },
              { q: 'Which benefits are provided?', type: 'checkbox', w: 1, hint: 'Select all that apply', options: ['Health insurance', 'Paid leave', 'Retirement plan', 'Parental leave', 'Training budget', 'Flexible hours'] },
            ],
          },
        ],
      },
      {
        name: 'Diversity & Inclusion',
        sections: [
          {
            name: 'Workforce Diversity',
            questions: [
              { q: 'Do you have a diversity and inclusion policy?', type: 'boolean', w: 2, hint: 'Documented and communicated' },
              { q: 'What percentage of leadership is from underrepresented groups?', type: 'number', w: 1, hint: 'Approximate percentage' },
              { q: 'How often is diversity training conducted?', type: 'multiple_choice', w: 1, hint: 'Select frequency', options: ['Monthly', 'Quarterly', 'Annually', 'On hiring', 'Never'] },
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'ESG-GOV-001',
    name: 'Corporate Governance & Ethics',
    description: 'Evaluation of governance structures, transparency, and ethical practices.',
    price: 80,
    assuredPrice: 160,
    mainSections: [
      {
        name: 'Board & Leadership',
        sections: [
          {
            name: 'Board Composition',
            questions: [
              { q: 'Does the board include independent directors?', type: 'boolean', w: 2, hint: 'At least one independent member' },
              { q: 'How many board members are there?', type: 'number', w: 1, hint: 'Total count' },
              { q: 'How often does the board meet annually?', type: 'number', w: 1, hint: 'Number of meetings per year' },
              { q: 'Rate board diversity (1-5).', type: 'rating', w: 1, hint: '1=Homogeneous, 5=Highly diverse' },
            ],
          },
          {
            name: 'Executive Compensation',
            questions: [
              { q: 'Is executive compensation linked to ESG performance?', type: 'boolean', w: 2, hint: 'Any ESG-linked KPIs in compensation' },
              { q: 'Describe your compensation transparency policy.', type: 'text', w: 1, hint: 'How is pay information shared' },
            ],
          },
        ],
      },
      {
        name: 'Ethics & Compliance',
        sections: [
          {
            name: 'Anti-Corruption',
            questions: [
              { q: 'Do you have an anti-corruption policy?', type: 'boolean', w: 2, hint: 'Documented and enforced' },
              { q: 'Is there a whistleblower protection mechanism?', type: 'boolean', w: 2, hint: 'Anonymous reporting channel' },
              { q: 'How many ethics training sessions were held last year?', type: 'number', w: 1, hint: 'Enter 0 if none' },
            ],
          },
          {
            name: 'Data Privacy',
            subSections: [
              {
                name: 'Data Protection Policies',
                questions: [
                  { q: 'Is there a documented data protection policy?', type: 'boolean', w: 2, hint: 'GDPR or equivalent compliance' },
                  { q: 'How many data breaches occurred last year?', type: 'number', w: 1, hint: 'Enter 0 if none' },
                ],
              },
              {
                name: 'User Consent',
                questions: [
                  { q: 'Do you obtain explicit consent for data collection?', type: 'boolean', w: 1, hint: 'Opt-in mechanisms' },
                  { q: 'Rate your data privacy practices (1-5).', type: 'rating', w: 1, hint: '1=Minimal, 5=Best-in-class' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'ESG-SCM-001',
    name: 'Supply Chain Sustainability',
    description: 'Assessment of sustainable and ethical supply chain management practices.',
    price: 65,
    assuredPrice: 130,
    mainSections: [
      {
        name: 'Supplier Standards',
        sections: [
          {
            name: 'Supplier Code of Conduct',
            questions: [
              { q: 'Do you have a supplier code of conduct?', type: 'boolean', w: 2, hint: 'Covers labor, environment, ethics' },
              { q: 'What percentage of suppliers signed the code?', type: 'number', w: 1, hint: '0-100 percent' },
              { q: 'How are supplier violations handled?', type: 'text', w: 1, hint: 'Describe enforcement process' },
              { q: 'Rate supplier compliance monitoring (1-5).', type: 'rating', w: 1, hint: '1=None, 5=Continuous' },
            ],
          },
          {
            name: 'Supplier Audits',
            questions: [
              { q: 'Are regular supplier audits conducted?', type: 'boolean', w: 2, hint: 'At least annually' },
              { q: 'How many supplier audits were completed last year?', type: 'number', w: 1, hint: 'Total count' },
              { q: 'Which audit areas are covered?', type: 'checkbox', w: 1, hint: 'Select all that apply', options: ['Labor practices', 'Environmental compliance', 'Quality standards', 'Financial health', 'Ethical conduct', 'Safety'] },
            ],
          },
        ],
      },
      {
        name: 'Logistics & Transport',
        sections: [
          {
            name: 'Transport Emissions',
            questions: [
              { q: 'Do you track transport-related emissions?', type: 'boolean', w: 2, hint: 'Scope 3 logistics emissions' },
              { q: 'What percentage of fleet uses low-emission vehicles?', type: 'number', w: 1, hint: 'Electric, hybrid, or CNG' },
              { q: 'Describe your logistics optimization strategy.', type: 'text', w: 1, hint: 'Route optimization, load consolidation, etc.' },
            ],
          },
          {
            name: 'Packaging',
            questions: [
              { q: 'Is sustainable packaging used?', type: 'boolean', w: 1, hint: 'Recyclable or biodegradable materials' },
              { q: 'What percentage of packaging is recyclable?', type: 'number', w: 1, hint: '0-100 percent' },
            ],
          },
        ],
      },
    ],
  },
];

async function createCertificate(client, cert) {
  const industryArray = '{' + ALL_INDUSTRY_IDS.join(',') + '}';

  const certRes = await client.query(
    `INSERT INTO certificates (certificate_id, name, description, disclosure_price, assured_price, is_published, industry_ids)
     VALUES ($1, $2, $3, $4, $5, true, $6::uuid[])
     RETURNING id`,
    [cert.code, cert.name, cert.description, cert.price, cert.assuredPrice, industryArray]
  );
  const certId = certRes.rows[0].id;

  // Create badges with min score starting at 30
  const bronzeId = (await client.query(
    `INSERT INTO badges (certificate_id, name, color, slot) VALUES ($1, 'Bronze', '#CD7F32', 1) RETURNING id`, [certId]
  )).rows[0].id;
  const silverId = (await client.query(
    `INSERT INTO badges (certificate_id, name, color, slot) VALUES ($1, 'Silver', '#C0C0C0', 2) RETURNING id`, [certId]
  )).rows[0].id;
  const goldId = (await client.query(
    `INSERT INTO badges (certificate_id, name, color, slot) VALUES ($1, 'Gold', '#FFD700', 3) RETURNING id`, [certId]
  )).rows[0].id;

  await client.query(`INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1, '#CD7F32', 30, 64)`, [bronzeId]);
  await client.query(`INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1, '#C0C0C0', 65, 84)`, [silverId]);
  await client.query(`INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1, '#FFD700', 85, 100)`, [goldId]);

  let certQNum = 1;

  for (let msIdx = 0; msIdx < cert.mainSections.length; msIdx++) {
    const ms = cert.mainSections[msIdx];
    const msId = (await client.query(
      `INSERT INTO main_section (certificate_id, name, rank) VALUES ($1, $2, $3) RETURNING id`,
      [certId, ms.name, msIdx + 1]
    )).rows[0].id;

    for (let sIdx = 0; sIdx < ms.sections.length; sIdx++) {
      const sec = ms.sections[sIdx];
      const secId = (await client.query(
        `INSERT INTO sections (certificate_id, main_id, name, rank) VALUES ($1, $2, $3, $4) RETURNING id`,
        [certId, msId, sec.name, sIdx + 1]
      )).rows[0].id;

      if (sec.questions) {
        for (let qIdx = 0; qIdx < sec.questions.length; qIdx++) {
          const q = sec.questions[qIdx];
          await client.query(
            `INSERT INTO questions (certificate_id, main_section_id, section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint, options)
             VALUES ($1, $2, $3, $4, $5, $6, $7, false, $6, $8, $9, $10::jsonb)`,
            [certId, msId, secId, q.q, q.type, qIdx + 1, q.w, certQNum++, q.hint || null, q.options ? JSON.stringify(q.options) : null]
          );
        }
      }

      if (sec.subSections) {
        for (let ssIdx = 0; ssIdx < sec.subSections.length; ssIdx++) {
          const ss = sec.subSections[ssIdx];
          const ssId = (await client.query(
            `INSERT INTO sub_section (certificate_id, section_id, main_id, name, rank) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [certId, secId, msId, ss.name, ssIdx + 1]
          )).rows[0].id;

          for (let qIdx = 0; qIdx < ss.questions.length; qIdx++) {
            const q = ss.questions[qIdx];
            await client.query(
              `INSERT INTO questions (certificate_id, main_section_id, section_id, sub_section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint, options)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $7, $9, $10, $11::jsonb)`,
              [certId, msId, secId, ssId, q.q, q.type, qIdx + 1, q.w, certQNum++, q.hint || null, q.options ? JSON.stringify(q.options) : null]
            );
          }
        }
      }
    }
  }

  return { certId, name: cert.name, code: cert.code, questions: certQNum - 1 };
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Creating 4 certificates linked to all industries...\n');

    for (const cert of CERTS) {
      const result = await createCertificate(client, cert);
      console.log(`  ${result.code} | ${result.name} | ${result.questions} questions | ID: ${result.certId}`);
    }

    await client.query('COMMIT');
    console.log('\n=== DONE === 4 certificates created with badges (Bronze 30+, Silver 60+, Gold 80+, Platinum 95+)');

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
