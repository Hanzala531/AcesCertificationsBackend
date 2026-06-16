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
    code: 'ESG-WTR-001', name: 'Water Resource Management', description: 'Assessment of water usage, conservation, and wastewater management practices.', price: 55, assuredPrice: 110,
    mainSections: [
      { name: 'Water Usage', sections: [
        { name: 'Consumption Tracking', questions: [
          { q: 'Do you monitor total water consumption?', type: 'boolean', w: 2, hint: 'Metered tracking system' },
          { q: 'What is your annual water consumption in cubic meters?', type: 'number', w: 1, hint: 'Approximate value' },
          { q: 'Rate your water efficiency practices (1-5).', type: 'rating', w: 1, hint: '1=Poor, 5=Excellent' },
        ]},
        { name: 'Water Sources', questions: [
          { q: 'Which water sources does your facility use?', type: 'checkbox', w: 1, hint: 'Select all', options: ['Municipal supply', 'Groundwater', 'Rainwater harvesting', 'Recycled water', 'River/lake'] },
          { q: 'Is there a backup water supply system?', type: 'boolean', w: 1, hint: 'For emergency situations' },
        ]},
      ]},
      { name: 'Wastewater', sections: [
        { name: 'Treatment', questions: [
          { q: 'Is wastewater treated before discharge?', type: 'boolean', w: 2, hint: 'On-site or third-party treatment' },
          { q: 'Describe your wastewater treatment process.', type: 'text', w: 1, hint: 'Include treatment stages' },
          { q: 'How often is water quality tested?', type: 'multiple_choice', w: 1, hint: 'Select frequency', options: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually'] },
        ]},
        { name: 'Discharge Compliance', questions: [
          { q: 'Do you comply with local discharge regulations?', type: 'boolean', w: 2, hint: 'Valid permits required' },
          { q: 'How many discharge violations occurred last year?', type: 'number', w: 1, hint: 'Enter 0 if none' },
        ]},
      ]},
    ],
  },
  {
    code: 'ESG-ENR-001', name: 'Energy Efficiency & Transition', description: 'Evaluation of energy management, efficiency measures, and renewable energy adoption.', price: 70, assuredPrice: 140,
    mainSections: [
      { name: 'Energy Consumption', sections: [
        { name: 'Energy Monitoring', questions: [
          { q: 'Do you have an energy management system in place?', type: 'boolean', w: 2, hint: 'ISO 50001 or equivalent' },
          { q: 'What is your annual energy consumption in MWh?', type: 'number', w: 1, hint: 'Total across all facilities' },
          { q: 'Which energy sources do you use?', type: 'checkbox', w: 1, hint: 'Select all', options: ['Grid electricity', 'Natural gas', 'Solar', 'Wind', 'Diesel generators', 'Biomass'] },
          { q: 'Rate your energy efficiency improvement efforts (1-5).', type: 'rating', w: 1, hint: '1=None, 5=Comprehensive' },
        ]},
        { name: 'Efficiency Measures', questions: [
          { q: 'Have you conducted an energy audit in the last 2 years?', type: 'boolean', w: 2, hint: 'Third-party or internal audit' },
          { q: 'What percentage energy reduction was achieved last year?', type: 'number', w: 1, hint: '0-100 percent' },
          { q: 'Describe your top energy-saving initiative.', type: 'text', w: 1, hint: 'Include measurable outcomes' },
        ]},
      ]},
      { name: 'Renewable Transition', sections: [
        { name: 'Renewable Adoption', questions: [
          { q: 'Do you have a renewable energy target?', type: 'boolean', w: 2, hint: 'Published commitment or policy' },
          { q: 'What percentage of energy is from renewable sources?', type: 'number', w: 1, hint: '0-100' },
          { q: 'Do you purchase renewable energy certificates?', type: 'boolean', w: 1, hint: 'RECs, GOs, or equivalent' },
        ]},
      ]},
    ],
  },
  {
    code: 'ESG-BIO-001', name: 'Biodiversity & Land Use', description: 'Assessment of biodiversity impact, land management, and ecosystem preservation.', price: 60, assuredPrice: 120,
    mainSections: [
      { name: 'Biodiversity Impact', sections: [
        { name: 'Ecosystem Assessment', questions: [
          { q: 'Have you assessed your operations impact on local biodiversity?', type: 'boolean', w: 2, hint: 'Environmental impact assessment' },
          { q: 'Are any operations near protected areas or sensitive habitats?', type: 'boolean', w: 2, hint: 'Within 5km radius' },
          { q: 'Describe measures taken to minimize biodiversity impact.', type: 'text', w: 1, hint: 'Include specific actions' },
          { q: 'Rate your biodiversity monitoring efforts (1-5).', type: 'rating', w: 1, hint: '1=None, 5=Comprehensive' },
        ]},
        { name: 'Species Protection', questions: [
          { q: 'Do you have a no-deforestation commitment?', type: 'boolean', w: 2, hint: 'Published policy' },
          { q: 'How many hectares of land have been restored or protected?', type: 'number', w: 1, hint: 'Enter 0 if none' },
        ]},
      ]},
      { name: 'Land Management', sections: [
        { name: 'Sustainable Land Use', questions: [
          { q: 'Do you practice sustainable land management?', type: 'boolean', w: 1, hint: 'Soil conservation, crop rotation, etc.' },
          { q: 'What percentage of your land is under sustainable management?', type: 'number', w: 1, hint: '0-100 percent' },
          { q: 'Which sustainable practices are implemented?', type: 'checkbox', w: 1, hint: 'Select all', options: ['Crop rotation', 'Cover cropping', 'Reduced tillage', 'Buffer zones', 'Wildlife corridors', 'Native planting'] },
        ]},
      ]},
    ],
  },
  {
    code: 'ESG-HRS-001', name: 'Human Rights & Stakeholder Engagement', description: 'Assessment of human rights due diligence, community engagement, and stakeholder relations.', price: 65, assuredPrice: 130,
    mainSections: [
      { name: 'Human Rights', sections: [
        { name: 'Due Diligence', questions: [
          { q: 'Do you have a human rights policy?', type: 'boolean', w: 2, hint: 'Aligned with UN Guiding Principles' },
          { q: 'Is human rights due diligence conducted regularly?', type: 'boolean', w: 2, hint: 'Risk assessment process' },
          { q: 'Rate your human rights risk management (1-5).', type: 'rating', w: 1, hint: '1=Minimal, 5=Best practice' },
          { q: 'Describe your human rights grievance mechanism.', type: 'text', w: 1, hint: 'How can affected parties report concerns?' },
        ]},
        { name: 'Labor Standards', questions: [
          { q: 'Do you prohibit child labor in all operations?', type: 'boolean', w: 2, hint: 'Including supply chain' },
          { q: 'Do you prohibit forced labor?', type: 'boolean', w: 2, hint: 'Modern slavery prevention' },
          { q: 'What is the minimum age of employment?', type: 'number', w: 1, hint: 'Must comply with local laws' },
        ]},
      ]},
      { name: 'Stakeholder Engagement', sections: [
        { name: 'Community Relations', questions: [
          { q: 'Do you engage with local communities?', type: 'boolean', w: 1, hint: 'Regular dialogue or consultation' },
          { q: 'How many community engagement events were held last year?', type: 'number', w: 1, hint: 'Enter 0 if none' },
          { q: 'Which stakeholder groups do you engage with?', type: 'checkbox', w: 1, hint: 'Select all', options: ['Local communities', 'NGOs', 'Government', 'Investors', 'Customers', 'Employees', 'Suppliers'] },
        ]},
      ]},
    ],
  },
];

async function createCert(client, cert) {
  const industryArray = '{' + ALL_INDUSTRY_IDS.join(',') + '}';
  const certId = (await client.query(
    `INSERT INTO certificates (certificate_id, name, description, disclosure_price, assured_price, is_published, industry_ids)
     VALUES ($1, $2, $3, $4, $5, true, $6::uuid[]) RETURNING id`,
    [cert.code, cert.name, cert.description, cert.price, cert.assuredPrice, industryArray]
  )).rows[0].id;

  // Badges
  const r = (await client.query(`INSERT INTO badges (certificate_id, name, color, slot) VALUES ($1, 'ACES Rated', null, 1) RETURNING id`, [certId])).rows[0].id;
  const v = (await client.query(`INSERT INTO badges (certificate_id, name, color, slot) VALUES ($1, 'ACES Verified', null, 2) RETURNING id`, [certId])).rows[0].id;
  const c = (await client.query(`INSERT INTO badges (certificate_id, name, color, slot) VALUES ($1, 'ACES Certified', null, 3) RETURNING id`, [certId])).rows[0].id;

  for (const bid of [r, v, c]) {
    await client.query(`INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1, '#CD7F32', 30, 64)`, [bid]);
    await client.query(`INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1, '#C0C0C0', 65, 79)`, [bid]);
    await client.query(`INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1, '#FFD700', 80, 89)`, [bid]);
    await client.query(`INSERT INTO badge_colors (badge_id, color, min_score, max_score) VALUES ($1, '#00C853', 90, 100)`, [bid]);
  }

  let n = 1;
  for (let mi = 0; mi < cert.mainSections.length; mi++) {
    const ms = cert.mainSections[mi];
    const msId = (await client.query(`INSERT INTO main_section (certificate_id, name, rank) VALUES ($1, $2, $3) RETURNING id`, [certId, ms.name, mi + 1])).rows[0].id;
    for (let si = 0; si < ms.sections.length; si++) {
      const sec = ms.sections[si];
      const secId = (await client.query(`INSERT INTO sections (certificate_id, main_id, name, rank) VALUES ($1, $2, $3, $4) RETURNING id`, [certId, msId, sec.name, si + 1])).rows[0].id;
      for (let qi = 0; qi < sec.questions.length; qi++) {
        const q = sec.questions[qi];
        await client.query(
          `INSERT INTO questions (certificate_id, main_section_id, section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint, options)
           VALUES ($1, $2, $3, $4, $5, $6, $7, false, $6, $8, $9, $10::jsonb)`,
          [certId, msId, secId, q.q, q.type, qi + 1, q.w, n++, q.hint || null, q.options ? JSON.stringify(q.options) : null]
        );
      }
    }
  }
  return { certId, name: cert.name, code: cert.code, questions: n - 1 };
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const cert of CERTS) {
      const r = await createCert(client, cert);
      console.log(`  ${r.code} | ${r.name} | ${r.questions}q | ${r.certId}`);
    }
    await client.query('COMMIT');
    console.log('\nDone! 4 certificates created.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
