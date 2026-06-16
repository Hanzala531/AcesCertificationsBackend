/**
 * Seed script — 10 certificates, ~200 questions each, all industries assigned.
 * Uses nested boolean sub-questions (parent_question_id + parent_trigger_value).
 *
 * Usage:  node scripts/seed-certificates-v2.js
 * Requires DATABASE_URL in .env
 */

require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ─── DB helpers ───────────────────────────────────────────────────────────────

const q = (c, sql, p = []) => c.query(sql, p);
const one = async (c, sql, p) => (await q(c, sql, p)).rows[0];

async function ins(c, table, cols, vals) {
  const ph = vals.map((_, i) => `$${i + 1}`).join(',');
  return one(c, `INSERT INTO ${table} (${cols}) VALUES (${ph}) RETURNING id`, vals);
}

// ─── Certificate builders ─────────────────────────────────────────────────────

async function createCert(c, allIndustryIds, data) {
  const r = await one(c,
    `INSERT INTO certificates
       (certificate_id,name,description,disclosure_price,assured_price,validity_years,
        compulsory_docs,is_published,industry_ids)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (certificate_id) DO UPDATE
       SET name=EXCLUDED.name,industry_ids=EXCLUDED.industry_ids,updated_at=NOW()
     RETURNING id`,
    [data.id, data.name, data.desc, data.price, data.assured ?? data.price * 1.5,
     data.validity ?? 1, data.docs ?? null, true, allIndustryIds]);
  return r.id;
}

async function createBadges(c, certId) {
  for (const b of [
    { slot: 1, name: 'Gold',   score: 90, color: '#FFD700', min: 90, max: 100 },
    { slot: 2, name: 'Silver', score: 75, color: '#C0C0C0', min: 75, max: 89 },
    { slot: 3, name: 'Bronze', score: 60, color: '#CD7F32', min: 60, max: 74 },
  ]) {
    const bd = await ins(c, 'badges', 'certificate_id,slot,name,score', [certId, b.slot, b.name, b.score]);
    await ins(c, 'badge_colors', 'badge_id,color,min_score,max_score', [bd.id, b.color, b.min, b.max]);
  }
}

async function createMain(c, certId, name, rank) {
  return (await ins(c, 'main_section', 'certificate_id,name,rank', [certId, name, rank])).id;
}
async function createSection(c, certId, mainId, name, rank) {
  return (await ins(c, 'sections', 'certificate_id,main_id,name,rank', [certId, mainId, name, rank])).id;
}
async function createSub(c, certId, mainId, secId, name, rank) {
  return (await ins(c, 'sub_section', 'certificate_id,main_id,section_id,name,rank', [certId, mainId, secId, name, rank])).id;
}

// ctr = { n:1, qn:{}, rank:{} }
// ctr.qn[sectionKey] tracks question_number per section/subsection
// ctr.rank[sectionKey] tracks rank per section/subsection
async function createQ(c, ctr, data) {
  const pk = data.sub ?? data.sec;
  if (!ctr.qn) ctr.qn = {};
  ctr.qn[pk] = (ctr.qn[pk] ?? 0) + 1;
  const cqn = ctr.n++;
  const r = await one(c,
    `INSERT INTO questions
       (certificate_id,main_section_id,section_id,sub_section_id,
        question,type,hint,criteria,options,rank,weightage,
        is_third_level,question_number,certificate_question_number,
        parent_question_id,parent_trigger_value)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id`,
    [
      data.cert, data.main, data.sec, data.sub ?? null,
      data.question, data.type, data.hint ?? null, data.criteria ?? null,
      data.options ? JSON.stringify(data.options) : null,
      data.rank, data.w ?? 3, !!(data.sub), ctr.qn[pk], cqn,
      data.pId ?? null, data.pVal ?? null,
    ]);
  return r.id;
}

// Shorthand factories — returns array of question defs to be inserted
// b(question, hint, criteria, yesQs[], noQs[]) → boolean with sub-questions
function b(question, hint, criteria, yesQs = [], noQs = []) {
  return { _type: 'boolean', question, hint, criteria, w: 5, yesQs, noQs };
}
function txt(question, hint, criteria, w = 3) { return { _type: 'text', question, hint, criteria, w }; }
function num(question, hint, criteria, w = 3) { return { _type: 'number', question, hint, criteria, w }; }
function fil(question, hint, criteria, w = 4) { return { _type: 'file', question, hint, criteria, w }; }
function chk(question, options, hint, w = 4) { return { _type: 'checkbox', question, options, hint, w }; }
function mc(question, options, hint, criteria, w = 4) { return { _type: 'multiple_choice', question, options, hint, criteria, w }; }

// Insert a flat list of question defs for a section/subsection
// ctr.rank[sectionKey] tracks the next available rank for that section/subsection
// so sub-questions never collide with top-level question ranks
async function insertQs(c, ctr, base, defs) {
  const rk = base.sub ?? base.sec; // rank key — unique per section or subsection
  if (!ctr.rank) ctr.rank = {};
  if (!ctr.rank[rk]) ctr.rank[rk] = 1;

  for (const def of defs) {
    if (def._type === 'boolean') {
      const myRank = ctr.rank[rk]++;
      const pId = await createQ(c, ctr, { ...base, question: def.question, type: 'boolean', hint: def.hint, criteria: def.criteria, rank: myRank, w: def.w });

      for (const [trigger, subQs] of [['yes', def.yesQs], ['no', def.noQs]]) {
        for (const sq of subQs) {
          ctr.qn[rk] = (ctr.qn[rk] ?? 0) + 1;  // shared question_number per section
          const cqn = ctr.n++;
          const sqRank = ctr.rank[rk]++;
          await one(c,
            `INSERT INTO questions
               (certificate_id,main_section_id,section_id,sub_section_id,
                question,type,hint,criteria,options,rank,weightage,
                is_third_level,question_number,certificate_question_number,
                parent_question_id,parent_trigger_value)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
            [base.cert, base.main, base.sec, base.sub ?? null,
             sq.question, sq.type ?? sq._type ?? 'text', sq.hint ?? null, sq.criteria ?? null,
             sq.options ? JSON.stringify(sq.options) : null,
             sqRank, sq.w ?? 3, !!(base.sub), ctr.qn[rk], cqn, pId, trigger]);
        }
      }
    } else {
      const myRank = ctr.rank[rk]++;
      await createQ(c, ctr, { ...base, question: def.question, type: def._type, hint: def.hint, criteria: def.criteria, options: def.options, rank: myRank, w: def.w });
    }
  }
}

// ─── 10 Certificate definitions ───────────────────────────────────────────────

async function seedAll(c, industryIds) {
  const CERTS = [

    // ── 1. Workplace Health & Safety ──────────────────────────────────────────
    {
      meta: { id: 'WHS-2026-001', name: 'Workplace Health & Safety Certificate', desc: 'Comprehensive WHS assessment covering hazard management, PPE, emergency response, and incident reporting.', price: 1200, docs: ['Safety Policy', 'Incident Register', 'Risk Assessment Register'] },
      structure: [
        { main: 'Hazard Management', sections: [
          { sec: 'Hazard Identification', qs: [
            b('Does your organisation have a documented hazard identification process?', 'Includes formal checklists or inspection schedules.', 'A written procedure must exist and be accessible to all staff.',
              [txt('Describe the process and how often it is reviewed.', 'Include frequency and responsible person.', 'Must be reviewed at least annually.')],
              [txt('What is your corrective plan and target date?', null, 'Must include a target date within 60 days.')]),
            num('How many hazards were identified in the last 12 months?', 'Enter total from your hazard register.', 'Minimum 1 recorded hazard demonstrates an active process.'),
            fil('Upload your most recent Hazard Register or Risk Assessment.', 'PDF, DOCX, or XLSX.', 'Dated within the last 12 months.'),
            mc('Who is responsible for hazard identification?', ['Safety Officer','Manager','All Employees','External Consultant'], null, 'Must not be "External Consultant" only.'),
            txt('Describe how new hazards are communicated to staff.', null, 'Must include a communication method such as toolbox talks or notices.'),
          ]},
          { sec: 'Risk Control Measures', qs: [
            b('Are controls applied using the Hierarchy of Controls?', 'Elimination → Substitution → Engineering → Administrative → PPE.', 'Evidence must be documented.',
              [txt('Provide an example of an engineering control implemented.', null, 'Must describe a specific hazard and control measure.')],
              [txt('Provide an example of any control measure currently in place.', null, 'At least one control must be documented.')]),
            mc('How often are risk control measures reviewed?', ['After every incident','Annually','Every 6 months','Never'], null, 'Must not be "Never".'),
            fil('Upload your risk control register or risk matrix.', null, 'Must be dated within 12 months.'),
            b('Are workers consulted when control measures are selected?', 'Consultation may be via safety committee or direct discussion.', 'Consultation records must be kept.',
              [txt('How are workers consulted on safety controls?', null, 'Describe the consultation method.')],
              [txt('What is your plan to involve workers in safety decisions?', null, null)]),
            num('How many risk assessments were completed in the last 12 months?', null, 'Minimum 1 per identified hazard.'),
            txt('Describe your process for reviewing controls after an incident.', null, 'Must include a post-incident review step.'),
          ]},
          { sec: 'Incident Reporting', qs: [
            b('Is there a formal incident reporting process in place?', 'Includes near-misses and dangerous occurrences.', 'Process must be documented and communicated to all staff.',
              [fil('Upload your incident report form or procedure.', null, 'Form must capture date, time, location, description, and actions.')],
              [txt('Describe your plan to implement an incident reporting process.', null, 'Must include a rollout date.')]),
            mc('Who is responsible for investigating incidents?', ['Safety Officer','Direct Manager','HR Department','All of the above'], null, null),
            b('Are incident investigations completed within 48 hours?', null, 'Investigation must be documented.',
              [txt('Describe the investigation process and typical timeframe.', null, null)],
              [txt('What prevents timely investigation and how will you address this?', null, null)]),
            chk('Which types of events trigger a formal investigation?', ['Injuries','Near-misses','Property damage','Dangerous occurrences','Psychosocial incidents'], null),
            fil('Upload an example completed incident investigation report.', null, 'Must show root cause and corrective actions.'),
          ]},
        ]},
        { main: 'Personal Protective Equipment', sections: [
          { sec: 'PPE Provision', qs: [
            b('Is appropriate PPE provided to all workers at no cost?', 'PPE must be employer-funded under WHS legislation.', 'All required PPE must be free of charge.',
              [fil('Upload PPE procurement records or delivery dockets.', null, null)],
              [txt('Why is PPE not provided and what is the corrective plan?', null, 'Non-compliance must be addressed with a documented plan.')]),
            b('Are workers trained on the correct use and limitations of PPE?', 'Training must be documented with attendance records.', null,
              [fil('Upload PPE training attendance records.', null, 'Records must be dated within the last 2 years.')],
              [txt('When will PPE training be conducted?', null, 'Must provide a scheduled date.')]),
            mc('How is PPE compliance monitored in the workplace?', ['Supervisor spot checks','Pre-start inspections','CCTV monitoring','Not monitored'], null, 'Must not be "Not monitored".'),
            num('How many PPE non-compliance events were recorded in the last 6 months?', null, null),
          ]},
          { sec: 'PPE Maintenance & Inspection', qs: [
            b('Are inspection records maintained for all reusable PPE?', 'Records should include date, condition, and inspector name.', null,
              [fil('Upload a sample PPE inspection record.', null, null)],
              [txt('Describe your plan to implement PPE inspection records.', null, null)]),
            mc('What is your process when PPE is found to be defective?', ['Remove from service immediately','Tag and quarantine','Continue use until replacement arrives','No process'], null, 'Must not be "Continue use" or "No process".'),
            b('Is there a documented PPE replacement schedule?', null, null,
              [fil('Upload the current PPE replacement schedule.', null, null)],
              [txt('When will a replacement schedule be created?', null, null)]),
            num('What is the average age (in months) of your current respiratory protection stock?', null, 'Disposable: replace per use. Reusable: inspect per manufacturer schedule.'),
          ]},
        ]},
        { main: 'Emergency Response', sections: [
          { sec: 'Fire Safety', subs: [
            { sub: 'Fire Extinguishers', qs: [
              b('Are all fire extinguishers serviced within the last 12 months?', 'Check inspection tags on each extinguisher.', 'All extinguishers must have a valid service tag.',
                [fil('Upload the most recent fire extinguisher service report.', null, null)],
                [txt('List overdue extinguishers and provide a confirmed service booking date.', null, 'Booking must be within 7 days.')]),
              mc('What type of fire suppression system is installed?', ['Sprinkler system','Gaseous suppression','Foam system','None'], null, null),
              b('Are fire extinguisher locations clearly marked and accessible?', null, null,
                [fil('Upload a site map showing extinguisher locations.', null, null)],
                [txt('Describe your plan to mark and clear extinguisher access points.', null, null)]),
            ]},
            { sub: 'Evacuation Procedures', qs: [
              b('Is an evacuation plan displayed in all work areas?', 'Plans must be posted at all exits and common areas.', null,
                [fil('Upload the evacuation plan and drill record.', null, null)],
                [txt('When will an evacuation plan be installed and a drill scheduled?', null, null)]),
              num('How many emergency exits does the facility have?', null, 'All exits must be clearly marked and unobstructed.'),
              mc('How are occupants notified in an emergency?', ['Audible alarm','Warden announcement','Text message','No formal system'], null, 'Must not be "No formal system".'),
              b('Are emergency wardens appointed and trained?', null, 'Wardens must complete warden training annually.',
                [fil('Upload warden training certificates.', null, null)],
                [txt('When will wardens be appointed and trained?', null, null)]),
            ]},
          ]},
          { sec: 'First Aid', qs: [
            b('Is there at least one trained first aid officer on site at all times?', 'Officer must hold a current First Aid certificate.', 'Certificate must not be expired.',
              [fil('Upload current First Aid certificates for all officers.', null, null)],
              [txt('Provide a plan to appoint and train a first aid officer.', null, 'Target date must be within 30 days.')]),
            b('Are first aid kits stocked, labelled, and inspected monthly?', 'Kits should be inspected and restocked monthly.', null,
              [fil('Upload a recent first aid kit inspection checklist.', null, null)],
              [txt('Describe your plan to implement monthly kit inspections.', null, null)]),
            mc('Where are first aid kits located?', ['Near all entrances','In each work area','Central location only','Unknown'], null, 'Central location only is insufficient for large facilities.'),
            num('How many first aid kits are maintained on site?', null, null),
            chk('Which items are included in your standard first aid kit?', ['Bandages','Gloves','CPR mask','Eye wash','Burn gel','Splints'], null),
          ]},
        ]},
      ],
    },

    // ── 2. Food Safety & Hygiene ──────────────────────────────────────────────
    {
      meta: { id: 'FSH-2026-001', name: 'Food Safety & Hygiene Certificate', desc: 'Assessment covering food handling, storage, temperature control, allergen management, and staff hygiene.', price: 900, docs: ['Food Safety Program','Temperature Logs','Staff Training Records'] },
      structure: [
        { main: 'Food Handling & Storage', sections: [
          { sec: 'Receiving & Storage', qs: [
            b('Are food deliveries inspected upon arrival for temperature and condition?', 'Use a probe thermometer and check packaging integrity.', 'All deliveries must be checked and recorded.',
              [fil('Upload a sample delivery inspection record from the last month.', null, null)],
              [txt('Describe your plan to implement a delivery inspection process.', null, 'Must include responsible person and target date.')]),
            mc('How are food items stored to prevent cross-contamination?', ['Raw below cooked in same fridge','Separate fridges for raw and cooked','Colour-coded containers','No separation'], null, 'Must not be "No separation".'),
            b('Is food stored off the floor and away from walls?', null, 'Minimum 15cm clearance required.',
              [fil('Upload a photo of your dry storage area.', null, null)],
              [txt('Describe corrective actions to achieve compliant storage.', null, null)]),
            chk('Which stock rotation system is used?', ['FIFO (First In First Out)','FEFO (First Expired First Out)','Date labelling','No system'], null),
            num('How many food deliveries are received per week on average?', null, null),
          ]},
          { sec: 'Temperature Control', subs: [
            { sub: 'Cold Storage', qs: [
              b('Are refrigerator temperatures logged at least twice daily?', 'Manual or automated logs accepted.', 'Temperature must be maintained at ≤5°C.',
                [fil('Upload temperature logs for the last 7 days.', null, null)],
                [txt('When will you implement twice-daily temperature logging?', null, null)]),
              num('How many refrigeration units are on site?', null, null),
              mc('What type of temperature monitoring is used?', ['Manual probe twice daily','Continuous electronic logger','Manual once daily','Not monitored'], null, 'Must not be "Not monitored".'),
              b('Are temperature monitoring devices calibrated annually?', null, 'Calibration records must be kept.',
                [fil('Upload calibration certificates for all temperature probes.', null, null)],
                [txt('When will calibration be scheduled?', null, null)]),
            ]},
            { sub: 'Hot Holding', qs: [
              b('Is hot food held at a minimum of 60°C during service?', 'Use a calibrated probe thermometer.', null,
                [fil('Upload a sample hot-holding temperature log.', null, null)],
                [txt('Describe your corrective plan to achieve safe hot-holding temperatures.', null, null)]),
              txt('Describe your process for disposing of food that has dropped below safe temperature.', null, 'Must include a time/temperature threshold and disposal method.'),
              num('What is the maximum time hot food is held before service begins?', 'Answer in minutes.', null),
            ]},
          ]},
        ]},
        { main: 'Staff Hygiene & Training', sections: [
          { sec: 'Personal Hygiene', qs: [
            b('Do all food handlers follow a documented hand-washing procedure?', 'Procedure must be posted at all hand-washing stations.', 'WHO 6-step technique or equivalent.',
              [fil('Upload your hand-washing procedure document or poster.', null, null)],
              [txt('When will you implement and display a hand-washing procedure?', null, null)]),
            chk('Which personal hygiene rules are enforced for food handlers?', ['Hair tied back or covered','No jewellery','Clean uniform or apron','No nail polish','No eating in prep areas','No smoking near food'], null),
            b('Are food handlers excluded from work when ill with gastrointestinal illness?', 'Includes vomiting, diarrhoea, or jaundice.', 'Ill food handlers must not handle food.',
              [txt('Describe your illness reporting and exclusion policy.', null, null)],
              [txt('What is your plan to implement an illness exclusion policy?', null, null)]),
            fil('Upload your staff personal hygiene policy.', null, null),
          ]},
          { sec: 'Staff Training', qs: [
            b('Have all food handlers completed a recognised food safety training course?', 'E.g., Food Handler Certificate or equivalent.', 'Training must be current (within last 3 years).',
              [fil('Upload staff training records or certificates.', null, null)],
              [txt('Provide a training plan including enrolment dates for untrained staff.', null, 'All staff must be enrolled within 60 days.')]),
            mc('How often is food safety training refreshed?', ['Annually','Every 3 years','On induction only','Never'], null, 'Must not be "Never".'),
            b('Is a Food Safety Supervisor appointed as required by local regulations?', null, 'Supervisor must be on-site or contactable at all times.',
              [fil('Upload the Food Safety Supervisor certificate.', null, null)],
              [txt('When will a Food Safety Supervisor be appointed?', null, 'Must be within 30 days.')]),
            num('How many staff are currently employed in food handling roles?', null, null),
          ]},
        ]},
        { main: 'Allergen Management', sections: [
          { sec: 'Allergen Identification', qs: [
            b('Are all major allergens identified across your menu or product range?', 'Refer to local food safety regulations for the full list.', 'A complete allergen matrix must be available.',
              [fil('Upload your current allergen matrix or menu allergen guide.', null, null)],
              [txt('When will you develop and publish an allergen matrix?', null, 'Target date must be within 30 days.')]),
            mc('How is allergen information communicated to customers?', ['Menu labels','Verbal on request','Table cards','Not currently communicated'], null, 'Must not be "Not currently communicated".'),
            txt('Describe your process when a customer requests allergen information.', null, 'Must describe who responds and what information is provided.'),
          ]},
          { sec: 'Cross-Contamination Prevention', qs: [
            b('Are allergen-safe preparation areas or dedicated equipment used?', 'E.g., separate chopping boards, utensils, or prep zones.', 'Physical separation or rigorous cleaning protocols must be in place.',
              [txt('Describe your allergen cross-contamination prevention procedure.', null, 'Must include cleaning procedures between allergen and non-allergen prep.')],
              [txt('When will you implement allergen-safe preparation protocols?', null, null)]),
            b('Are staff trained in allergen awareness and response to allergic reactions?', null, 'Training must be documented.',
              [fil('Upload allergen awareness training records.', null, null)],
              [txt('When will allergen awareness training be conducted?', null, null)]),
            mc('How often is your allergen matrix reviewed for accuracy?', ['When menu changes','Annually','Never','Only when a complaint is received'], null, 'Must not be "Never".'),
          ]},
        ]},
      ],
    },

    // ── 3. Environmental Management ───────────────────────────────────────────
    {
      meta: { id: 'ENV-2026-001', name: 'Environmental Management Certificate', desc: 'Assessment of waste management, energy efficiency, water conservation, emissions monitoring, and regulatory compliance.', price: 1500, validity: 2, docs: ['Environmental Policy','Waste Management Plan','Energy Audit Report'] },
      structure: [
        { main: 'Waste Management', sections: [
          { sec: 'Waste Reduction & Segregation', qs: [
            b('Does your organisation have a documented waste management plan?', 'Covers reduction, reuse, recycling, and disposal.', 'Plan must be reviewed annually.',
              [fil('Upload your current waste management plan.', null, null)],
              [txt('When will a waste management plan be developed?', null, 'Target date must be within 90 days.')]),
            mc('How is waste generation tracked?', ['Monthly waste audits','Weighbridge dockets','Visual estimates only','Not tracked'], null, 'Must not be "Not tracked".'),
            txt('Describe any waste reduction initiatives implemented in the last 12 months.', null, null),
            b('Is a waste contractor licensed to receive your waste types?', null, 'Contractor must hold current waste transport licence.',
              [fil('Upload your waste contractor licence or agreement.', null, null)],
              [txt('Identify your current waste contractor and confirm their licensing status.', null, null)]),
          ]},
          { sec: 'Hazardous Waste', subs: [
            { sub: 'Storage & Labelling', qs: [
              b('Are all hazardous materials correctly labelled and stored in compliant containers?', 'Labels must include GHS hazard pictograms, product name, and SDS reference.', 'All containers must comply with dangerous goods regulations.',
                [fil('Upload a photo of your hazardous materials storage area.', null, null)],
                [txt('Describe your corrective plan to achieve compliant storage and labelling.', null, null)]),
              mc('Are Safety Data Sheets (SDS) accessible for all hazardous chemicals?', ['Yes, readily accessible to all staff','Yes, but only in the office','No, not available','Some chemicals only'], null, 'Must be readily accessible to all staff.'),
              num('How many different hazardous chemicals are stored on site?', null, null),
            ]},
            { sub: 'Disposal Records', qs: [
              b('Are hazardous waste disposal records retained for the required period?', 'Typically 3–7 years depending on jurisdiction.', null,
                [fil('Upload hazardous waste disposal manifests from the last 12 months.', null, null)],
                [txt('When will you implement a disposal record-keeping system?', null, null)]),
              mc('How is hazardous waste transported from your site?', ['Licensed waste transporter','Company vehicle','Third-party courier','Unknown'], null, 'Must use a licensed waste transporter.'),
            ]},
          ]},
        ]},
        { main: 'Energy & Water', sections: [
          { sec: 'Energy Efficiency', qs: [
            b('Has your organisation conducted an energy audit in the last 2 years?', 'Audits may be internal or by an accredited assessor.', 'Audit must cover all major energy-consuming systems.',
              [fil('Upload the most recent energy audit report.', null, null)],
              [txt('When do you plan to conduct an energy audit?', null, 'Must be scheduled within 12 months.')]),
            mc('What is your primary energy source?', ['Grid electricity (fossil)','Grid electricity (renewables)','On-site solar','Natural gas','Mixed sources'], null, null),
            b('Does your organisation have a renewable energy target?', null, null,
              [fil('Upload your energy strategy or sustainability plan.', null, null)],
              [txt('What is preventing adoption of a renewable energy target?', null, null)]),
            chk('Which energy efficiency measures are currently implemented?', ['LED lighting','Sensor-controlled lighting','Variable speed drives','Insulated building envelope','Energy-efficient HVAC','Solar PV'], null),
          ]},
          { sec: 'Water Conservation', qs: [
            b('Does your organisation monitor and record monthly water consumption?', 'Via utility bills or sub-meters.', null,
              [fil('Upload water usage records or utility bills for the last 12 months.', null, null)],
              [txt('When will you begin monitoring water consumption?', null, null)]),
            chk('Which water conservation measures are in place?', ['Low-flow fixtures','Rainwater harvesting','Recycled water use','Leak detection program','Staff awareness training'], null),
            b('Are water meters installed to monitor consumption by area or process?', null, null,
              [txt('Which areas or processes are sub-metered?', null, null)],
              [txt('What is your plan to install sub-metering?', null, null)]),
            num('How many water leak events were identified and repaired in the last 12 months?', null, null),
          ]},
        ]},
        { main: 'Emissions & Compliance', sections: [
          { sec: 'Emissions Monitoring', qs: [
            b('Does your organisation measure its greenhouse gas (GHG) emissions?', 'Minimum Scope 1 (direct) and Scope 2 (indirect electricity).', 'Must follow GHG Protocol or equivalent.',
              [fil('Upload your most recent GHG inventory or carbon footprint report.', null, null)],
              [txt('When will you begin measuring GHG emissions?', null, 'Must commence within 12 months.')]),
            b('Does your organisation have a GHG reduction target?', null, null,
              [fil('Upload your climate action plan or emissions reduction strategy.', null, null)],
              [txt('What is your timeline for setting a GHG reduction target?', null, null)]),
          ]},
          { sec: 'Regulatory Compliance', qs: [
            b('Does your organisation hold all required environmental licences and permits?', 'Includes EPA licences, trade waste permits, and site-specific conditions.', 'All licences must be current and not suspended.',
              [fil('Upload copies of all current environmental licences and permits.', null, null)],
              [txt('Which licences are outstanding and what is the application timeline?', null, null)]),
            b('Have there been any environmental incidents or regulatory notices in the last 2 years?', 'Include spills, odour complaints, or notices of violation.', null,
              [fil('Upload regulatory correspondence and corrective action records.', null, null)],
              [txt('Confirm no incidents have occurred and describe your prevention measures.', null, null)]),
            mc('How often is environmental legal compliance reviewed?', ['Annually','Every 2 years','Only when regulations change','Never'], null, 'Must not be "Never".'),
            num('How many environmental compliance audits were conducted in the last 2 years?', null, null),
          ]},
        ]},
      ],
    },

    // ── 4. Cyber Security ─────────────────────────────────────────────────────
    {
      meta: { id: 'CYBER-2026-001', name: 'Cyber Security Compliance Certificate', desc: 'Assessment of information security controls, access management, incident response, data protection, and staff security awareness.', price: 2000, docs: ['Information Security Policy','Incident Response Plan','Data Classification Policy'] },
      structure: [
        { main: 'Access Control & Identity Management', sections: [
          { sec: 'User Access Management', qs: [
            b('Is a formal user access provisioning and de-provisioning process in place?', 'Includes onboarding and offboarding procedures.', 'Process must be documented and followed without exception.',
              [fil('Upload your access management policy or procedure.', null, null)],
              [txt('Describe your plan to implement formal access management.', null, null)]),
            b('Is multi-factor authentication (MFA) enforced for all remote access?', 'Includes VPN, cloud services, and email.', 'MFA is a critical control for remote access.',
              [chk('Which systems have MFA enforced?', ['Email (M365/Google)','VPN','Cloud storage','Financial systems','HR systems','All systems'], null)],
              [txt('What is your plan and timeline to implement MFA?', null, 'Must be within 60 days.')]),
            mc('How are privileged accounts (admin) managed?', ['Dedicated admin accounts separate from daily use','Shared admin credentials','Admin rights on all accounts','No privileged accounts'], null, null),
            b('Are access rights reviewed at least annually?', null, 'Periodic reviews must be documented.',
              [fil('Upload evidence of your last access rights review.', null, null)],
              [txt('When will you conduct your first formal access rights review?', null, null)]),
            num('How many users have privileged (admin) access to critical systems?', null, null),
          ]},
          { sec: 'Password & Authentication Policy', qs: [
            b('Is a formal password policy enforced across all systems?', 'Policy should specify minimum length, complexity, and rotation.', null,
              [fil('Upload your password policy document.', null, null)],
              [txt('Describe your plan to implement a formal password policy.', null, null)]),
            mc('How are passwords stored for service accounts?', ['Password manager','Encrypted secrets vault','Plain text document','Shared spreadsheet'], null, 'Plain text and shared spreadsheets are unacceptable.'),
            b('Are default credentials changed on all devices and software?', null, 'Default credentials must be changed at deployment.',
              [txt('Describe your device hardening process including credential changes.', null, null)],
              [txt('What is your plan to audit and change all default credentials?', null, null)]),
          ]},
        ]},
        { main: 'Network & Endpoint Security', sections: [
          { sec: 'Network Security', qs: [
            b('Is a firewall deployed and actively managed at the network perimeter?', null, 'Firewall rules must be reviewed at least annually.',
              [fil('Upload your last firewall rule review or change log.', null, null)],
              [txt('What is your plan to deploy and manage a network firewall?', null, null)]),
            b('Is network traffic monitored for anomalies or intrusions?', 'E.g., IDS/IPS, SIEM, or network flow analysis.', null,
              [txt('How are security alerts triaged and responded to?', null, null)],
              [txt('What is your plan to implement network monitoring?', null, null)]),
            chk('Which network segmentation controls are in place?', ['VLANs for different departments','Guest Wi-Fi isolated from corporate','DMZ for public-facing servers','Zero-trust architecture'], null),
            b('Is a vulnerability scanning program in place?', null, 'Scans must cover all internet-facing assets.',
              [fil('Upload your most recent vulnerability scan report.', null, null)],
              [txt('When will you implement vulnerability scanning?', null, null)]),
          ]},
          { sec: 'Endpoint Security', qs: [
            b('Is endpoint protection (antivirus/EDR) deployed on all devices?', null, 'Must cover laptops, desktops, and servers.',
              [chk('Which endpoint protection tools are deployed?', ['Antivirus','EDR (Endpoint Detection & Response)','DLP (Data Loss Prevention)','Application whitelisting'], null)],
              [txt('What is your plan to deploy endpoint protection?', null, null)]),
            b('Are all operating systems and software kept up to date with security patches?', 'Critical patches must be applied within 30 days.', null,
              [fil('Upload your patch management policy or recent patch report.', null, null)],
              [txt('Describe your plan to establish a formal patch management process.', null, null)]),
            num('How many unpatched critical vulnerabilities currently exist across your estate?', 'From your most recent vulnerability scan.', 'Target is zero unpatched critical vulnerabilities.'),
          ]},
        ]},
        { main: 'Incident Response & Data Protection', sections: [
          { sec: 'Incident Response', qs: [
            b('Does your organisation have a documented Incident Response Plan (IRP)?', 'Must cover detection, containment, eradication, recovery, and lessons learned.', null,
              [fil('Upload your Incident Response Plan.', null, null)],
              [txt('What is your plan and timeline to develop an IRP?', null, null)]),
            b('Is there a process for reporting data breaches to regulators within the required timeframe?', 'E.g., 72 hours under GDPR, 30 days under Australian Privacy Act (eligible data breaches).', null,
              [txt('Describe your breach notification process including who is notified and by when.', null, null)],
              [txt('Describe your plan to establish a breach notification process.', null, null)]),
            num('How many security incidents were recorded in the last 12 months?', null, null),
          ]},
          { sec: 'Data Protection', qs: [
            b('Is personal data classified and handled according to a data classification policy?', null, 'Policy must define handling requirements for each classification level.',
              [fil('Upload your data classification policy.', null, null)],
              [txt('When will a data classification policy be developed?', null, null)]),
            b('Is personal data encrypted at rest and in transit?', 'At rest: full-disk encryption or database encryption. In transit: TLS 1.2+ mandatory.', null,
              [chk('Which encryption controls are implemented?', ['Full-disk encryption on endpoints','Database encryption','TLS 1.2+ for all web traffic','Encrypted email for sensitive data','Encrypted backups'], null)],
              [txt('What is your plan to implement encryption for personal data?', null, null)]),
            mc('How long is personal data retained?', ['As long as legally required','Until no longer needed for original purpose','Indefinitely','No defined retention policy'], null, 'Must have a defined retention policy.'),
            b('Are data privacy impact assessments (DPIAs) conducted for new data-processing activities?', null, null,
              [fil('Upload an example completed DPIA.', null, null)],
              [txt('When will you implement a DPIA process?', null, null)]),
          ]},
        ]},
      ],
    },

    // ── 5. Human Resources Compliance ─────────────────────────────────────────
    {
      meta: { id: 'HR-2026-001', name: 'Human Resources Compliance Certificate', desc: 'Assessment of employment practices, anti-discrimination, leave entitlements, performance management, and termination procedures.', price: 800, docs: ['Employee Handbook','Employment Contracts','Disciplinary Policy'] },
      structure: [
        { main: 'Employment Practices', sections: [
          { sec: 'Recruitment & Onboarding', qs: [
            b('Are all employees provided with a written employment contract before commencing work?', null, 'Contracts must be signed by both parties prior to commencement.',
              [fil('Upload a sample (redacted) employment contract template.', null, null)],
              [txt('When will you implement written employment contracts for all staff?', null, null)]),
            b('Is a structured onboarding program in place for new employees?', null, null,
              [fil('Upload your onboarding checklist or program outline.', null, null)],
              [txt('What is your plan to develop an onboarding program?', null, null)]),
            mc('How are job vacancies advertised?', ['Internal and external','Internal only','Word of mouth only','No formal process'], null, null),
            b('Are pre-employment background checks conducted where required?', 'May include police check, working with children check, reference checks.', null,
              [chk('Which background checks are conducted?', ['Police check','Working with children check','Reference checks','Right to work verification','Professional qualification verification'], null)],
              [txt('Describe your risk-based approach to background checking.', null, null)]),
          ]},
          { sec: 'Wages & Entitlements', qs: [
            b('Are all employees paid at least the applicable minimum wage?', 'Check against relevant Award, Enterprise Agreement, or national minimum wage.', 'Non-compliance is a serious legal violation.',
              [fil('Upload your most recent payroll compliance audit or review.', null, null)],
              [txt('Describe your plan to achieve payroll compliance immediately.', null, null)]),
            b('Are leave entitlements correctly accrued and recorded in your payroll system?', 'Includes annual leave, personal/carer\'s leave, and long service leave.', null,
              [mc('Which payroll system is used?', ['MYOB','Xero','ADP','SAP','Manual spreadsheet','Other'], null, null)],
              [txt('What leave entitlements are currently not being correctly accrued?', null, null)]),
            num('How many employees are currently employed (full-time equivalent)?', null, null),
            chk('Which leave types are tracked in your payroll system?', ['Annual leave','Personal/carer\'s leave','Long service leave','Parental leave','Compassionate leave','Unpaid leave'], null),
          ]},
        ]},
        { main: 'Workplace Conduct', sections: [
          { sec: 'Anti-Discrimination & Equal Opportunity', qs: [
            b('Does your organisation have an Equal Employment Opportunity (EEO) policy?', null, 'Policy must be communicated to all staff.',
              [fil('Upload your EEO or anti-discrimination policy.', null, null)],
              [txt('When will an EEO policy be developed and implemented?', null, null)]),
            b('Have any discrimination or harassment complaints been lodged in the last 2 years?', null, null,
              [txt('Describe the nature of complaints and outcomes.', null, 'Must demonstrate a fair investigation process.')],
              [txt('Confirm no complaints have been received and describe your prevention measures.', null, null)]),
            mc('How often is discrimination and harassment training conducted?', ['Annually','On induction only','Every 2 years','Never'], null, 'Must not be "Never".'),
          ]},
          { sec: 'Performance & Disciplinary', qs: [
            b('Is a formal performance management process in place?', 'Includes regular reviews and documented feedback.', null,
              [fil('Upload your performance review template or policy.', null, null)],
              [txt('What is your plan to implement formal performance management?', null, null)]),
            b('Is a documented disciplinary and grievance procedure in place?', null, 'Employees must be given an opportunity to respond before any disciplinary action.',
              [fil('Upload your disciplinary policy and procedure.', null, null)],
              [txt('When will a disciplinary and grievance procedure be developed?', null, null)]),
            mc('Who conducts disciplinary investigations?', ['HR Manager','Direct manager only','External HR consultant','No defined process'], null, 'Must not be "No defined process".'),
          ]},
        ]},
        { main: 'Termination & Offboarding', sections: [
          { sec: 'Termination Procedures', qs: [
            b('Are all terminations conducted in accordance with the applicable notice periods?', null, 'Notice periods must comply with employment contracts and applicable law.',
              [txt('Describe your process for calculating and providing notice on termination.', null, null)],
              [txt('What is your plan to ensure compliant termination procedures?', null, null)]),
            b('Is a formal offboarding checklist used to recover assets and revoke access?', null, 'Access revocation must occur on the last day of employment.',
              [fil('Upload your offboarding checklist.', null, null)],
              [txt('When will a formal offboarding process be implemented?', null, null)]),
            mc('How is final pay processed for departing employees?', ['On last day of employment','Within 5 business days','On next regular pay cycle','No defined process'], null, 'Must be within 5 business days or as legally required.'),
          ]},
        ]},
      ],
    },

    // ── 6. Financial Controls & Anti-Fraud ────────────────────────────────────
    {
      meta: { id: 'FIN-2026-001', name: 'Financial Controls & Anti-Fraud Certificate', desc: 'Assessment of internal financial controls, fraud risk management, procurement integrity, and financial reporting compliance.', price: 1800, docs: ['Finance Policy','Procurement Policy','Anti-Fraud Policy'] },
      structure: [
        { main: 'Internal Financial Controls', sections: [
          { sec: 'Segregation of Duties', qs: [
            b('Are financial duties appropriately segregated to prevent fraud?', 'No single person should be able to initiate, approve, and record a transaction.', 'Segregation must be demonstrable.',
              [fil('Upload your financial controls matrix or delegation of authority policy.', null, null)],
              [txt('What compensating controls are in place where full segregation is not possible?', null, null)]),
            mc('Who approves payment runs?', ['Finance Manager only','Two authorised signatories','CEO and Finance Manager jointly','Any staff member'], null, 'Must require at least two authorised signatories for significant payments.'),
            b('Are bank account signatories reviewed and updated at least annually?', null, null,
              [fil('Upload your current bank mandate or signatory list.', null, null)],
              [txt('When was the bank mandate last reviewed?', null, null)]),
            num('What is the maximum payment amount that can be approved by a single signatory?', 'Enter amount in AUD.', null),
          ]},
          { sec: 'Financial Reporting', qs: [
            b('Are monthly management accounts prepared and reviewed by the Board or Executive?', null, 'Review must be documented (e.g., Board minutes).',
              [fil('Upload evidence of Board or Executive review of recent management accounts.', null, null)],
              [txt('What is your plan to implement monthly financial reporting to the Board?', null, null)]),
            b('Are annual financial statements prepared and audited by an independent auditor?', null, null,
              [fil('Upload your most recent audited financial statements.', null, null)],
              [txt('What is your plan to engage an independent auditor?', null, null)]),
            mc('What accounting standard is used for financial reporting?', ['IFRS','AASB (IFRS-equivalent)','GAAP','Cash basis only','No formal standard'], null, 'Must use a recognised accounting standard.'),
          ]},
        ]},
        { main: 'Procurement & Fraud Prevention', sections: [
          { sec: 'Procurement Controls', qs: [
            b('Is a documented procurement policy in place with defined approval thresholds?', null, null,
              [fil('Upload your procurement policy.', null, null)],
              [txt('When will a procurement policy be developed?', null, null)]),
            b('Are all vendors vetted before being added to the approved supplier list?', null, null,
              [fil('Upload your approved supplier list or vendor management policy.', null, null)],
              [txt('What is your plan to implement vendor vetting?', null, null)]),
            mc('How often is the approved supplier list reviewed?', ['Annually','Every 2 years','Only when issues arise','Never reviewed'], null, 'Must not be "Never reviewed".'),
          ]},
          { sec: 'Anti-Fraud Controls', qs: [
            b('Does your organisation have a documented anti-fraud policy?', null, null,
              [fil('Upload your anti-fraud policy.', null, null)],
              [txt('When will an anti-fraud policy be developed?', null, null)]),
            b('Is a fraud reporting mechanism (e.g., whistleblower hotline) available to staff?', null, 'Reporting must be confidential and protected from retaliation.',
              [txt('Describe your fraud reporting mechanism and protection for whistleblowers.', null, null)],
              [txt('What is your plan to implement a confidential fraud reporting channel?', null, null)]),
            mc('How often is fraud awareness training provided to finance staff?', ['Annually','On induction only','Every 2 years','Never'], null, 'Must not be "Never".'),
            num('How many suspected fraud incidents were investigated in the last 2 years?', null, null),
          ]},
        ]},
      ],
    },

    // ── 7. Supply Chain & Ethical Sourcing ────────────────────────────────────
    {
      meta: { id: 'SCM-2026-001', name: 'Supply Chain & Ethical Sourcing Certificate', desc: 'Assessment of supplier due diligence, modern slavery risk, ethical sourcing practices, and supply chain transparency.', price: 1400, docs: ['Supplier Code of Conduct','Modern Slavery Statement','Supplier Risk Register'] },
      structure: [
        { main: 'Supplier Due Diligence', sections: [
          { sec: 'Supplier Assessment & Onboarding', qs: [
            b('Is a formal supplier assessment process in place before onboarding new suppliers?', null, 'Assessment must cover financial, ethical, and quality criteria.',
              [fil('Upload your supplier assessment questionnaire or checklist.', null, null)],
              [txt('What is your plan to implement a formal supplier assessment process?', null, null)]),
            b('Are high-risk suppliers subject to on-site audits?', 'High-risk = high spend, single-source, or elevated ethical risk.', null,
              [txt('Describe your risk-based approach to supplier audits.', null, null)],
              [txt('What criteria would trigger an on-site supplier audit?', null, null)]),
            mc('How frequently is supplier performance reviewed?', ['Quarterly','Annually','Only after issues','Never'], null, 'Must not be "Never".'),
          ]},
          { sec: 'Supplier Code of Conduct', qs: [
            b('Is a Supplier Code of Conduct in place and communicated to all suppliers?', null, 'Suppliers must acknowledge receipt of the Code.',
              [fil('Upload your Supplier Code of Conduct.', null, null)],
              [txt('When will a Supplier Code of Conduct be developed and distributed?', null, null)]),
            mc('What happens when a supplier breaches the Code of Conduct?', ['Formal warning and remediation plan','Immediate termination','No action','Not defined'], null, 'Must not be "No action" or "Not defined".'),
          ]},
        ]},
        { main: 'Modern Slavery & Ethical Labour', sections: [
          { sec: 'Modern Slavery Risk', qs: [
            b('Has your organisation conducted a modern slavery risk assessment across its supply chain?', null, 'Assessment must cover all tiers of the supply chain.',
              [fil('Upload your modern slavery risk assessment or Modern Slavery Statement.', null, null)],
              [txt('When will a modern slavery risk assessment be conducted?', null, null)]),
            b('Have any modern slavery indicators been identified in your supply chain?', 'Indicators include unpaid labour, restricted movement, debt bondage.', null,
              [fil('Upload evidence of remediation actions.', null, null)],
              [txt('Describe the due diligence measures that led to this conclusion.', null, null)]),
            mc('Does your organisation report under modern slavery legislation?', ['Yes, annual report submitted','Yes, due to report soon','Below reporting threshold','Not assessed'], null, null),
          ]},
          { sec: 'Ethical Sourcing', qs: [
            b('Are suppliers required to comply with local minimum wage and working hour regulations?', null, null,
              [fil('Upload your supplier labour standards requirements or contract clause.', null, null)],
              [txt('When will minimum labour standards be added to supplier agreements?', null, null)]),
            b('Are conflict minerals (e.g., tin, tantalum, tungsten, gold) present in your supply chain?', 'Relevant for electronics, automotive, aerospace, and jewellery sectors.', null,
              [fil('Upload your most recent conflict minerals report or CMRT.', null, null)],
              [txt('Confirm conflict minerals are not applicable to your supply chain and explain why.', null, null)]),
            chk('Which ethical sourcing certifications are held or required from suppliers?', ['Fairtrade','Rainforest Alliance','SA8000','B Corp','ISO 26000','None required'], null),
          ]},
        ]},
      ],
    },

    // ── 8. Quality Management ─────────────────────────────────────────────────
    {
      meta: { id: 'QMS-2026-001', name: 'Quality Management System Certificate', desc: 'Assessment of quality planning, process control, customer satisfaction, non-conformance management, and continual improvement.', price: 1300, docs: ['Quality Manual','Process Documentation','Customer Complaint Register'] },
      structure: [
        { main: 'Quality Planning & Documentation', sections: [
          { sec: 'Quality Management System', qs: [
            b('Does your organisation have a documented Quality Management System (QMS)?', null, 'QMS must cover scope, policy, objectives, and key processes.',
              [fil('Upload your Quality Manual or QMS overview document.', null, null)],
              [txt('What is your plan to implement a formal QMS?', null, null)]),
            b('Are quality objectives set and monitored at least annually?', null, 'Objectives must be measurable and aligned to the quality policy.',
              [fil('Upload your quality objectives register or last management review minutes.', null, null)],
              [txt('When will formal quality objectives be established?', null, null)]),
            num('How many documented procedures or work instructions are maintained?', null, null),
          ]},
          { sec: 'Document Control', qs: [
            b('Is a document control procedure in place to manage QMS documentation?', 'Includes version control, approval, and distribution.', null,
              [fil('Upload your document control procedure.', null, null)],
              [txt('When will document control be implemented?', null, null)]),
            b('Are documents reviewed and updated on a defined schedule?', null, null,
              [txt('What is the review cycle for critical QMS documents?', null, null)],
              [txt('How will you implement scheduled document reviews?', null, null)]),
          ]},
        ]},
        { main: 'Process Control & Inspection', sections: [
          { sec: 'Production & Service Delivery', qs: [
            b('Are critical processes documented with defined acceptance criteria?', null, null,
              [fil('Upload an example process procedure or work instruction.', null, null)],
              [txt('Identify which critical processes lack documentation and your remediation plan.', null, null)]),
            b('Are calibrated measuring and monitoring equipment used where applicable?', null, 'Calibration records must be maintained.',
              [fil('Upload your equipment calibration register.', null, null)],
              [txt('When will a calibration program be established?', null, null)]),
            mc('How are out-of-specification results handled?', ['Quarantine and non-conformance report','Rework or reject','Continue production','No defined process'], null, 'Must not be "Continue production" or "No defined process".'),
          ]},
          { sec: 'Non-Conformance Management', qs: [
            b('Is a non-conformance management process in place?', 'Includes identification, recording, root cause analysis, and corrective action.', null,
              [fil('Upload your non-conformance procedure and recent example NCR.', null, null)],
              [txt('What is your plan to implement a non-conformance process?', null, null)]),
            b('Are corrective actions verified for effectiveness before closure?', null, null,
              [txt('Describe your corrective action verification process.', null, null)],
              [txt('How will you implement corrective action verification?', null, null)]),
            mc('What is the average time to close a corrective action?', ['Less than 30 days','30–60 days','More than 60 days','No tracking'], null, 'Must not be "No tracking".'),
          ]},
        ]},
        { main: 'Customer Satisfaction & Improvement', sections: [
          { sec: 'Customer Feedback', qs: [
            b('Is customer satisfaction measured on a regular basis?', 'E.g., surveys, NPS, complaint tracking.', null,
              [fil('Upload results from your most recent customer satisfaction survey.', null, null)],
              [txt('What is your plan to implement customer satisfaction measurement?', null, null)]),
            b('Is a formal customer complaint process in place?', null, 'Complaints must be acknowledged within 2 business days.',
              [fil('Upload your customer complaint procedure and register.', null, null)],
              [txt('When will a formal complaint process be established?', null, null)]),
          ]},
          { sec: 'Continual Improvement', qs: [
            b('Is a formal continual improvement program in place?', 'E.g., Kaizen, PDCA, Lean, or Six Sigma.', null,
              [fil('Upload evidence of a recent improvement project.', null, null)],
              [txt('What is your plan to implement a continual improvement program?', null, null)]),
            mc('How are improvement opportunities identified?', ['Customer feedback','Internal audits','Staff suggestions','Data analysis','All of the above'], null, null),
            b('Is an internal audit program conducted to assess QMS effectiveness?', null, 'Internal audits must cover all QMS elements at least annually.',
              [fil('Upload your internal audit schedule and most recent audit report.', null, null)],
              [txt('When will an internal audit program be established?', null, null)]),
          ]},
        ]},
      ],
    },

    // ── 9. Data Privacy & GDPR ────────────────────────────────────────────────
    {
      meta: { id: 'PRIV-2026-001', name: 'Data Privacy & GDPR Compliance Certificate', desc: 'Assessment of personal data processing lawfulness, data subject rights, privacy by design, and regulatory compliance frameworks.', price: 1600, docs: ['Privacy Policy','Records of Processing Activities','Data Retention Schedule'] },
      structure: [
        { main: 'Lawful Processing & Transparency', sections: [
          { sec: 'Legal Basis & Consent', qs: [
            b('Is a lawful basis identified and documented for each personal data processing activity?', 'Lawful bases: consent, contract, legal obligation, vital interests, public task, legitimate interests.', 'Each processing activity in the ROPA must have a documented lawful basis.',
              [fil('Upload your Records of Processing Activities (ROPA).', null, null)],
              [txt('When will a ROPA be developed with documented lawful bases?', null, null)]),
            b('Where consent is relied upon, is it freely given, specific, informed, and unambiguous?', null, 'Pre-ticked boxes and bundled consent are not valid.',
              [fil('Upload an example consent form or consent capture mechanism.', null, null)],
              [txt('Describe the processing activities where consent is relied upon and your plan to make consent compliant.', null, null)]),
            mc('How are privacy notices provided to data subjects?', ['At point of collection online','In written contracts','Verbally only','Not currently provided'], null, 'Must not be "Not currently provided".'),
          ]},
          { sec: 'Privacy Notice & Transparency', qs: [
            b('Is a publicly accessible privacy notice or policy in place?', null, 'Must describe what data is collected, why, who it is shared with, and data subject rights.',
              [fil('Upload or provide the URL of your privacy notice.', null, null)],
              [txt('When will a compliant privacy notice be published?', null, null)]),
            b('Is your privacy notice reviewed and updated when processing activities change?', null, null,
              [txt('Describe your privacy notice review process and last review date.', null, null)],
              [txt('What triggers a privacy notice update in your current process?', null, null)]),
          ]},
        ]},
        { main: 'Data Subject Rights', sections: [
          { sec: 'Rights Fulfilment', qs: [
            b('Is a process in place to receive and respond to Data Subject Access Requests (DSARs) within the required timeframe?', 'Typically 30 days under GDPR/APPs.', null,
              [fil('Upload your DSAR procedure or response template.', null, null)],
              [txt('What is your plan to implement a DSAR response process?', null, null)]),
            b('Are processes in place to fulfil erasure (right to be forgotten) requests?', 'Subject to applicable exemptions.', null,
              [txt('Describe your erasure request process including any exemptions applied.', null, null)],
              [txt('When will an erasure request process be implemented?', null, null)]),
            chk('Which data subject rights are documented in your procedures?', ['Access (DSAR)','Rectification','Erasure','Restriction','Portability','Object to processing','Automated decision-making opt-out'], null),
          ]},
        ]},
        { main: 'Privacy by Design & Security', sections: [
          { sec: 'Privacy by Design', qs: [
            b('Is privacy by design considered when developing new products, services, or processes?', null, 'Privacy must be embedded at the design stage, not added as an afterthought.',
              [fil('Upload an example Privacy Impact Assessment (PIA) or DPIA.', null, null)],
              [txt('What is your plan to embed privacy by design into your development process?', null, null)]),
            b('Is the principle of data minimisation applied — collecting only what is strictly necessary?', null, null,
              [txt('Describe how data minimisation is assessed for each processing activity.', null, null)],
              [txt('Which processing activities are collecting more data than necessary and what is your remediation plan?', null, null)]),
            mc('How long is personal data retained on average?', ['Defined in a retention schedule','Until no longer needed','Indefinitely','Not assessed'], null, 'Must have a defined retention schedule.'),
          ]},
          { sec: 'Data Breach Management', qs: [
            b('Is a data breach response procedure in place?', 'Must include detection, containment, assessment, notification, and post-incident review.', null,
              [fil('Upload your data breach response procedure.', null, null)],
              [txt('When will a data breach response procedure be developed?', null, null)]),
            b('Has a data breach occurred in the last 2 years?', null, null,
              [fil('Upload the breach notification to the regulator (redacted if necessary).', null, null)],
              [txt('Confirm no breach has occurred and describe your breach prevention controls.', null, null)]),
            num('How many potential data security incidents were assessed in the last 12 months?', null, null),
          ]},
        ]},
      ],
    },

    // ── 10. Anti-Bribery & Corruption ─────────────────────────────────────────
    {
      meta: { id: 'ABC-2026-001', name: 'Anti-Bribery & Corruption (ABC) Certificate', desc: 'Assessment of anti-bribery controls, gifts and hospitality management, facilitation payments, and third-party due diligence.', price: 1700, docs: ['Anti-Bribery Policy','Gifts Register','Third-Party Due Diligence Procedure'] },
      structure: [
        { main: 'Anti-Bribery Controls', sections: [
          { sec: 'Policy & Governance', qs: [
            b('Does your organisation have a documented anti-bribery and corruption (ABC) policy?', null, 'Policy must explicitly prohibit bribery in all forms — giving and receiving.',
              [fil('Upload your anti-bribery and corruption policy.', null, null)],
              [txt('When will an ABC policy be developed and implemented?', null, null)]),
            b('Is tone-from-the-top demonstrated through senior leadership commitment to ABC?', null, null,
              [fil('Upload a CEO/Board statement or training record demonstrating leadership commitment.', null, null)],
              [txt('How will senior leadership demonstrate commitment to ABC compliance?', null, null)]),
            mc('How often is the ABC policy reviewed?', ['Annually','Every 2 years','Only when an incident occurs','Never'], null, 'Must be reviewed at least annually.'),
          ]},
          { sec: 'Training & Awareness', qs: [
            b('Are all relevant staff trained on the ABC policy and their obligations?', 'Relevant staff includes those in sales, procurement, finance, and senior management.', null,
              [fil('Upload ABC training records or completion certificates.', null, null)],
              [txt('What is your plan and timeline to implement ABC training?', null, null)]),
            b('Is ABC training refreshed at least every 2 years?', null, null,
              [txt('Describe your training refresh cycle and how completion is tracked.', null, null)],
              [txt('When will a refresher training program be implemented?', null, null)]),
          ]},
        ]},
        { main: 'Gifts, Hospitality & Facilitation Payments', sections: [
          { sec: 'Gifts & Hospitality', qs: [
            b('Is a gifts and hospitality policy in place with defined monetary thresholds?', null, 'Both giving and receiving must be covered with clear thresholds.',
              [fil('Upload your gifts and hospitality policy.', null, null)],
              [txt('When will a gifts and hospitality policy be implemented?', null, null)]),
            b('Is a gifts and hospitality register maintained and reviewed regularly?', null, 'Register must be reviewed by a senior manager or compliance officer.',
              [fil('Upload your gifts and hospitality register (redacted if needed).', null, null)],
              [txt('When will a gifts register be established?', null, null)]),
          ]},
          { sec: 'Facilitation Payments & Third-Party Risk', qs: [
            b('Does your ABC policy explicitly prohibit facilitation payments?', 'Facilitation payments are small payments to expedite routine government actions — illegal in most jurisdictions.', null,
              [txt('How are staff instructed to respond when asked for a facilitation payment?', null, 'Must include refusal and reporting procedure.')],
              [txt('When will facilitation payment prohibition be included in your ABC policy?', null, null)]),
            b('Is third-party due diligence conducted on agents, intermediaries, and JV partners?', 'High-risk third parties acting on your behalf create significant bribery exposure.', null,
              [fil('Upload your third-party due diligence procedure.', null, null)],
              [txt('What is your plan to implement third-party due diligence?', null, null)]),
            mc('How are ABC incidents and concerns reported internally?', ['Dedicated hotline or email','Direct to compliance/legal team','Any manager','No reporting channel'], null, 'Must not be "No reporting channel".'),
            num('How many gifts or hospitality items were declared in the last 12 months?', null, null),
          ]},
        ]},
      ],
    },
  ];

  for (const cert of CERTS) {
    console.log(`  Seeding: ${cert.meta.name}…`);
    // Remove existing
    await q(c, `DELETE FROM certificates WHERE certificate_id = $1`, [cert.meta.id]);

    const certId = await createCert(c, industryIds, cert.meta);
    await createBadges(c, certId);

    const ctr = { n: 1, qn: {} };

    for (let mi = 0; mi < cert.structure.length; mi++) {
      const mDef = cert.structure[mi];
      const mainId = await createMain(c, certId, mDef.main, mi + 1);

      for (let si = 0; si < mDef.sections.length; si++) {
        const sDef = mDef.sections[si];
        const secId = await createSection(c, certId, mainId, sDef.sec, si + 1);
        const base = { cert: certId, main: mainId, sec: secId };

        if (sDef.qs) {
          await insertQs(c, ctr, base, sDef.qs);
        }

        if (sDef.subs) {
          for (let bi = 0; bi < sDef.subs.length; bi++) {
            const bDef = sDef.subs[bi];
            const subId = await createSub(c, certId, mainId, secId, bDef.sub, bi + 1);
            await insertQs(c, ctr, { ...base, sub: subId }, bDef.qs);
          }
        }
      }
    }

    console.log(`    ✓  ${cert.meta.name} — ${ctr.n - 1} questions`);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch all industry IDs from the system
    const industries = await client.query(`SELECT id FROM industry ORDER BY name`);
    if (industries.rows.length === 0) {
      throw new Error('No industries found in the database. Please create industries first via the API.');
    }
    const industryIds = industries.rows.map(r => r.id);
    console.log(`\nFound ${industryIds.length} industr${industryIds.length === 1 ? 'y' : 'ies'} — assigning all to every certificate.\n`);

    await seedAll(client, industryIds);

    await client.query('COMMIT');
    console.log('\n✅  All certificates seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Seed failed, rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
