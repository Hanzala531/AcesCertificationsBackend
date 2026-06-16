require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const CERTIFICATES = [
  {
    code: 'ACES-EASY-NOFILE-001',
    name: 'ACES Easy Compliance Starter',
    description:
      'A straightforward self-disclosure certificate with no document upload questions. It is designed for clean test runs and simple completion paths.',
    disclosurePrice: 40,
    assuredPrice: 80,
    validityYears: 1,
    badges: [
      {
        slot: 1,
        name: 'ACES Rated',
        colors: [
          { color: '#CD7F32', min_score: 60, max_score: 74 },
          { color: '#C0C0C0', min_score: 75, max_score: 89 },
          { color: '#FFD700', min_score: 90, max_score: 100 },
        ],
      },
      {
        slot: 2,
        name: 'ACES Verified',
        colors: [
          { color: '#CD7F32', min_score: 60, max_score: 74 },
          { color: '#C0C0C0', min_score: 75, max_score: 89 },
          { color: '#FFD700', min_score: 90, max_score: 100 },
        ],
      },
      {
        slot: 3,
        name: 'ACES Certified',
        colors: [
          { color: '#C0C0C0', min_score: 75, max_score: 89 },
          { color: '#FFD700', min_score: 90, max_score: 100 },
        ],
      },
    ],
    mainSections: [
      {
        name: 'Operational Controls',
        sections: [
          {
            name: 'Governance Basics',
            questions: [
              {
                question:
                  'Do you maintain a written compliance or operations policy for this site?',
                type: 'boolean',
                weightage: 3,
                hint: 'Answer yes when a current written policy exists.',
              },
              {
                question:
                  'How often is management compliance performance reviewed?',
                type: 'multiple_choice',
                weightage: 2,
                hint: 'Pick the closest review frequency.',
                options: ['Weekly', 'Monthly', 'Quarterly', 'Biannually'],
              },
              {
                question:
                  'Which operational controls are actively implemented today?',
                type: 'checkbox',
                weightage: 2,
                hint: 'Select all controls that are actually in use.',
                options: [
                  'Daily inspections',
                  'Corrective action tracking',
                  'Supervisor sign-off',
                  'Incident logging',
                  'Escalation workflow',
                ],
              },
            ],
          },
          {
            name: 'Monitoring',
            questions: [
              {
                question:
                  'Do you track routine compliance KPIs for this location?',
                type: 'boolean',
                weightage: 3,
                hint: 'Examples: completion rate, incidents, findings, closures.',
              },
              {
                question:
                  'How many internal checks or inspections were completed in the last 12 months?',
                type: 'number',
                weightage: 2,
                hint: 'Enter a whole number.',
              },
              {
                question:
                  'Rate the maturity of your internal monitoring process from 1 to 5.',
                type: 'rating',
                weightage: 1,
                hint: '1 = very basic, 5 = very mature.',
              },
            ],
          },
        ],
      },
      {
        name: 'Team Readiness',
        sections: [
          {
            name: 'People & Training',
            questions: [
              {
                question:
                  'Are team members briefed on the key compliance expectations relevant to their roles?',
                type: 'boolean',
                weightage: 3,
                hint: 'Answer yes when onboarding or routine briefings cover this.',
              },
              {
                question:
                  'How many people at this site received refresher training in the last year?',
                type: 'number',
                weightage: 2,
                hint: 'Enter the total count.',
              },
              {
                question:
                  'Which training formats are currently used for staff readiness?',
                type: 'checkbox',
                weightage: 1,
                hint: 'Select all formats that are used consistently.',
                options: [
                  'In-person sessions',
                  'Toolbox talks',
                  'Digital learning',
                  'Manager coaching',
                ],
              },
            ],
          },
          {
            name: 'Issue Response',
            questions: [
              {
                question:
                  'Is there a defined process for reporting and closing operational issues?',
                type: 'boolean',
                weightage: 3,
                hint: 'Answer yes when issues are logged, assigned, and closed.',
              },
              {
                question:
                  'What is the usual target timeline for closing routine findings?',
                type: 'multiple_choice',
                weightage: 2,
                hint: 'Pick the standard turnaround expectation.',
                options: [
                  'Within 24 hours',
                  'Within 7 days',
                  'Within 30 days',
                  'No formal target',
                ],
              },
              {
                question:
                  'Rate your team response discipline from 1 to 5.',
                type: 'rating',
                weightage: 1,
                hint: '1 = weak follow-up, 5 = consistent and timely follow-up.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    code: 'ACES-ALL-TYPES-001',
    name: 'ACES Full Question Type Showcase',
    description:
      'A published certificate covering every supported question type, including nested boolean sub-questions and a file upload question.',
    disclosurePrice: 60,
    assuredPrice: 120,
    validityYears: 1,
    badges: [
      {
        slot: 1,
        name: 'ACES Rated',
        colors: [
          { color: '#CD7F32', min_score: 60, max_score: 74 },
          { color: '#C0C0C0', min_score: 75, max_score: 89 },
          { color: '#FFD700', min_score: 90, max_score: 100 },
        ],
      },
      {
        slot: 2,
        name: 'ACES Verified',
        colors: [
          { color: '#CD7F32', min_score: 60, max_score: 74 },
          { color: '#C0C0C0', min_score: 75, max_score: 89 },
          { color: '#FFD700', min_score: 90, max_score: 100 },
        ],
      },
      {
        slot: 3,
        name: 'ACES Certified',
        colors: [
          { color: '#C0C0C0', min_score: 75, max_score: 89 },
          { color: '#FFD700', min_score: 90, max_score: 100 },
        ],
      },
    ],
    mainSections: [
      {
        name: 'Core Compliance',
        sections: [
          {
            name: 'Policy Controls',
            questions: [
              {
                question:
                  'Do you have a formal site policy covering operational compliance?',
                type: 'boolean',
                weightage: 3,
                hint: 'Answer yes when the policy exists and is current.',
                yes_sub_questions: [
                  {
                    question:
                      'Briefly summarize the most important policy controls that are enforced.',
                    type: 'text',
                    weightage: 2,
                    hint: 'A short operational summary is enough.',
                  },
                ],
                no_sub_questions: [
                  {
                    question:
                      'What is the expected month for publishing the first site policy?',
                    type: 'multiple_choice',
                    weightage: 1,
                    hint: 'Choose the closest milestone.',
                    options: ['This month', 'Next month', 'This quarter', 'No date set'],
                  },
                ],
              },
              {
                question:
                  'How many formal compliance reviews were completed last year?',
                type: 'number',
                weightage: 2,
                hint: 'Enter a whole number.',
              },
            ],
          },
          {
            name: 'Evidence & Records',
            questions: [
              {
                question:
                  'Upload a sample compliance record or supporting document.',
                type: 'file',
                weightage: 1,
                hint: 'A PDF sample is ideal for testing this question type.',
              },
              {
                question:
                  'Which evidence sources are retained for audit readiness?',
                type: 'checkbox',
                weightage: 2,
                hint: 'Select all evidence sources currently retained.',
                options: [
                  'Policies',
                  'Inspection logs',
                  'Training records',
                  'Corrective actions',
                  'Management reviews',
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'Performance Review',
        sections: [
          {
            name: 'Measurement',
            questions: [
              {
                question:
                  'Rate the maturity of your performance reporting process from 1 to 5.',
                type: 'rating',
                weightage: 2,
                hint: '1 = ad hoc, 5 = mature and consistent.',
              },
              {
                question:
                  'What reporting cadence best matches your current performance review process?',
                type: 'multiple_choice',
                weightage: 2,
                hint: 'Pick the standard cadence.',
                options: ['Weekly', 'Monthly', 'Quarterly', 'Semi-annually'],
              },
            ],
          },
          {
            name: 'Narrative Assessment',
            subSections: [
              {
                name: 'Improvement Planning',
                questions: [
                  {
                    question:
                      'Describe the main improvement priority for the next review cycle.',
                    type: 'text',
                    weightage: 2,
                    hint: 'One clear paragraph is enough.',
                  },
                  {
                    question:
                      'Do you track owner and due date for each improvement action?',
                    type: 'boolean',
                    weightage: 2,
                    hint: 'Answer yes when actions are assigned and tracked.',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

async function query(client, sql, params = []) {
  return client.query(sql, params);
}

async function getIndustryIds(client) {
  const result = await query(client, 'SELECT id FROM industry ORDER BY name');
  return result.rows.map((row) => row.id);
}

async function getCreatorId(client) {
  const result = await query(
    client,
    `SELECT id
       FROM users
      WHERE role IN ('admin', 'subadmin')
      ORDER BY created_at ASC
      LIMIT 1`,
  );
  return result.rows[0]?.id || null;
}

async function deleteExistingCertificates(client, certificateCodes) {
  await query(
    client,
    `DELETE FROM certificates
      WHERE certificate_id = ANY($1::text[])`,
    [certificateCodes],
  );
}

async function insertCertificate(client, definition, industryIds, createdBy) {
  const result = await query(
    client,
    `INSERT INTO certificates (
       certificate_id,
       name,
       description,
       industry_ids,
       disclosure_price,
       assured_price,
       validity_days,
       validity_months,
       validity_years,
       compulsory_docs,
       is_published,
       created_by,
       updated_by
     )
     VALUES ($1, $2, $3, $4::uuid[], $5, $6, 0, 0, $7, $8, true, $9, $9)
     RETURNING id`,
    [
      definition.code,
      definition.name,
      definition.description,
      industryIds,
      definition.disclosurePrice,
      definition.assuredPrice,
      definition.validityYears || 1,
      definition.compulsoryDocs || null,
      createdBy,
    ],
  );

  return result.rows[0].id;
}

async function insertBadgeSet(client, certificateDbId, badges) {
  for (const badge of badges) {
    const badgeResult = await query(
      client,
      `INSERT INTO badges (certificate_id, slot, name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [certificateDbId, badge.slot, badge.name],
    );

    const badgeId = badgeResult.rows[0].id;
    for (const color of badge.colors) {
      await query(
        client,
        `INSERT INTO badge_colors (badge_id, color, min_score, max_score)
         VALUES ($1, $2, $3, $4)`,
        [badgeId, color.color, color.min_score, color.max_score],
      );
    }
  }
}

async function insertQuestion(
  client,
  {
    certificateId,
    mainSectionId,
    sectionId,
    subSectionId = null,
    question,
    isThirdLevel,
    parentQuestionId = null,
    parentTriggerValue = null,
    rank,
    parentLocalNumber,
    certificateQuestionNumber,
  },
) {
  const result = await query(
    client,
    `INSERT INTO questions (
       certificate_id,
       main_section_id,
       section_id,
       sub_section_id,
       question,
       hint,
       type,
       is_third_level,
       criteria,
       options,
       rank,
       weightage,
       question_number,
       certificate_question_number,
       parent_question_id,
       parent_trigger_value
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9, $10::jsonb, $11, $12, $13, $14, $15, $16
     )
     RETURNING id`,
    [
      certificateId,
      mainSectionId,
      sectionId,
      subSectionId,
      question.question,
      question.hint || null,
      question.type,
      isThirdLevel,
      question.criteria || null,
      question.options ? JSON.stringify(question.options) : null,
      rank,
      question.weightage || 1,
      parentLocalNumber,
      certificateQuestionNumber,
      parentQuestionId,
      parentTriggerValue,
    ],
  );

  return result.rows[0].id;
}

async function insertQuestionTree(
  client,
  ctx,
  questions,
  counters,
  parentQuestionId = null,
  parentTriggerValue = null,
) {
  for (const question of questions) {
    const questionId = await insertQuestion(client, {
      ...ctx,
      question,
      parentQuestionId,
      parentTriggerValue,
      rank: counters.rank++,
      parentLocalNumber: counters.local++,
      certificateQuestionNumber: counters.global++,
    });

    if (
      Array.isArray(question.yes_sub_questions) &&
      question.yes_sub_questions.length > 0
    ) {
      await insertQuestionTree(
        client,
        ctx,
        question.yes_sub_questions,
        counters,
        questionId,
        'yes',
      );
    }

    if (
      Array.isArray(question.no_sub_questions) &&
      question.no_sub_questions.length > 0
    ) {
      await insertQuestionTree(
        client,
        ctx,
        question.no_sub_questions,
        counters,
        questionId,
        'no',
      );
    }
  }
}

async function insertStructure(client, certificateId, mainSections) {
  let totalQuestions = 0;

  for (let mainIndex = 0; mainIndex < mainSections.length; mainIndex += 1) {
    const mainSection = mainSections[mainIndex];
    const mainResult = await query(
      client,
      `INSERT INTO main_section (certificate_id, name, rank)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [certificateId, mainSection.name, mainIndex + 1],
    );
    const mainSectionId = mainResult.rows[0].id;

    for (let sectionIndex = 0; sectionIndex < mainSection.sections.length; sectionIndex += 1) {
      const section = mainSection.sections[sectionIndex];
      const sectionResult = await query(
        client,
        `INSERT INTO sections (certificate_id, main_id, name, rank)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [certificateId, mainSectionId, section.name, sectionIndex + 1],
      );
      const sectionId = sectionResult.rows[0].id;

      const sectionCounters = { rank: 1, local: 1, global: totalQuestions + 1 };

      if (Array.isArray(section.questions) && section.questions.length > 0) {
        await insertQuestionTree(
          client,
          {
            certificateId,
            mainSectionId,
            sectionId,
            subSectionId: null,
            isThirdLevel: false,
          },
          section.questions,
          sectionCounters,
        );
      }

      if (Array.isArray(section.subSections) && section.subSections.length > 0) {
        for (let subIndex = 0; subIndex < section.subSections.length; subIndex += 1) {
          const subSection = section.subSections[subIndex];
          const subResult = await query(
            client,
            `INSERT INTO sub_section (certificate_id, main_id, section_id, name, rank)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [certificateId, mainSectionId, sectionId, subSection.name, subIndex + 1],
          );
          const subSectionId = subResult.rows[0].id;

          const subCounters = { rank: 1, local: 1, global: sectionCounters.global };
          await insertQuestionTree(
            client,
            {
              certificateId,
              mainSectionId,
              sectionId,
              subSectionId,
              isThirdLevel: true,
            },
            subSection.questions || [],
            subCounters,
          );
          sectionCounters.global = subCounters.global;
        }
      }

      totalQuestions = sectionCounters.global - 1;
    }
  }

  return totalQuestions;
}

async function createCertificateBundle(client, definition, industryIds, createdBy) {
  const certificateId = await insertCertificate(
    client,
    definition,
    industryIds,
    createdBy,
  );
  await insertBadgeSet(client, certificateId, definition.badges);
  const totalQuestions = await insertStructure(
    client,
    certificateId,
    definition.mainSections,
  );

  return {
    id: certificateId,
    code: definition.code,
    name: definition.name,
    totalQuestions,
  };
}

async function run() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const industryIds = await getIndustryIds(client);
    if (industryIds.length === 0) {
      throw new Error('No industries found in DB. Seed at least one industry first.');
    }

    const createdBy = await getCreatorId(client);
    await deleteExistingCertificates(
      client,
      CERTIFICATES.map((certificate) => certificate.code),
    );

    const created = [];
    for (const certificate of CERTIFICATES) {
      created.push(
        await createCertificateBundle(client, certificate, industryIds, createdBy),
      );
    }

    await client.query('COMMIT');

    console.log('\nCreated certificates:');
    for (const certificate of created) {
      console.log(
        `- ${certificate.code} | ${certificate.name} | ${certificate.totalQuestions} questions | ${certificate.id}`,
      );
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('FAILED:', error.message);
  process.exit(1);
});
