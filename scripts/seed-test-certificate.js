require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const certRes = await client.query(
      `INSERT INTO certificates (certificate_id, name, description, disclosure_price, assured_price, is_published, industry_ids)
       VALUES ('TEST-EASY-001', 'Workplace Safety Basics', 'A basic workplace safety assessment designed for testing.', 50, 100, true, '{}')
       RETURNING id`
    );
    const certId = certRes.rows[0].id;

    const ms1 = (await client.query(
      `INSERT INTO main_section (certificate_id, name, rank) VALUES ($1, 'General Safety', 1) RETURNING id`, [certId]
    )).rows[0].id;

    const ms2 = (await client.query(
      `INSERT INTO main_section (certificate_id, name, rank) VALUES ($1, 'Emergency Preparedness', 2) RETURNING id`, [certId]
    )).rows[0].id;

    const s1 = (await client.query(
      `INSERT INTO sections (certificate_id, main_id, name, rank) VALUES ($1, $2, 'Workplace Hazards', 1) RETURNING id`, [certId, ms1]
    )).rows[0].id;

    const s2 = (await client.query(
      `INSERT INTO sections (certificate_id, main_id, name, rank) VALUES ($1, $2, 'Personal Protective Equipment', 2) RETURNING id`, [certId, ms1]
    )).rows[0].id;

    const s3 = (await client.query(
      `INSERT INTO sections (certificate_id, main_id, name, rank) VALUES ($1, $2, 'Fire Safety', 1) RETURNING id`, [certId, ms2]
    )).rows[0].id;

    const s4 = (await client.query(
      `INSERT INTO sections (certificate_id, main_id, name, rank) VALUES ($1, $2, 'First Aid', 2) RETURNING id`, [certId, ms2]
    )).rows[0].id;

    const ss1 = (await client.query(
      `INSERT INTO sub_section (certificate_id, section_id, main_id, name, rank) VALUES ($1, $2, $3, 'Fire Extinguishers', 1) RETURNING id`, [certId, s3, ms2]
    )).rows[0].id;

    const ss2 = (await client.query(
      `INSERT INTO sub_section (certificate_id, section_id, main_id, name, rank) VALUES ($1, $2, $3, 'Evacuation Procedures', 2) RETURNING id`, [certId, s3, ms2]
    )).rows[0].id;

    let n = 1;

    // S1: Workplace Hazards (4 Qs)
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint, conditions)
       VALUES ($1, $2, $3, 'Are workplace hazards regularly identified and documented?', 'boolean', 1, 1, false, 1, $4, 'Answer Yes if you have a hazard identification process', $5::jsonb)`,
      [certId, ms1, s1, n++, JSON.stringify({ yes: { redirect_type: 'section', target_id: s2, target_name: 'Personal Protective Equipment' }, no: null })]
    );
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint)
       VALUES ($1, $2, $3, 'List the main workplace hazards in your facility.', 'text', 2, 1, false, 2, $4, 'Include physical, chemical, and ergonomic hazards')`,
      [certId, ms1, s1, n++]
    );
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint)
       VALUES ($1, $2, $3, 'Rate your organizations hazard reporting culture (1-5).', 'rating', 3, 1, false, 3, $4, '1=Poor, 5=Excellent')`,
      [certId, ms1, s1, n++]
    );
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint)
       VALUES ($1, $2, $3, 'How many safety incidents were reported last year?', 'number', 4, 1, false, 4, $4, 'Enter 0 if none')`,
      [certId, ms1, s1, n++]
    );

    // S2: PPE (3 Qs)
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint)
       VALUES ($1, $2, $3, 'Is PPE provided to all employees free of charge?', 'boolean', 1, 2, false, 1, $4, 'PPE includes helmets, gloves, goggles, etc.')`,
      [certId, ms1, s2, n++]
    );
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint, options)
       VALUES ($1, $2, $3, 'How often is PPE inspected?', 'multiple_choice', 2, 1, false, 2, $4, 'Select the most accurate option', $5::jsonb)`,
      [certId, ms1, s2, n++, JSON.stringify(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Annually'])]
    );
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint, options)
       VALUES ($1, $2, $3, 'Which types of PPE are provided?', 'checkbox', 3, 1, false, 3, $4, 'Select all that apply', $5::jsonb)`,
      [certId, ms1, s2, n++, JSON.stringify(['Hard hats', 'Safety goggles', 'Gloves', 'High-visibility vests', 'Steel-toe boots', 'Ear protection'])]
    );

    // SS1: Fire Extinguishers (3 Qs, third-level)
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, sub_section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint, conditions)
       VALUES ($1, $2, $3, $4, 'Are fire extinguishers available on every floor?', 'boolean', 1, 2, true, 1, $5, 'Check all floors including basement', $6::jsonb)`,
      [certId, ms2, s3, ss1, n++, JSON.stringify({ yes: null, no: { redirect_type: 'sub_section', target_id: ss2, target_name: 'Evacuation Procedures' } })]
    );
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, sub_section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint)
       VALUES ($1, $2, $3, $4, 'How many fire extinguishers are installed?', 'number', 2, 1, true, 2, $5, 'Count all types')`,
      [certId, ms2, s3, ss1, n++]
    );
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, sub_section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint)
       VALUES ($1, $2, $3, $4, 'When were fire extinguishers last serviced?', 'text', 3, 1, true, 3, $5, 'Provide month and year')`,
      [certId, ms2, s3, ss1, n++]
    );

    // SS2: Evacuation (3 Qs, third-level)
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, sub_section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint)
       VALUES ($1, $2, $3, $4, 'Is there a documented evacuation plan?', 'boolean', 1, 2, true, 1, $5, 'Must be posted in visible areas')`,
      [certId, ms2, s3, ss2, n++]
    );
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, sub_section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint)
       VALUES ($1, $2, $3, $4, 'Rate the clarity of evacuation signage (1-5).', 'rating', 2, 1, true, 2, $5, '1=Not visible, 5=Very clear')`,
      [certId, ms2, s3, ss2, n++]
    );
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, sub_section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint)
       VALUES ($1, $2, $3, $4, 'How many fire drills were conducted last year?', 'number', 3, 1, true, 3, $5, 'Enter 0 if none')`,
      [certId, ms2, s3, ss2, n++]
    );

    // S4: First Aid (2 Qs)
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint)
       VALUES ($1, $2, $3, 'Are first aid kits available and stocked?', 'boolean', 1, 2, false, 1, $4, 'Check expiry dates of supplies')`,
      [certId, ms2, s4, n++]
    );
    await client.query(
      `INSERT INTO questions (certificate_id, main_section_id, section_id, question, type, rank, weightage, is_third_level, question_number, certificate_question_number, hint)
       VALUES ($1, $2, $3, 'How many employees are first-aid trained?', 'number', 2, 1, false, 2, $4, 'Include certified first responders')`,
      [certId, ms2, s4, n++]
    );

    await client.query('COMMIT');

    console.log('\n=== CERTIFICATE CREATED ===');
    console.log('ID:', certId);
    console.log('Code: TEST-EASY-001');
    console.log('Name: Workplace Safety Basics');
    console.log('Questions: 15');
    console.log('\nStructure:');
    console.log('  General Safety');
    console.log('    Workplace Hazards: Q1(bool+jump) Q2(text) Q3(rating) Q4(number)');
    console.log('    PPE: Q5(bool) Q6(multiple_choice) Q7(checkbox)');
    console.log('  Emergency Preparedness');
    console.log('    Fire Safety');
    console.log('      Fire Extinguishers: Q8(bool+jump) Q9(number) Q10(text)');
    console.log('      Evacuation: Q11(bool) Q12(rating) Q13(number)');
    console.log('    First Aid: Q14(bool) Q15(number)');
    console.log('\nJumps:');
    console.log('  Q1 Yes -> PPE section | Q1 No -> continue Q2-Q4');
    console.log('  Q8 No -> Evacuation sub | Q8 Yes -> continue Q9-Q10');

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
