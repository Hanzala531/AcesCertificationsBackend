/**
 * Recalculate hierarchical short codes for existing certificates.
 *
 * Usage:
 *   node scripts/backfill-certificate-short-codes.js
 *   node scripts/backfill-certificate-short-codes.js <certificate-uuid>
 *
 * Safe to run repeatedly.
 */
const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const certificateId = process.argv[2] || null;

async function recalculateCertificate(client, id) {
  await client.query('BEGIN');

  try {
    await client.query(`UPDATE questions SET short_code = NULL WHERE certificate_id = $1`, [id]);
    await client.query(`UPDATE sub_section SET short_code = NULL WHERE certificate_id = $1`, [id]);
    await client.query(`UPDATE sections SET short_code = NULL WHERE certificate_id = $1`, [id]);
    await client.query(`UPDATE main_section SET short_code = NULL WHERE certificate_id = $1`, [id]);

    const mainSections = await client.query(
      `UPDATE main_section ms
       SET short_code = c.short_code || ms.rank::text,
           updated_at = NOW()
       FROM certificates c
       WHERE ms.certificate_id = c.id
         AND ms.certificate_id = $1
         AND c.short_code IS NOT NULL
         AND ms.rank IS NOT NULL
       RETURNING ms.id, ms.short_code`,
      [id],
    );

    const sections = await client.query(
      `UPDATE sections s
       SET short_code = ms.short_code || '.' || s.rank::text,
           updated_at = NOW()
       FROM main_section ms
       WHERE s.main_id = ms.id
         AND s.certificate_id = $1
         AND ms.short_code IS NOT NULL
         AND s.rank IS NOT NULL
       RETURNING s.id, s.short_code`,
      [id],
    );

    const subSections = await client.query(
      `UPDATE sub_section ss
       SET short_code = s.short_code || '.' || ss.rank::text,
           updated_at = NOW()
       FROM sections s
       WHERE ss.section_id = s.id
         AND ss.certificate_id = $1
         AND s.short_code IS NOT NULL
         AND ss.rank IS NOT NULL
       RETURNING ss.id, ss.short_code`,
      [id],
    );

    const sectionQuestions = await client.query(
      `UPDATE questions q
       SET short_code = s.short_code || '.0.' || q.question_number::text,
           updated_at = NOW()
       FROM sections s
       WHERE q.section_id = s.id
         AND q.certificate_id = $1
         AND q.is_third_level = FALSE
         AND q.parent_question_id IS NULL
         AND s.short_code IS NOT NULL
         AND q.question_number IS NOT NULL
       RETURNING q.id, q.short_code`,
      [id],
    );

    const subSectionQuestions = await client.query(
      `UPDATE questions q
       SET short_code = s.short_code || '.' || ss.rank::text || '.' || q.question_number::text,
           updated_at = NOW()
       FROM sub_section ss
       JOIN sections s ON s.id = ss.section_id
       WHERE q.sub_section_id = ss.id
         AND q.certificate_id = $1
         AND q.is_third_level = TRUE
         AND q.parent_question_id IS NULL
         AND s.short_code IS NOT NULL
         AND ss.rank IS NOT NULL
         AND q.question_number IS NOT NULL
       RETURNING q.id, q.short_code`,
      [id],
    );

    await client.query('COMMIT');

    return {
      mainSections: mainSections.rowCount,
      sections: sections.rowCount,
      subSections: subSections.rowCount,
      sectionQuestions: sectionQuestions.rowCount,
      subSectionQuestions: subSectionQuestions.rowCount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set in .env');

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const certificates = certificateId
      ? await client.query(
          `SELECT id, short_code, name
           FROM certificates
           WHERE id = $1`,
          [certificateId],
        )
      : await client.query(
          `SELECT id, short_code, name
           FROM certificates
           WHERE short_code IS NOT NULL
           ORDER BY name ASC`,
        );

    if (certificates.rowCount === 0) {
      console.log('No matching certificates found.');
      return;
    }

    console.log(`Found ${certificates.rowCount} certificate(s) to recalculate.`);

    for (const certificate of certificates.rows) {
      const result = await recalculateCertificate(client, certificate.id);
      console.log(
        [
          `- ${certificate.name}`,
          `(${certificate.id})`,
          `[root=${certificate.short_code}]`,
          `main=${result.mainSections}`,
          `section=${result.sections}`,
          `sub=${result.subSections}`,
          `section_q=${result.sectionQuestions}`,
          `sub_q=${result.subSectionQuestions}`,
        ].join(' '),
      );
    }

    console.log('Certificate short code backfill completed successfully.');
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
