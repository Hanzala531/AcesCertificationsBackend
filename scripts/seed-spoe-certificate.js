/**
 * seed-spoe-certificate.js
 * ----------------------------------------------------------------------------
 * Completes the "Standardized Protocols and Operational Excellence" (SPOE)
 * certificate by wiping its current section structure and rebuilding a full,
 * properly-coded one.
 *
 * Demonstrates the full question feature set:
 *   - Depth: main_section -> sections -> sub_section, with questions at BOTH
 *     the section level (2nd level) and the sub-section level (3rd level).
 *   - Document questions  (type 'file')
 *   - Boolean questions with conditional_logic:
 *       • redirect_to a sub-section  (yes branch)
 *       • redirect_to a specific question (by code)  (no branch)
 *       • blocked_sections — disable a section  (block)
 *       • allowed_sections — enable a section   (enable)
 *   - Nested yes/no sub-questions under a boolean question.
 *   - text / number / rating / multiple_choice questions for variety.
 *   - AI review enabled (with criteria + score) on the questions AI can judge.
 *
 * The conditional_logic JSON matches the canonical shape enforced by
 * add-questions.dto.ts and produced by the create-certification UI:
 *   { yes?: { redirect_to?, blocked_sections?, allowed_sections? }, no?: {...} }
 *   target_type ∈ main_section | section | sub_section | question ; target_id = UUID
 *
 * Idempotent: re-running deletes and rebuilds the same structure.
 *
 * Usage:  node scripts/seed-spoe-certificate.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const CERT_ID = '48759ba4-9819-4fbe-bc27-9d047fe2410e';

// ── Question factory ─────────────────────────────────────────────────────────
// `ref` strings for conditional targets:
//   "M1 > Records Management"                      -> a section/sub-section path
//   "question:Q_capa"                              -> a question captured by key
function q(question, type, extra = {}) {
  return {
    key: extra.key || null,
    question,
    type,
    hint: extra.hint || `Provide the evidence needed to answer: "${question}"`,
    criteria:
      extra.criteria || 'Acceptable when documented, current and verifiable.',
    ai_review_enabled: extra.ai_review_enabled ?? true,
    ai_review_criteria:
      extra.ai_review_enabled === false
        ? null
        : extra.ai_criteria ||
          'AI verifies the supporting evidence matches the stated claim and is in date.',
    ai_review_score: extra.ai_review_enabled === false ? null : extra.ai_score ?? 10,
    yes_score: type === 'boolean' ? extra.yes_score ?? 10 : 0,
    no_score: type === 'boolean' ? extra.no_score ?? 0 : 0,
    score: extra.score ?? 5,
    is_compulsory: extra.is_compulsory ?? false,
    options: extra.options || null,
    conditional: extra.conditional || null, // { yes?: {...}, no?: {...} }
    children: extra.children || null, // { yes: [q...], no: [q...] }
  };
}
const qBool = (t, e) => q(t, 'boolean', e);
const qText = (t, e) => q(t, 'text', e);
const qNumber = (t, e) => q(t, 'number', e);
const qRating = (t, e) => q(t, 'rating', e);
const qFile = (t, e) => q(t, 'file', e); // document upload
const qChoice = (t, options, e) => q(t, 'multiple_choice', { ...e, options });

// ── Structure ────────────────────────────────────────────────────────────────
const STRUCTURE = [
  {
    name: 'Quality Management System',
    sections: [
      {
        name: 'Documentation Control',
        // Section-level questions (live directly under the section)
        questions: [
          qBool(
            'Is there a documented quality manual covering all core processes?',
            {
              is_compulsory: true,
              criteria: 'A controlled, version-stamped quality manual exists.',
              // YES -> jump straight into the Document Approval sub-section.
              // NO  -> disable the Records Management section for this applicant.
              conditional: {
                yes: {
                  redirectTo:
                    'Quality Management System > Documentation Control > Document Approval',
                },
                no: {
                  block: 'Quality Management System > Records Management',
                },
              },
              children: {
                yes: [
                  qText('List the processes the quality manual covers.', {
                    score: 3,
                  }),
                ],
                no: [
                  qText('Explain how processes are governed without a manual.', {
                    score: 2,
                  }),
                ],
              },
            },
          ),
          qFile('Upload the current controlled quality manual (PDF).', {
            is_compulsory: true,
            criteria: 'Document is the latest approved revision.',
          }),
        ],
        sub_sections: [
          {
            name: 'Document Approval',
            questions: [
              qBool('Are documents reviewed and approved before issue?', {
                is_compulsory: true,
              }),
              qFile('Upload the document approval / authority matrix.', {
                criteria: 'Matrix names approvers and effective dates.',
              }),
              qText('Describe your document review and revision cycle.', {
                score: 4,
              }),
            ],
          },
        ],
      },
      {
        name: 'Records Management',
        sub_sections: [
          {
            name: 'Retention & Backup',
            questions: [
              qNumber('For how many months are quality records retained?', {
                hint: 'State the minimum retention period in months.',
                score: 4,
                ai_review_enabled: false,
              }),
              qBool('Are quality records backed up to an off-site location?', {
                is_compulsory: true,
                // NO -> send the applicant to the CAPA question to capture risk handling.
                conditional: {
                  no: { redirectTo: 'question:Q_capa' },
                },
              }),
              qFile('Upload your records retention schedule.', { score: 5 }),
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Operational Excellence',
    sections: [
      {
        name: 'Process Control',
        questions: [
          qBool(
            'Is there a documented procedure for each critical process?',
            { is_compulsory: true },
          ),
        ],
        sub_sections: [
          {
            name: 'Monitoring & Measurement',
            questions: [
              qBool(
                'Are key process parameters monitored against defined limits?',
                {
                  // YES -> make sure the Continuous Improvement section is enabled.
                  conditional: {
                    yes: {
                      enable: 'Operational Excellence > Continuous Improvement',
                    },
                  },
                },
              ),
              qRating('Rate the maturity of your process monitoring (1-5).', {
                score: 5,
                ai_review_enabled: false,
              }),
              qFile('Upload a representative process control record.', {
                score: 5,
              }),
            ],
          },
        ],
      },
      {
        name: 'Continuous Improvement',
        sub_sections: [
          {
            name: 'Audits & CAPA',
            questions: [
              qBool(
                'Is a corrective & preventive action (CAPA) process in place?',
                {
                  key: 'Q_capa',
                  is_compulsory: true,
                  // NO -> disable Process Control (can't be operationally excellent
                  // without CAPA) to illustrate a cross-section block.
                  conditional: {
                    no: { block: 'Operational Excellence > Process Control' },
                  },
                },
              ),
              qChoice(
                'How frequently are internal audits conducted?',
                ['Monthly', 'Quarterly', 'Annually', 'Ad-hoc only'],
                { score: 6 },
              ),
              qFile('Upload the most recent internal audit report.', {
                is_compulsory: true,
                score: 6,
              }),
            ],
          },
        ],
      },
    ],
  },
];

// ── Insertion ────────────────────────────────────────────────────────────────
const targetByPath = new Map(); // path -> { id, type }
const questionIdByKey = new Map(); // key  -> question id
const conditionalQueue = []; // { id, conditional }

async function insertQuestion(client, qDef, ctx, parent) {
  const isThird = ctx.subSectionId != null;
  const rank = ctx.nextRank();
  const questionNumber = ctx.nextQuestionNumber();
  const certNumber = ctx.nextCertNumber();

  const res = await client.query(
    `INSERT INTO questions (
       certificate_id, main_section_id, section_id, sub_section_id,
       question, hint, type, is_third_level, criteria,
       ai_review_enabled, ai_review_criteria, ai_review_score,
       yes_score, no_score,
       conditional_logic_enabled, conditional_logic,
       rank, question_number, certificate_question_number,
       score, options, is_compulsory,
       parent_question_id, parent_trigger_value
     ) VALUES (
       $1,$2,$3,$4, $5,$6,$7,$8,$9, $10,$11,$12, $13,$14,
       FALSE, NULL,
       $15,$16,$17, $18,$19::jsonb,$20, $21,$22
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
      rank,
      questionNumber,
      certNumber,
      qDef.score,
      qDef.options ? JSON.stringify(qDef.options) : null,
      qDef.is_compulsory,
      parent ? parent.id : null,
      parent ? parent.trigger : null,
    ],
  );
  const id = res.rows[0].id;
  if (qDef.key) questionIdByKey.set(qDef.key, id);
  if (qDef.conditional) conditionalQueue.push({ id, conditional: qDef.conditional });

  if (qDef.children) {
    for (const trigger of ['yes', 'no']) {
      for (const child of qDef.children[trigger] || []) {
        await insertQuestion(client, child, ctx, { id, trigger });
      }
    }
  }
  return id;
}

function resolveRef(ref) {
  if (ref.startsWith('question:')) {
    const id = questionIdByKey.get(ref.slice('question:'.length));
    return id ? { target_type: 'question', target_id: id } : null;
  }
  const t = targetByPath.get(ref);
  return t ? { target_type: t.type, target_id: t.id } : null;
}

function buildConditionalLogic(spec) {
  const cl = {};
  for (const trigger of ['yes', 'no']) {
    const branch = spec[trigger];
    if (!branch) continue;
    const action = {};
    if (branch.redirectTo) {
      const r = resolveRef(branch.redirectTo);
      if (r) action.redirect_to = r;
    }
    if (branch.block) {
      const refs = Array.isArray(branch.block) ? branch.block : [branch.block];
      const resolved = refs.map(resolveRef).filter(Boolean);
      if (resolved.length) action.blocked_sections = resolved;
    }
    if (branch.enable) {
      const refs = Array.isArray(branch.enable)
        ? branch.enable
        : [branch.enable];
      const resolved = refs.map(resolveRef).filter(Boolean);
      if (resolved.length) action.allowed_sections = resolved;
    }
    if (Object.keys(action).length) cl[trigger] = action;
  }
  return Object.keys(cl).length ? cl : null;
}

async function recalcShortCodes(client, certificateId) {
  await client.query(`UPDATE questions SET short_code=NULL WHERE certificate_id=$1`, [certificateId]);
  await client.query(`UPDATE sub_section SET short_code=NULL WHERE certificate_id=$1`, [certificateId]);
  await client.query(`UPDATE sections SET short_code=NULL WHERE certificate_id=$1`, [certificateId]);
  await client.query(`UPDATE main_section SET short_code=NULL WHERE certificate_id=$1`, [certificateId]);
  await client.query(
    `UPDATE main_section ms SET short_code = c.short_code || ms.rank::text
     FROM certificates c WHERE ms.certificate_id=c.id AND ms.certificate_id=$1
       AND c.short_code IS NOT NULL AND ms.rank IS NOT NULL`, [certificateId]);
  await client.query(
    `UPDATE sections s SET short_code = ms.short_code || '.' || s.rank::text
     FROM main_section ms WHERE s.main_id=ms.id AND s.certificate_id=$1
       AND ms.short_code IS NOT NULL AND s.rank IS NOT NULL`, [certificateId]);
  await client.query(
    `UPDATE sub_section ss SET short_code = s.short_code || '.' || ss.rank::text
     FROM sections s WHERE ss.section_id=s.id AND ss.certificate_id=$1
       AND s.short_code IS NOT NULL AND ss.rank IS NOT NULL`, [certificateId]);
  await client.query(
    `UPDATE questions q SET short_code = s.short_code || '.0.' || q.question_number::text
     FROM sections s WHERE q.section_id=s.id AND q.certificate_id=$1
       AND q.is_third_level=FALSE AND q.parent_question_id IS NULL
       AND s.short_code IS NOT NULL AND q.question_number IS NOT NULL`, [certificateId]);
  await client.query(
    `UPDATE questions q SET short_code = s.short_code || '.' || ss.rank::text || '.' || q.question_number::text
     FROM sub_section ss JOIN sections s ON s.id=ss.section_id
     WHERE q.sub_section_id=ss.id AND q.certificate_id=$1
       AND q.is_third_level=TRUE AND q.parent_question_id IS NULL
       AND s.short_code IS NOT NULL AND ss.rank IS NOT NULL AND q.question_number IS NOT NULL`, [certificateId]);
  await client.query(
    `UPDATE questions q
     SET short_code = p.short_code || '.' || UPPER(LEFT(q.parent_trigger_value,1)) || q.question_number::text
     FROM questions p WHERE q.parent_question_id=p.id AND q.certificate_id=$1
       AND p.short_code IS NOT NULL`, [certificateId]);
}

async function run() {
  const client = await pool.connect();
  try {
    const cert = (
      await client.query(`SELECT short_code, name FROM certificates WHERE id=$1`, [CERT_ID])
    ).rows[0];
    if (!cert) throw new Error(`Certificate ${CERT_ID} not found`);
    console.log(`Rebuilding "${cert.name}" (${cert.short_code})`);

    await client.query('BEGIN');

    // 1. Wipe existing structure (cascades to sections, sub_section, questions).
    await client.query(`DELETE FROM main_section WHERE certificate_id=$1`, [CERT_ID]);

    // 2. Build hierarchy, capturing target paths for conditional logic.
    const built = [];
    let mainRank = 0;
    for (const main of STRUCTURE) {
      mainRank++;
      const ms = (
        await client.query(
          `INSERT INTO main_section (certificate_id, name, rank) VALUES ($1,$2,$3) RETURNING id`,
          [CERT_ID, main.name, mainRank],
        )
      ).rows[0];
      targetByPath.set(main.name, { id: ms.id, type: 'main_section' });

      let sectionRank = 0;
      for (const section of main.sections) {
        sectionRank++;
        const s = (
          await client.query(
            `INSERT INTO sections (certificate_id, main_id, name, rank) VALUES ($1,$2,$3,$4) RETURNING id`,
            [CERT_ID, ms.id, section.name, sectionRank],
          )
        ).rows[0];
        const sectionPath = `${main.name} > ${section.name}`;
        targetByPath.set(sectionPath, { id: s.id, type: 'section' });

        const subs = [];
        let subRank = 0;
        for (const sub of section.sub_sections || []) {
          subRank++;
          const ss = (
            await client.query(
              `INSERT INTO sub_section (certificate_id, main_id, section_id, name, rank) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
              [CERT_ID, ms.id, s.id, sub.name, subRank],
            )
          ).rows[0];
          targetByPath.set(`${sectionPath} > ${sub.name}`, {
            id: ss.id,
            type: 'sub_section',
          });
          subs.push({ id: ss.id, questions: sub.questions || [] });
        }

        built.push({
          mainId: ms.id,
          sectionId: s.id,
          sectionQuestions: section.questions || [],
          subs,
        });
      }
    }

    // 3. Insert questions (section-level + sub-section level), capturing keys.
    let certCounter = 0;
    const nextCertNumber = () => ++certCounter;

    for (const node of built) {
      let secRank = 0;
      let secNum = 0;
      const sectionCtx = {
        certificateId: CERT_ID,
        mainSectionId: node.mainId,
        sectionId: node.sectionId,
        subSectionId: null,
        nextRank: () => ++secRank,
        nextQuestionNumber: () => ++secNum,
        nextCertNumber,
      };
      for (const qDef of node.sectionQuestions) {
        await insertQuestion(client, qDef, sectionCtx, null);
      }

      for (const sub of node.subs) {
        let subRank = 0;
        let subNum = 0;
        const subCtx = {
          certificateId: CERT_ID,
          mainSectionId: node.mainId,
          sectionId: node.sectionId,
          subSectionId: sub.id,
          nextRank: () => ++subRank,
          nextQuestionNumber: () => ++subNum,
          nextCertNumber,
        };
        for (const qDef of sub.questions) {
          await insertQuestion(client, qDef, subCtx, null);
        }
      }
    }

    // 4. Resolve + apply conditional logic now that all ids exist.
    let conditionalApplied = 0;
    for (const item of conditionalQueue) {
      const cl = buildConditionalLogic(item.conditional);
      if (!cl) continue;
      await client.query(
        `UPDATE questions
         SET conditional_logic_enabled = TRUE, conditional_logic = $2::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [item.id, JSON.stringify(cl)],
      );
      conditionalApplied++;
    }

    // 5. Hierarchical short codes for the whole tree.
    await recalcShortCodes(client, CERT_ID);

    await client.query('COMMIT');

    const counts = (
      await client.query(
        `SELECT
           (SELECT COUNT(*) FROM main_section WHERE certificate_id=$1) mains,
           (SELECT COUNT(*) FROM sections WHERE certificate_id=$1) sections,
           (SELECT COUNT(*) FROM sub_section WHERE certificate_id=$1) subs,
           (SELECT COUNT(*) FROM questions WHERE certificate_id=$1) questions,
           (SELECT COUNT(*) FROM questions WHERE certificate_id=$1 AND type='file') file_qs,
           (SELECT COUNT(*) FROM questions WHERE certificate_id=$1 AND type='boolean') bool_qs,
           (SELECT COUNT(*) FROM questions WHERE certificate_id=$1 AND conditional_logic_enabled) cond_qs,
           (SELECT COUNT(*) FROM questions WHERE certificate_id=$1 AND parent_question_id IS NOT NULL) nested_qs`,
        [CERT_ID],
      )
    ).rows[0];
    console.log('✓ Rebuilt SPOE certificate:');
    console.log(
      `   mains=${counts.mains} sections=${counts.sections} subs=${counts.subs} questions=${counts.questions}`,
    );
    console.log(
      `   document(file)=${counts.file_qs} boolean=${counts.bool_qs} conditional=${counts.cond_qs} nested=${counts.nested_qs} (conditional applied=${conditionalApplied})`,
    );
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('FAILED, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
