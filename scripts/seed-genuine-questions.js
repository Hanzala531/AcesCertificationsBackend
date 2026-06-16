/**
 * Seeds GENUINE, hand-curated, domain-specific, non-repeating questions.
 *
 * Behaviour:
 *   - Re-uses existing Hospitality cert (5ebbb6bb-...) — only adds questions
 *     to its already-created subsections.
 *   - Creates 4 NEW unpublished certificates (Manufacturing, Healthcare,
 *     Retail Operations, Information Security), each with its own
 *     hand-curated structure + questions.
 *   - All certs description: "this is created by the backend dev as a test certificate"
 *   - 2 unique questions per subsection. No two questions are identical
 *     anywhere across all certs (uniqueness enforced at runtime).
 */

const axios = require('axios');

const CONFIG = {
  BASE_URL: 'http://localhost:3001/api',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'SecurePassword123!',
};

const TEST_DESC = 'this is created by the backend dev as a test certificate';
const HOSPITALITY_ID = '5ebbb6bb-63f0-4e33-8a5b-1ad2d1bb86f1';

const STANDARD_BADGES = [
  { slot: 1, name: 'Gold',   colors: [
    { color: '#FFD700', min_score: 90, max_score: 100 },
    { color: '#FFA500', min_score: 80, max_score: 89 },
  ]},
  { slot: 2, name: 'Silver', colors: [{ color: '#C0C0C0', min_score: 65, max_score: 79 }] },
  { slot: 3, name: 'Bronze', colors: [{ color: '#CD7F32', min_score: 50, max_score: 64 }] },
];

// ─────────────────────────────────────────────────────────────
// HOSPITALITY — questions for the 36 subsections that already exist
// Subsection name → 2 unique, domain-specific questions
// ─────────────────────────────────────────────────────────────
const HOSPITALITY_QUESTIONS = {
  'Check-in / Check-out Standards': [
    { question: 'Are guest IDs verified against the booking record at every check-in per local hospitality regulations?', type: 'boolean', criteria: 'ID verification logged for 100% of arrivals; deviations require documented exception.', weightage: 8 },
    { question: 'What is your average check-in completion time, in minutes, measured at the front desk?', type: 'number', hint: 'Measure from guest arrival to room key issued.', criteria: 'Industry benchmark for full-service hotels is under 5 minutes.', weightage: 5 },
  ],
  'Reservation Accuracy & Booking Systems': [
    { question: 'Is your PMS reconciled against OTA bookings at least once daily to catch overbookings?', type: 'boolean', criteria: 'Daily reconciliation log signed off by duty manager.', weightage: 7 },
    { question: 'How frequently are duplicate bookings detected and resolved?', type: 'multiple_choice', options: ['In real-time via automation', 'Within the same day manually', 'Within 24-48 hours', 'Only when the guest reports it'], weightage: 6 },
  ],
  'Concierge Service Quality': [
    { question: 'Does the concierge maintain an up-to-date local recommendations list refreshed at least quarterly?', type: 'boolean', criteria: 'Last-revised date visible; restaurants/attractions verified for current operation.', weightage: 6 },
    { question: 'Describe how concierge staff are trained on local culture, language, and accessibility considerations.', type: 'text', hint: 'Mention training curriculum, frequency, and assessment.', weightage: 5 },
  ],
  'VIP & Repeat Guest Programs': [
    { question: 'Are guest preferences (allergies, room layout, amenities) stored in the PMS and applied automatically on return visits?', type: 'boolean', criteria: 'Profile fields populated; check-in workflow surfaces them to staff.', weightage: 7 },
    { question: 'What percentage of repeat guests in the past 12 months received a personalised welcome touch (note, amenity, upgrade)?', type: 'number', hint: 'Approximate percentage 0-100.', weightage: 4 },
  ],
  'Complaint Logging & Escalation': [
    { question: 'Is every guest complaint, regardless of severity, logged in a central system with a unique reference number?', type: 'boolean', criteria: 'Verified by sample audit of 10 stays.', weightage: 8 },
    { question: 'What is the maximum time, in hours, before an unresolved complaint is escalated to senior management?', type: 'number', hint: 'Per your written escalation policy.', weightage: 5 },
  ],
  'Service Recovery Procedures': [
    { question: 'Does the property have a documented service-recovery toolkit (compensation matrix, scripts, manager authority limits)?', type: 'boolean', weightage: 7 },
    { question: 'Rate the effectiveness of your service-recovery measured by post-stay satisfaction scores from previously dissatisfied guests.', type: 'rating', hint: '1 = no measurable improvement, 5 = consistently converts detractors to promoters.', weightage: 5 },
  ],
  'Room Cleaning Protocols': [
    { question: 'Are cleaning checklists for each room category signed off by housekeeping supervisors before turnover?', type: 'boolean', criteria: 'Checklist retained for at least 30 days for audit.', weightage: 7 },
    { question: 'How often are deep-cleaning protocols (mattresses, curtains, vents) performed?', type: 'multiple_choice', options: ['Monthly or more frequently', 'Quarterly', 'Twice a year', 'Annually or less'], weightage: 6 },
  ],
  'Public Area Maintenance': [
    { question: 'Are public-area inspection rounds completed at least every 2 hours during operating hours?', type: 'boolean', criteria: 'Inspection log maintained with timestamps and inspector signatures.', weightage: 5 },
    { question: 'Describe how you handle simultaneous high-traffic events (lobby congestion, restroom queues, lift load).', type: 'text', weightage: 4 },
  ],
  'Preventive Maintenance Schedules': [
    { question: 'Is there a CMMS or equivalent tool tracking every major asset with its next-due preventive task?', type: 'boolean', criteria: 'Software in use; overdue tasks under 5%.', weightage: 8 },
    { question: 'What is the average percentage of preventive maintenance tasks completed on schedule each month?', type: 'number', hint: 'Percentage 0-100 from your CMMS report.', weightage: 6 },
  ],
  'Equipment Inspection Logs': [
    { question: 'Are equipment inspection logs (lifts, kitchen equipment, HVAC) retained for at least 24 months?', type: 'boolean', criteria: 'Confirmed via random pull of 3 historical logs.', weightage: 6 },
    { question: 'Which inspection categories have third-party certification?', type: 'multiple_choice', options: ['Lifts, kitchen, fire systems, electrical', 'Lifts and fire systems only', 'Fire systems only', 'None — all internal'], weightage: 5 },
  ],
  'Building Compliance': [
    { question: 'Is the property\'s occupancy/operating licence current and displayed prominently?', type: 'boolean', weightage: 9 },
    { question: 'When was the most recent municipal inspection — note the year-month.', type: 'text', hint: 'e.g. 2025-08', weightage: 4 },
  ],
  'Asset Lifecycle Tracking': [
    { question: 'Does each capital asset have a recorded acquisition date, expected lifespan, and replacement budget line?', type: 'boolean', weightage: 6 },
    { question: 'Rate the maturity of your asset disposal/replacement decisioning process.', type: 'rating', hint: '1 = ad hoc reactive replacement, 5 = data-driven lifecycle plan tied to capex.', weightage: 4 },
  ],
  'Service Standards & Etiquette': [
    { question: 'Are F&B service staff assessed on standards (greeting, wine service, plate clearing) at least twice per year?', type: 'boolean', criteria: 'Mystery diner reports or supervisor evaluations.', weightage: 6 },
    { question: 'Describe how you maintain consistent service standards across multiple shift teams.', type: 'text', weightage: 5 },
  ],
  'Menu Quality & Consistency': [
    { question: 'Are recipe cards with photographs and gram-level ingredient quantities used in every kitchen?', type: 'boolean', weightage: 7 },
    { question: 'How frequently is each menu item portion-checked against recipe specs?', type: 'multiple_choice', options: ['Every service', 'Weekly spot checks', 'Monthly audits', 'Only when guests complain'], weightage: 5 },
  ],
  'Event Setup & Coordination': [
    { question: 'Is a written banquet event order (BEO) circulated to all departments at least 48 hours before any event?', type: 'boolean', weightage: 7 },
    { question: 'What is the minimum number of pre-event briefings held for the operations team?', type: 'number', weightage: 4 },
  ],
  'Catering Logistics': [
    { question: 'Are off-site catering temperature checks recorded at departure and arrival per HACCP?', type: 'boolean', criteria: 'Temperature log signed by both kitchen and dispatcher.', weightage: 8 },
    { question: 'Describe contingency arrangements for vehicle breakdown during a hot-food delivery.', type: 'text', weightage: 5 },
  ],
  'Responsible Alcohol Service': [
    { question: 'Are all bar staff trained and certified in responsible alcohol service per local law?', type: 'boolean', weightage: 9 },
    { question: 'When was the most recent staff refresher on intoxication signs and refusal procedures?', type: 'multiple_choice', options: ['Within last 6 months', '6-12 months ago', '12-24 months ago', 'Over 24 months ago / never'], weightage: 6 },
  ],
  'Inventory & Stock Control': [
    { question: 'Is bar/F&B stock counted at the start and end of every shift with variances investigated?', type: 'boolean', weightage: 6 },
    { question: 'What is your typical monthly beverage cost variance percentage versus theoretical?', type: 'number', hint: 'Lower is better; industry norm < 3%.', weightage: 4 },
  ],
  'Hiring Standards': [
    { question: 'Are background checks performed for every new hire whose role involves guest-room access or financial handling?', type: 'boolean', weightage: 8 },
    { question: 'Describe your process for verifying right-to-work documentation.', type: 'text', weightage: 5 },
  ],
  'New Employee Induction': [
    { question: 'Does every new hire complete brand standards, fire safety, and food hygiene induction within their first 5 working days?', type: 'boolean', weightage: 7 },
    { question: 'How is induction effectiveness measured?', type: 'multiple_choice', options: ['Post-induction quiz with pass threshold', 'Manager observation only', 'Self-assessment form', 'Not measured'], weightage: 5 },
  ],
  'Skill Development Programs': [
    { question: 'Is there an annual training calendar with budgeted hours per employee category?', type: 'boolean', weightage: 6 },
    { question: 'Average training hours completed per full-time employee in the last 12 months.', type: 'number', weightage: 4 },
  ],
  'Performance Appraisal Cycles': [
    { question: 'Are performance reviews conducted at least annually for every employee with documented goals?', type: 'boolean', weightage: 7 },
    { question: 'Rate the strength of the link between individual performance ratings and pay/promotion decisions.', type: 'rating', weightage: 5 },
  ],
  'Workplace Wellbeing': [
    { question: 'Is there an anonymous channel for staff to raise welfare or harassment concerns?', type: 'boolean', weightage: 8 },
    { question: 'What employee wellbeing benefits are actively offered?', type: 'multiple_choice', options: ['Mental health support, time-off bank, healthy meals', 'Two of the above', 'One of the above', 'None'], weightage: 5 },
  ],
  'Recognition & Rewards': [
    { question: 'Is there a formal "employee of the month/quarter" recognition tied to brand standards?', type: 'boolean', weightage: 4 },
    { question: 'Describe how peer-to-peer recognition is encouraged.', type: 'text', weightage: 3 },
  ],
  'Temperature Control & Storage': [
    { question: 'Are walk-in chiller and freezer temperatures logged at least twice per shift?', type: 'boolean', criteria: 'Logs retained for minimum 90 days.', weightage: 9 },
    { question: 'What is the maximum allowable temperature deviation, in °C, before corrective action is triggered?', type: 'number', weightage: 5 },
  ],
  'Cross-Contamination Prevention': [
    { question: 'Are colour-coded chopping boards and utensils used for raw meat, raw fish, vegetables, and ready-to-eat items?', type: 'boolean', weightage: 8 },
    { question: 'How are allergen-handling separations enforced in tight kitchen workspace?', type: 'text', weightage: 6 },
  ],
  'Fire Drills & Evacuation Plans': [
    { question: 'Are full-property fire drills conducted at least twice per year, including night shift?', type: 'boolean', weightage: 9 },
    { question: 'What is the documented target evacuation time, in minutes, for a fully-occupied property?', type: 'number', weightage: 6 },
  ],
  'Emergency Equipment Inspection': [
    { question: 'Are fire extinguishers, smoke detectors, and emergency lights inspected monthly with signed tags?', type: 'boolean', weightage: 8 },
    { question: 'When was your last complete fire-system test by a licensed contractor?', type: 'multiple_choice', options: ['Within last 6 months', '6-12 months ago', '12-24 months ago', 'More than 24 months ago'], weightage: 6 },
  ],
  'Personal Hygiene Standards': [
    { question: 'Are visible hand-washing reminders and hand sanitiser dispensers present at every kitchen entry?', type: 'boolean', weightage: 5 },
    { question: 'Rate enforcement consistency of staff uniform/grooming standards across departments.', type: 'rating', weightage: 4 },
  ],
  'Cleaning & Disinfection Schedules': [
    { question: 'Is there a written cleaning schedule covering "hot zones" (door handles, handrails, restrooms) at least every 2 hours?', type: 'boolean', weightage: 7 },
    { question: 'Which disinfectant approval standard do you follow for surface chemicals?', type: 'multiple_choice', options: ['EN 14476 / EN 1276', 'Local MoH-approved list', 'Manufacturer-recommended only', 'No standard followed'], weightage: 6 },
  ],
  'Energy Audits & Efficiency': [
    { question: 'Has an independent energy audit been completed within the past 24 months?', type: 'boolean', weightage: 6 },
    { question: 'What percentage of lighting fixtures are LED?', type: 'number', hint: '0-100', weightage: 4 },
  ],
  'Water Conservation Practices': [
    { question: 'Are low-flow fixtures (taps, showers, toilets) installed in at least 80% of guest bathrooms?', type: 'boolean', weightage: 6 },
    { question: 'Describe initiatives in place to reduce laundry water consumption.', type: 'text', weightage: 4 },
  ],
  'Recycling & Segregation': [
    { question: 'Are back-of-house bins segregated for paper, glass, plastic, and organics with staff signage?', type: 'boolean', weightage: 5 },
    { question: 'What approximate percentage of total waste is diverted from landfill?', type: 'number', hint: '0-100', weightage: 5 },
  ],
  'Food Waste Reduction': [
    { question: 'Is daily kitchen food waste weighed and logged by category (prep, plate, spoilage)?', type: 'boolean', weightage: 7 },
    { question: 'Rate the maturity of donation/composting programs for surplus edible food.', type: 'rating', weightage: 4 },
  ],
  'Local & Ethical Procurement': [
    { question: 'Do at least 30% of food suppliers fall within a 100 km radius of the property?', type: 'boolean', weightage: 5 },
    { question: 'Are suppliers required to sign a code of conduct covering labour and animal welfare?', type: 'multiple_choice', options: ['All suppliers', 'Tier-1 suppliers only', 'Top 10 by spend', 'No formal requirement'], weightage: 6 },
  ],
  'Eco-friendly Supplies': [
    { question: 'Are guest-room toiletries provided in refillable dispensers rather than single-use bottles?', type: 'boolean', weightage: 5 },
    { question: 'Describe efforts to phase out single-use plastics on the property.', type: 'text', weightage: 4 },
  ],
};

// ─────────────────────────────────────────────────────────────
// MANUFACTURING — full structure + 2 unique questions per subsection
// ─────────────────────────────────────────────────────────────
const MANUFACTURING_DEF = {
  name: 'Certified in Manufacturing Excellence',
  certCode: 'TEST-MFG-002',
  industry: 'Manufacturing',
  hierarchy: [
    { name: 'Production Operations', sections: [
      { name: 'Production Planning', subsections: ['Demand Forecasting', 'Master Production Schedule'] },
      { name: 'Line Operations', subsections: ['Line Balancing', 'Changeover Efficiency'] },
      { name: 'Maintenance Reliability', subsections: ['Total Productive Maintenance', 'Spare Parts Inventory'] },
    ]},
    { name: 'Quality Management', sections: [
      { name: 'Inspection & Testing', subsections: ['Incoming Material Inspection', 'In-Process Quality Checks'] },
      { name: 'Defect Management', subsections: ['Non-Conformance Handling', 'Customer Complaint Resolution'] },
      { name: 'Continuous Improvement', subsections: ['Six Sigma Projects', 'Root Cause Analysis'] },
    ]},
    { name: 'Workplace Safety (OSHA-aligned)', sections: [
      { name: 'Hazard Control', subsections: ['Machine Guarding', 'Lockout / Tagout'] },
      { name: 'PPE & Ergonomics', subsections: ['PPE Compliance', 'Ergonomic Risk Assessment'] },
      { name: 'Emergency Response', subsections: ['Fire & Spill Response', 'First-Aid Coverage'] },
    ]},
    { name: 'Supply Chain & Inventory', sections: [
      { name: 'Supplier Management', subsections: ['Supplier Qualification', 'Supplier Performance Scorecards'] },
      { name: 'Inventory Control', subsections: ['Cycle Counting', 'Obsolete Stock Disposal'] },
      { name: 'Logistics', subsections: ['Inbound Logistics Reliability', 'Outbound Shipment Accuracy'] },
    ]},
    { name: 'Workforce Development', sections: [
      { name: 'Skills Matrix', subsections: ['Operator Certification', 'Cross-Training'] },
      { name: 'Performance Management', subsections: ['Productivity KPIs', 'Recognition Programs'] },
      { name: 'Health & Wellbeing', subsections: ['Shift Fatigue Management', 'Occupational Health Surveillance'] },
    ]},
    { name: 'Sustainability', sections: [
      { name: 'Energy Efficiency', subsections: ['Energy Use Monitoring', 'Compressed Air Loss Reduction'] },
      { name: 'Waste Reduction', subsections: ['Scrap Rate Reduction', 'Hazardous Waste Disposal'] },
      { name: 'Emissions', subsections: ['Stack Emissions Compliance', 'Carbon Footprint Reporting'] },
    ]},
  ],
  questions: {
    'Demand Forecasting': [
      { question: 'Is a rolling 12-month demand forecast generated using statistical models and reviewed monthly?', type: 'boolean', weightage: 7 },
      { question: 'What is your current forecast accuracy (MAPE) at the SKU level?', type: 'number', hint: 'Lower is better; industry good <20%.', weightage: 6 },
    ],
    'Master Production Schedule': [
      { question: 'Is the MPS frozen for the first week to prevent disruptive late changes?', type: 'boolean', weightage: 6 },
      { question: 'How frequently are MPS adjustments made within the frozen window?', type: 'multiple_choice', options: ['Never', 'Less than 5% of weeks', '5-15% of weeks', 'More than 15% of weeks'], weightage: 5 },
    ],
    'Line Balancing': [
      { question: 'Is takt time recalculated and posted at each workstation when production volume changes?', type: 'boolean', weightage: 6 },
      { question: 'What is your current line balance efficiency percentage?', type: 'number', hint: '0-100; world-class >90%.', weightage: 5 },
    ],
    'Changeover Efficiency': [
      { question: 'Is SMED (Single-Minute Exchange of Die) methodology applied to high-changeover lines?', type: 'boolean', weightage: 6 },
      { question: 'Average changeover time, in minutes, for the most-changed line.', type: 'number', weightage: 5 },
    ],
    'Total Productive Maintenance': [
      { question: 'Is OEE (Overall Equipment Effectiveness) tracked daily for all critical equipment?', type: 'boolean', weightage: 8 },
      { question: 'Current OEE percentage on the bottleneck line.', type: 'number', hint: 'World-class is 85%+.', weightage: 6 },
    ],
    'Spare Parts Inventory': [
      { question: 'Are critical spare parts identified via FMEA and stocked at safety levels?', type: 'boolean', weightage: 6 },
      { question: 'How often does production downtime stem from missing spare parts?', type: 'multiple_choice', options: ['Almost never', 'Rarely (a few times per year)', 'Monthly', 'Weekly or more'], weightage: 7 },
    ],
    'Incoming Material Inspection': [
      { question: 'Is incoming material inspection sampled per a documented AQL plan (e.g. ANSI Z1.4)?', type: 'boolean', weightage: 7 },
      { question: 'Describe the disposition process for incoming material that fails inspection.', type: 'text', weightage: 5 },
    ],
    'In-Process Quality Checks': [
      { question: 'Are SPC charts running on critical-to-quality (CTQ) parameters with operator response rules?', type: 'boolean', weightage: 7 },
      { question: 'How are out-of-control SPC points handled before product moves to the next operation?', type: 'text', weightage: 5 },
    ],
    'Non-Conformance Handling': [
      { question: 'Is every non-conformance logged with a unique number and disposition (rework / scrap / use-as-is)?', type: 'boolean', weightage: 7 },
      { question: 'What percentage of NCRs are closed with corrective action within 30 days?', type: 'number', hint: '0-100.', weightage: 6 },
    ],
    'Customer Complaint Resolution': [
      { question: 'Is the 8D (Eight Disciplines) methodology used for major customer complaints?', type: 'boolean', weightage: 7 },
      { question: 'Median time to issue an interim containment to a customer after complaint receipt.', type: 'multiple_choice', options: ['Within 24 hours', '1-3 days', '3-7 days', 'More than 7 days'], weightage: 6 },
    ],
    'Six Sigma Projects': [
      { question: 'Are at least 2 Six Sigma / Lean projects completed annually with quantified savings?', type: 'boolean', weightage: 5 },
      { question: 'Total documented savings from improvement projects in the last fiscal year (USD).', type: 'number', weightage: 4 },
    ],
    'Root Cause Analysis': [
      { question: 'Is "5-Why" or fishbone analysis required and documented for every repeat defect?', type: 'boolean', weightage: 6 },
      { question: 'Rate the rigor of evidence used to validate identified root causes.', type: 'rating', weightage: 5 },
    ],
    'Machine Guarding': [
      { question: 'Are all rotating, cutting, and pinch-point hazards guarded per OSHA 1910.212 or equivalent?', type: 'boolean', weightage: 9 },
      { question: 'When was the last full machine-guarding audit?', type: 'multiple_choice', options: ['Within last 6 months', '6-12 months ago', '12-24 months ago', 'Over 24 months ago / never'], weightage: 7 },
    ],
    'Lockout / Tagout': [
      { question: 'Does every machine have a written, machine-specific energy-control procedure (LOTO procedure)?', type: 'boolean', weightage: 9 },
      { question: 'How frequently is LOTO compliance audited at the floor level?', type: 'multiple_choice', options: ['Monthly or more', 'Quarterly', 'Annually', 'No formal audits'], weightage: 7 },
    ],
    'PPE Compliance': [
      { question: 'Is PPE compliance observed and recorded at least weekly with non-compliance corrective action?', type: 'boolean', weightage: 6 },
      { question: 'What current PPE compliance rate is reported on the safety dashboard?', type: 'number', hint: '0-100.', weightage: 5 },
    ],
    'Ergonomic Risk Assessment': [
      { question: 'Have all manual-handling jobs been assessed using a recognised tool (RULA, REBA, NIOSH)?', type: 'boolean', weightage: 6 },
      { question: 'How are high-risk ergonomic findings prioritised for engineering controls?', type: 'text', weightage: 5 },
    ],
    'Fire & Spill Response': [
      { question: 'Are spill kits stocked at every chemical-use station and inventoried monthly?', type: 'boolean', weightage: 7 },
      { question: 'When was the last full-site evacuation drill conducted?', type: 'multiple_choice', options: ['Within last 6 months', '6-12 months ago', '12-24 months ago', 'Over 24 months ago / never'], weightage: 7 },
    ],
    'First-Aid Coverage': [
      { question: 'Is at least one trained first-aider present on every active production shift?', type: 'boolean', weightage: 8 },
      { question: 'Number of certified first-aiders per 50 production employees on the largest shift.', type: 'number', weightage: 5 },
    ],
    'Supplier Qualification': [
      { question: 'Are all new suppliers assessed via on-site or remote audit before first PO is placed?', type: 'boolean', weightage: 7 },
      { question: 'Percentage of strategic suppliers covered by signed quality agreements.', type: 'number', weightage: 6 },
    ],
    'Supplier Performance Scorecards': [
      { question: 'Are supplier scorecards (delivery, quality, cost) shared with suppliers at least quarterly?', type: 'boolean', weightage: 6 },
      { question: 'Average on-time-in-full (OTIF) percentage from your top 10 suppliers.', type: 'number', weightage: 5 },
    ],
    'Cycle Counting': [
      { question: 'Is perpetual cycle counting used in place of (or in addition to) annual physical inventory?', type: 'boolean', weightage: 6 },
      { question: 'Most recent inventory record accuracy percentage.', type: 'number', hint: 'Best-in-class >98%.', weightage: 5 },
    ],
    'Obsolete Stock Disposal': [
      { question: 'Is there a written policy defining when stock is reclassified as slow-moving or obsolete?', type: 'boolean', weightage: 4 },
      { question: 'What proportion of total inventory value is currently classified as obsolete?', type: 'number', hint: '0-100.', weightage: 5 },
    ],
    'Inbound Logistics Reliability': [
      { question: 'Are inbound carriers measured on receipt-window adherence with documented penalties for misses?', type: 'boolean', weightage: 5 },
      { question: 'Describe how dock congestion is managed during peak inbound periods.', type: 'text', weightage: 4 },
    ],
    'Outbound Shipment Accuracy': [
      { question: 'Is shipment accuracy verified by automated weight-or-scan check before leaving the dock?', type: 'boolean', weightage: 6 },
      { question: 'Customer-reported "wrong shipment" claims per 1000 shipments.', type: 'number', weightage: 5 },
    ],
    'Operator Certification': [
      { question: 'Is operator certification required and renewed for every machine they operate?', type: 'boolean', weightage: 7 },
      { question: 'How is operator competence verified after recertification?', type: 'multiple_choice', options: ['Practical test plus written exam', 'Practical test only', 'Written exam only', 'Trainer sign-off only'], weightage: 5 },
    ],
    'Cross-Training': [
      { question: 'Does the skills matrix show at least 2 trained operators per critical workstation?', type: 'boolean', weightage: 6 },
      { question: 'Average percentage of workstations with full coverage redundancy.', type: 'number', weightage: 5 },
    ],
    'Productivity KPIs': [
      { question: 'Are production KPIs (units/hour, OEE, scrap %) visualised at every line in real time?', type: 'boolean', weightage: 6 },
      { question: 'Rate the link between line-level KPIs and individual / team incentives.', type: 'rating', weightage: 4 },
    ],
    'Recognition Programs': [
      { question: 'Is there a peer-nominated recognition system tied to safety, quality, or improvement contributions?', type: 'boolean', weightage: 4 },
      { question: 'Describe how recognition is balanced across shifts and roles to avoid bias.', type: 'text', weightage: 3 },
    ],
    'Shift Fatigue Management': [
      { question: 'Are shift schedules reviewed against fatigue risk guidelines (max consecutive nights, hours)?', type: 'boolean', weightage: 6 },
      { question: 'Do operators have at least one 30-minute break per 8-hour shift in addition to short breaks?', type: 'multiple_choice', options: ['Yes always', 'Yes usually', 'Inconsistently', 'No formal requirement'], weightage: 5 },
    ],
    'Occupational Health Surveillance': [
      { question: 'Is annual hearing testing conducted for all staff exposed to >85 dB(A)?', type: 'boolean', weightage: 7 },
      { question: 'What other surveillance programs are in place?', type: 'multiple_choice', options: ['Vision, respiratory, musculoskeletal', 'Two of the above', 'One of the above', 'None'], weightage: 5 },
    ],
    'Energy Use Monitoring': [
      { question: 'Is energy consumption sub-metered at the major-asset level (not just utility bill)?', type: 'boolean', weightage: 6 },
      { question: 'Latest specific energy consumption (kWh per unit produced).', type: 'number', weightage: 5 },
    ],
    'Compressed Air Loss Reduction': [
      { question: 'Are compressed air leak surveys conducted at least annually with leaks repaired?', type: 'boolean', weightage: 5 },
      { question: 'Estimated leak rate as a percentage of total compressed air production.', type: 'number', hint: 'World-class <10%.', weightage: 4 },
    ],
    'Scrap Rate Reduction': [
      { question: 'Is scrap reported per shift, per line, with target and actual visible on the floor?', type: 'boolean', weightage: 6 },
      { question: 'Last-12-month plant scrap rate percentage.', type: 'number', weightage: 5 },
    ],
    'Hazardous Waste Disposal': [
      { question: 'Are all hazardous waste streams shipped under valid manifests with licensed disposers?', type: 'boolean', weightage: 9 },
      { question: 'How are manifests retained and made available for regulator inspection?', type: 'text', weightage: 5 },
    ],
    'Stack Emissions Compliance': [
      { question: 'Are continuous emissions monitoring data submitted to the regulator on the required cadence?', type: 'boolean', weightage: 8 },
      { question: 'Latest reported NOx emissions, in kg/year, against permit.', type: 'text', weightage: 4 },
    ],
    'Carbon Footprint Reporting': [
      { question: 'Is the plant-level Scope 1 + Scope 2 footprint calculated and reported externally each year?', type: 'boolean', weightage: 5 },
      { question: 'Rate the reliability of activity data feeding the carbon calculation.', type: 'rating', weightage: 4 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// HEALTHCARE — full structure + questions
// ─────────────────────────────────────────────────────────────
const HEALTHCARE_DEF = {
  name: 'Certified in Healthcare Quality & Patient Safety',
  certCode: 'TEST-HC-002',
  industry: 'Healthcare',
  hierarchy: [
    { name: 'Patient Safety', sections: [
      { name: 'Medication Safety', subsections: ['Drug Reconciliation', 'High-Alert Medication Handling'] },
      { name: 'Patient Identification', subsections: ['Two-Identifier Verification', 'Wristband Compliance'] },
      { name: 'Surgical Safety', subsections: ['Pre-Operative Checklist', 'Surgical Site Marking'] },
    ]},
    { name: 'Infection Prevention & Control', sections: [
      { name: 'Hand Hygiene', subsections: ['Hand-Hygiene Auditing', 'Glove Usage Discipline'] },
      { name: 'Sterilisation', subsections: ['Instrument Reprocessing', 'Sterilisation Validation'] },
      { name: 'Outbreak Response', subsections: ['Surveillance & Notification', 'Isolation Precautions'] },
    ]},
    { name: 'Clinical Quality', sections: [
      { name: 'Evidence-Based Practice', subsections: ['Care Pathway Adherence', 'Clinical Audit Cycles'] },
      { name: 'Patient Outcomes', subsections: ['Readmission Tracking', 'Mortality Review'] },
      { name: 'Diagnostic Accuracy', subsections: ['Lab Quality Control', 'Radiology Peer Review'] },
    ]},
    { name: 'Patient Experience', sections: [
      { name: 'Communication', subsections: ['Informed Consent Processes', 'Discharge Instructions Clarity'] },
      { name: 'Privacy & Dignity', subsections: ['Privacy Curtain & Gowning Compliance', 'Sensitive Information Handling'] },
      { name: 'Complaint Resolution', subsections: ['Complaint Acknowledgement Timeliness', 'Closed-Loop Feedback'] },
    ]},
    { name: 'Workforce Safety & Wellbeing', sections: [
      { name: 'Sharps & Bio-Hazard', subsections: ['Sharps Injury Prevention', 'Bio-Hazardous Spill Response'] },
      { name: 'Burnout Prevention', subsections: ['Workload Monitoring', 'Mental Health Support Access'] },
      { name: 'Workplace Violence', subsections: ['Aggression De-Escalation Training', 'Incident Reporting Compliance'] },
    ]},
    { name: 'Regulatory & Records', sections: [
      { name: 'Documentation Quality', subsections: ['Record Completeness Auditing', 'Late Entry Compliance'] },
      { name: 'Privacy Compliance', subsections: ['HIPAA / Local Privacy Adherence', 'Breach Notification Process'] },
      { name: 'Equipment & Drug Recalls', subsections: ['Recall Response Time', 'Quarantine Procedures'] },
    ]},
  ],
  questions: {
    'Drug Reconciliation': [
      { question: 'Is medication reconciliation completed at admission, transfer, and discharge by a clinically competent staff member?', type: 'boolean', weightage: 9 },
      { question: 'Average percentage of admissions where reconciliation is completed within 24 hours.', type: 'number', weightage: 7 },
    ],
    'High-Alert Medication Handling': [
      { question: 'Is independent double-check required for every high-alert medication administration?', type: 'boolean', weightage: 9 },
      { question: 'Which categories require double-check at your facility?', type: 'multiple_choice', options: ['Heparin, insulin, opioids, chemo', 'Three of the above', 'Two of the above', 'Variable / undocumented'], weightage: 7 },
    ],
    'Two-Identifier Verification': [
      { question: 'Is two-identifier verification (name + DOB or MRN) required before any clinical procedure?', type: 'boolean', weightage: 9 },
      { question: 'Compliance percentage from the most recent observational audit.', type: 'number', weightage: 6 },
    ],
    'Wristband Compliance': [
      { question: 'Are inpatient wristbands checked for accuracy and legibility at every shift handover?', type: 'boolean', weightage: 6 },
      { question: 'How are missing-wristband incidents handled?', type: 'text', weightage: 5 },
    ],
    'Pre-Operative Checklist': [
      { question: 'Is the WHO Surgical Safety Checklist (or equivalent) completed and signed for every operation?', type: 'boolean', weightage: 9 },
      { question: 'Latest completion rate from chart audit.', type: 'number', hint: '0-100.', weightage: 7 },
    ],
    'Surgical Site Marking': [
      { question: 'Is surgical site marked by the operating surgeon with the patient awake whenever possible?', type: 'boolean', weightage: 9 },
      { question: 'How are exceptions to site-marking documented?', type: 'text', weightage: 5 },
    ],
    'Hand-Hygiene Auditing': [
      { question: 'Are hand-hygiene observations conducted by trained auditors at least monthly with results posted?', type: 'boolean', weightage: 8 },
      { question: 'Latest hand-hygiene compliance percentage organization-wide.', type: 'number', weightage: 6 },
    ],
    'Glove Usage Discipline': [
      { question: 'Is glove use audited to ensure removal and hand hygiene between patients?', type: 'boolean', weightage: 6 },
      { question: 'How is over-glove use (failing to change between tasks) addressed in training?', type: 'text', weightage: 5 },
    ],
    'Instrument Reprocessing': [
      { question: 'Is reprocessing performed in a separate area following manufacturer instructions for each instrument set?', type: 'boolean', weightage: 8 },
      { question: 'How frequently are reprocessing logs audited for completeness?', type: 'multiple_choice', options: ['Daily', 'Weekly', 'Monthly', 'Never'], weightage: 6 },
    ],
    'Sterilisation Validation': [
      { question: 'Are biological indicators run on every sterilisation load with documented results?', type: 'boolean', weightage: 9 },
      { question: 'Number of failed biological indicator events in the past 12 months.', type: 'number', weightage: 6 },
    ],
    'Surveillance & Notification': [
      { question: 'Is there a surveillance system flagging healthcare-associated infections in real time?', type: 'boolean', weightage: 8 },
      { question: 'Median time to notify infection control after a positive culture.', type: 'multiple_choice', options: ['Within 4 hours', '4-12 hours', '12-24 hours', 'Over 24 hours'], weightage: 6 },
    ],
    'Isolation Precautions': [
      { question: 'Are isolation signs, PPE caddies, and dedicated equipment available immediately when isolation is ordered?', type: 'boolean', weightage: 7 },
      { question: 'Describe how staff training on isolation precaution categories is refreshed.', type: 'text', weightage: 5 },
    ],
    'Care Pathway Adherence': [
      { question: 'Is adherence to top-3 condition care pathways (e.g. AMI, sepsis, stroke) measured monthly?', type: 'boolean', weightage: 8 },
      { question: 'Latest sepsis bundle completion rate within 1 hour.', type: 'number', weightage: 7 },
    ],
    'Clinical Audit Cycles': [
      { question: 'Are clinical audits performed in closed loops (audit → action → re-audit)?', type: 'boolean', weightage: 6 },
      { question: 'Number of completed closed-loop audits in the last 12 months.', type: 'number', weightage: 5 },
    ],
    'Readmission Tracking': [
      { question: 'Are 30-day readmissions reviewed for preventability with structured analysis?', type: 'boolean', weightage: 7 },
      { question: 'Current 30-day readmission percentage for medical inpatients.', type: 'number', weightage: 6 },
    ],
    'Mortality Review': [
      { question: 'Is every inpatient mortality reviewed by a multidisciplinary mortality committee?', type: 'boolean', weightage: 8 },
      { question: 'How are findings from mortality reviews translated into practice change?', type: 'text', weightage: 6 },
    ],
    'Lab Quality Control': [
      { question: 'Is internal QC run for every lab analyte at least once per shift with documented Westgard rule application?', type: 'boolean', weightage: 7 },
      { question: 'External proficiency testing pass rate over the past 12 months.', type: 'number', weightage: 6 },
    ],
    'Radiology Peer Review': [
      { question: 'Are radiology reports peer-reviewed with at least 2% sample (RADPEER or equivalent)?', type: 'boolean', weightage: 6 },
      { question: 'How are major discrepancies escalated and learned from?', type: 'text', weightage: 5 },
    ],
    'Informed Consent Processes': [
      { question: 'Is informed consent documented with patient signature, witness, and clear list of risks/alternatives?', type: 'boolean', weightage: 8 },
      { question: 'Rate the readability of your standard consent forms for non-medical readers.', type: 'rating', weightage: 5 },
    ],
    'Discharge Instructions Clarity': [
      { question: 'Are discharge instructions provided in the patient\'s preferred language with teach-back confirmation?', type: 'boolean', weightage: 6 },
      { question: 'How is teach-back failure handled before discharge?', type: 'text', weightage: 5 },
    ],
    'Privacy Curtain & Gowning Compliance': [
      { question: 'Is the use of privacy curtains and proper gowning audited during routine ward rounds?', type: 'boolean', weightage: 5 },
      { question: 'Describe staff training on patient dignity during procedures.', type: 'text', weightage: 4 },
    ],
    'Sensitive Information Handling': [
      { question: 'Are workstations auto-locked after a defined period of inactivity to prevent unauthorised viewing?', type: 'boolean', weightage: 7 },
      { question: 'After how many minutes of inactivity does auto-lock engage?', type: 'number', weightage: 4 },
    ],
    'Complaint Acknowledgement Timeliness': [
      { question: 'Are formal complaints acknowledged within 3 working days of receipt?', type: 'boolean', weightage: 6 },
      { question: 'Median time, in days, from complaint receipt to written response.', type: 'number', weightage: 5 },
    ],
    'Closed-Loop Feedback': [
      { question: 'Are complainants informed of corrective actions taken as a result of their complaint?', type: 'boolean', weightage: 5 },
      { question: 'How are aggregated complaint themes shared with department leaders?', type: 'text', weightage: 4 },
    ],
    'Sharps Injury Prevention': [
      { question: 'Are safety-engineered sharps used wherever a clinically equivalent device is available?', type: 'boolean', weightage: 8 },
      { question: 'Number of needlestick injuries per 100 FTE in the past 12 months.', type: 'number', weightage: 6 },
    ],
    'Bio-Hazardous Spill Response': [
      { question: 'Are spill kits located within 30 metres of every clinical area and inventoried monthly?', type: 'boolean', weightage: 5 },
      { question: 'Describe the post-exposure protocol for staff after a bio-hazardous splash.', type: 'text', weightage: 6 },
    ],
    'Workload Monitoring': [
      { question: 'Are nurse-to-patient ratios tracked per shift with escalation when ratios exceed safe thresholds?', type: 'boolean', weightage: 7 },
      { question: 'How frequently does ratio fall below safe threshold on medical-surgical wards?', type: 'multiple_choice', options: ['Almost never', 'Few shifts per month', 'Weekly', 'Most shifts'], weightage: 6 },
    ],
    'Mental Health Support Access': [
      { question: 'Is confidential mental-health support (EAP or in-house counselling) available within 48 hours of request?', type: 'boolean', weightage: 6 },
      { question: 'Annual staff mental-health survey response rate.', type: 'number', weightage: 4 },
    ],
    'Aggression De-Escalation Training': [
      { question: 'Are staff in high-risk areas (ED, psych, ICU) trained in de-escalation at least annually?', type: 'boolean', weightage: 7 },
      { question: 'How are de-escalation skills assessed?', type: 'multiple_choice', options: ['Simulation with rubric', 'Written test', 'Trainer observation only', 'Self-assessment'], weightage: 5 },
    ],
    'Incident Reporting Compliance': [
      { question: 'Is the incident-reporting system anonymous-optional and accessible from every workstation?', type: 'boolean', weightage: 6 },
      { question: 'Total reported incidents per 1000 patient-days (higher often indicates better safety culture).', type: 'number', weightage: 5 },
    ],
    'Record Completeness Auditing': [
      { question: 'Are random chart audits run monthly to score completeness against required fields?', type: 'boolean', weightage: 6 },
      { question: 'Latest completeness percentage for inpatient records.', type: 'number', weightage: 5 },
    ],
    'Late Entry Compliance': [
      { question: 'Are late entries clearly labelled with reason, time of actual care, and time of entry?', type: 'boolean', weightage: 5 },
      { question: 'Describe controls preventing back-dating in the EHR.', type: 'text', weightage: 4 },
    ],
    'HIPAA / Local Privacy Adherence': [
      { question: 'Has every workforce member completed privacy training in the past 12 months?', type: 'boolean', weightage: 8 },
      { question: 'Number of confirmed privacy incidents in the past 12 months.', type: 'number', weightage: 7 },
    ],
    'Breach Notification Process': [
      { question: 'Is there a documented breach notification SOP including regulator and patient notification timelines?', type: 'boolean', weightage: 8 },
      { question: 'What is the regulator notification deadline you operate to (in hours)?', type: 'number', weightage: 5 },
    ],
    'Recall Response Time': [
      { question: 'Are device and drug recalls actioned within 48 hours of receipt with affected stock identified?', type: 'boolean', weightage: 8 },
      { question: 'Median hours from recall receipt to physical removal of stock.', type: 'number', weightage: 6 },
    ],
    'Quarantine Procedures': [
      { question: 'Is recalled or suspect stock physically segregated and clearly labelled to prevent re-use?', type: 'boolean', weightage: 7 },
      { question: 'Describe the disposition pathway after stock is quarantined.', type: 'text', weightage: 5 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// RETAIL OPERATIONS
// ─────────────────────────────────────────────────────────────
const RETAIL_DEF = {
  name: 'Certified in Retail Operations Excellence',
  certCode: 'TEST-RET-002',
  industry: 'Retail',
  hierarchy: [
    { name: 'Store Operations', sections: [
      { name: 'Opening & Closing', subsections: ['Cash Drawer Reconciliation', 'Premises Security Walk-Through'] },
      { name: 'Visual Merchandising', subsections: ['Planogram Compliance', 'In-Store Signage Refresh'] },
      { name: 'Customer Service Floor', subsections: ['Greeting & Approach Standards', 'Mystery Shopper Score'] },
    ]},
    { name: 'Inventory & Stock', sections: [
      { name: 'Stock Accuracy', subsections: ['Cycle Counting Cadence', 'Shrink Investigation'] },
      { name: 'Replenishment', subsections: ['Auto-Replenishment Triggers', 'Backroom Organisation'] },
      { name: 'Stockroom Safety', subsections: ['Manual Handling Training', 'Stockroom Aisle Clearance'] },
    ]},
    { name: 'Loss Prevention', sections: [
      { name: 'Theft Prevention', subsections: ['EAS Tag Application', 'CCTV Coverage Audit'] },
      { name: 'Fraud Detection', subsections: ['Refund Anomaly Monitoring', 'Employee Discount Misuse Checks'] },
      { name: 'Cash Handling', subsections: ['Mid-Shift Pickup Frequency', 'Safe Access Authorisation'] },
    ]},
    { name: 'Customer Experience', sections: [
      { name: 'Loyalty Programs', subsections: ['Enrolment Conversion', 'Member Retention Tracking'] },
      { name: 'Returns & Exchanges', subsections: ['Return Reason Capture', 'Exchange Processing Time'] },
      { name: 'Omnichannel Fulfilment', subsections: ['Buy-Online-Pickup-In-Store Speed', 'Click-and-Collect Accuracy'] },
    ]},
    { name: 'People & Training', sections: [
      { name: 'Staff Onboarding', subsections: ['POS System Training', 'Brand Story & Product Knowledge'] },
      { name: 'Performance Coaching', subsections: ['One-on-One Frequency', 'Sales Target vs Actual'] },
      { name: 'Schedule Optimisation', subsections: ['Coverage at Peak Hours', 'Last-Minute Schedule Changes'] },
    ]},
    { name: 'Compliance & Sustainability', sections: [
      { name: 'Pricing Compliance', subsections: ['Shelf-Edge Price Accuracy', 'Promotion Expiry Removal'] },
      { name: 'Health & Safety', subsections: ['Spill Cleanup Protocol', 'Emergency Exit Clearance'] },
      { name: 'Sustainability', subsections: ['Single-Use Plastic Reduction', 'In-Store Recycling Bins'] },
    ]},
  ],
  questions: {
    'Cash Drawer Reconciliation': [
      { question: 'Is each cashier\'s drawer reconciled at the end of every shift with variances over 5 USD investigated?', type: 'boolean', weightage: 7 },
      { question: 'Average end-of-day variance across all cashiers, in USD.', type: 'number', weightage: 5 },
    ],
    'Premises Security Walk-Through': [
      { question: 'Is a documented closing walk-through performed checking fitting rooms, stockroom, and back exits?', type: 'boolean', weightage: 6 },
      { question: 'Describe alarm activation/deactivation accountability.', type: 'text', weightage: 5 },
    ],
    'Planogram Compliance': [
      { question: 'Are planogram audits performed at least weekly with photographic evidence?', type: 'boolean', weightage: 6 },
      { question: 'Latest planogram compliance percentage from district audit.', type: 'number', weightage: 5 },
    ],
    'In-Store Signage Refresh': [
      { question: 'Are promotional signs removed within 24 hours of campaign expiry?', type: 'boolean', weightage: 5 },
      { question: 'Number of expired signs found in last secret-shopper visit.', type: 'number', weightage: 4 },
    ],
    'Greeting & Approach Standards': [
      { question: 'Are greeting and approach standards observed and coached by management daily?', type: 'boolean', weightage: 5 },
      { question: 'How is greeting compliance measured?', type: 'multiple_choice', options: ['Customer survey + manager observation', 'Manager observation only', 'Customer survey only', 'Not measured'], weightage: 4 },
    ],
    'Mystery Shopper Score': [
      { question: 'Are mystery shopper visits conducted at least monthly with results discussed in team huddles?', type: 'boolean', weightage: 5 },
      { question: 'Last reported mystery shopper score (0-100).', type: 'number', weightage: 4 },
    ],
    'Cycle Counting Cadence': [
      { question: 'Is cycle counting scheduled so every SKU is counted at least quarterly?', type: 'boolean', weightage: 6 },
      { question: 'Current inventory record accuracy percentage.', type: 'number', weightage: 5 },
    ],
    'Shrink Investigation': [
      { question: 'Are top shrink categories investigated within 30 days of identification?', type: 'boolean', weightage: 7 },
      { question: 'Annual shrink as a percentage of net sales.', type: 'number', hint: 'Industry average ~1.4%.', weightage: 6 },
    ],
    'Auto-Replenishment Triggers': [
      { question: 'Does the replenishment system reorder based on real-time POS data rather than fixed minimums?', type: 'boolean', weightage: 5 },
      { question: 'Average days of cover for fast-moving SKUs.', type: 'number', weightage: 4 },
    ],
    'Backroom Organisation': [
      { question: 'Is backroom layout zoned and labelled so any staff member can locate stock within 60 seconds?', type: 'boolean', weightage: 5 },
      { question: 'Describe how oversized inbound shipments are handled without blocking aisles.', type: 'text', weightage: 4 },
    ],
    'Manual Handling Training': [
      { question: 'Are all stockroom staff certified in manual handling within their first 30 days?', type: 'boolean', weightage: 7 },
      { question: 'Number of musculoskeletal injuries reported per 100 FTE in last 12 months.', type: 'number', weightage: 6 },
    ],
    'Stockroom Aisle Clearance': [
      { question: 'Is at least 1 metre of aisle clearance maintained at all times for emergency egress?', type: 'boolean', weightage: 7 },
      { question: 'How frequently is aisle clearance audited?', type: 'multiple_choice', options: ['Each shift', 'Daily', 'Weekly', 'Less than weekly'], weightage: 5 },
    ],
    'EAS Tag Application': [
      { question: 'Is EAS (electronic article surveillance) tag application audited weekly with feedback to staff?', type: 'boolean', weightage: 6 },
      { question: 'Percentage of high-shrink categories that are 100% EAS-tagged.', type: 'number', weightage: 6 },
    ],
    'CCTV Coverage Audit': [
      { question: 'Is CCTV coverage of high-shrink areas verified annually with no blind spots?', type: 'boolean', weightage: 5 },
      { question: 'Retention period of CCTV footage in days.', type: 'number', weightage: 4 },
    ],
    'Refund Anomaly Monitoring': [
      { question: 'Are refund patterns analysed centrally to flag suspicious cashier or customer behaviour?', type: 'boolean', weightage: 6 },
      { question: 'How are flagged refund cases investigated?', type: 'text', weightage: 5 },
    ],
    'Employee Discount Misuse Checks': [
      { question: 'Are employee discount transactions sampled monthly to detect ineligible purchases?', type: 'boolean', weightage: 5 },
      { question: 'What is the maximum employee-discount value before manager approval is required?', type: 'number', weightage: 4 },
    ],
    'Mid-Shift Pickup Frequency': [
      { question: 'Are cash pickups from registers performed when drawers exceed a defined threshold rather than only at shift end?', type: 'boolean', weightage: 5 },
      { question: 'Pickup-trigger threshold per drawer (USD).', type: 'number', weightage: 4 },
    ],
    'Safe Access Authorisation': [
      { question: 'Is safe access logged with combination changes whenever an authorised person leaves the company?', type: 'boolean', weightage: 7 },
      { question: 'Last combination change date (months ago).', type: 'number', weightage: 4 },
    ],
    'Enrolment Conversion': [
      { question: 'Is loyalty enrolment offered at every checkout with conversion tracked per cashier?', type: 'boolean', weightage: 5 },
      { question: 'Current loyalty enrolment conversion rate (%).', type: 'number', weightage: 4 },
    ],
    'Member Retention Tracking': [
      { question: 'Is loyalty member 12-month retention measured and reported monthly?', type: 'boolean', weightage: 5 },
      { question: 'Latest 12-month active retention percentage.', type: 'number', weightage: 4 },
    ],
    'Return Reason Capture': [
      { question: 'Is a structured return-reason captured at every return for trend analysis?', type: 'boolean', weightage: 5 },
      { question: 'Top return reason category over the past quarter.', type: 'text', weightage: 4 },
    ],
    'Exchange Processing Time': [
      { question: 'Are exchanges processed in under 5 minutes per transaction at peak hours?', type: 'boolean', weightage: 4 },
      { question: 'Average exchange processing time, in minutes.', type: 'number', weightage: 3 },
    ],
    'Buy-Online-Pickup-In-Store Speed': [
      { question: 'Is BOPIS order ready for pickup within the SLA stated to the customer (e.g. 2 hours)?', type: 'boolean', weightage: 6 },
      { question: 'Latest on-time BOPIS-ready percentage.', type: 'number', weightage: 5 },
    ],
    'Click-and-Collect Accuracy': [
      { question: 'Are click-and-collect orders verified against the picking list before customer handover?', type: 'boolean', weightage: 5 },
      { question: 'Mis-pick percentage reported by customers in the last 30 days.', type: 'number', weightage: 5 },
    ],
    'POS System Training': [
      { question: 'Is every new associate certified on the POS within their first 7 working days?', type: 'boolean', weightage: 6 },
      { question: 'How is POS competence verified after training?', type: 'multiple_choice', options: ['Live shift with shadow + checklist', 'Trainer sign-off only', 'Online quiz only', 'No formal verification'], weightage: 5 },
    ],
    'Brand Story & Product Knowledge': [
      { question: 'Is product-knowledge training refreshed every quarter when ranges change?', type: 'boolean', weightage: 4 },
      { question: 'Describe how niche product expertise (e.g. wine, electronics) is maintained.', type: 'text', weightage: 4 },
    ],
    'One-on-One Frequency': [
      { question: 'Do all associates receive at least one documented one-on-one with their manager every 4 weeks?', type: 'boolean', weightage: 5 },
      { question: 'How are coaching notes used in performance reviews?', type: 'text', weightage: 3 },
    ],
    'Sales Target vs Actual': [
      { question: 'Are weekly sales targets set per associate with results visible to the team?', type: 'boolean', weightage: 4 },
      { question: 'Average team sales-target attainment over the past quarter (%).', type: 'number', weightage: 4 },
    ],
    'Coverage at Peak Hours': [
      { question: 'Is rostering data-driven using historical traffic patterns?', type: 'boolean', weightage: 6 },
      { question: 'Percentage of peak hours over the past month meeting target staff coverage.', type: 'number', weightage: 5 },
    ],
    'Last-Minute Schedule Changes': [
      { question: 'Are schedule changes made within 48 hours of shift start tracked and reported to senior management?', type: 'boolean', weightage: 4 },
      { question: 'How is staff impact of last-minute changes mitigated?', type: 'text', weightage: 3 },
    ],
    'Shelf-Edge Price Accuracy': [
      { question: 'Is shelf-edge pricing audited weekly with mismatches corrected within the same day?', type: 'boolean', weightage: 6 },
      { question: 'Latest shelf-edge price accuracy percentage.', type: 'number', weightage: 5 },
    ],
    'Promotion Expiry Removal': [
      { question: 'Are promotion-end items reverted in the system at the exact expiry minute to prevent overcharging?', type: 'boolean', weightage: 6 },
      { question: 'Number of customer overcharges in the past quarter.', type: 'number', weightage: 5 },
    ],
    'Spill Cleanup Protocol': [
      { question: 'Is the wet-floor protocol (sign + cordon + cleanup) implemented within 5 minutes of report?', type: 'boolean', weightage: 7 },
      { question: 'Slip/trip injuries per 1000 customer visits in the past 12 months.', type: 'number', weightage: 6 },
    ],
    'Emergency Exit Clearance': [
      { question: 'Are emergency exits and fire equipment clear of obstruction at all times during trading hours?', type: 'boolean', weightage: 8 },
      { question: 'How frequently are exit-route inspections performed?', type: 'multiple_choice', options: ['Every shift', 'Daily', 'Weekly', 'Less frequent'], weightage: 6 },
    ],
    'Single-Use Plastic Reduction': [
      { question: 'Has the store implemented a charge or alternative for single-use shopping bags?', type: 'boolean', weightage: 4 },
      { question: 'Reduction in single-use plastic bag distribution year-over-year (%).', type: 'number', weightage: 3 },
    ],
    'In-Store Recycling Bins': [
      { question: 'Are customer-facing recycling bins available for paper, plastic, and glass with clear signage?', type: 'boolean', weightage: 4 },
      { question: 'Approximate percentage of in-store waste diverted from landfill.', type: 'number', weightage: 4 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// INFORMATION SECURITY (ISMS) — full structure + questions
// ─────────────────────────────────────────────────────────────
const ISMS_DEF = {
  name: 'Certified in Information Security Management',
  certCode: 'TEST-ISM-002',
  industry: 'technology',
  hierarchy: [
    { name: 'Governance & Risk', sections: [
      { name: 'Information Security Policy', subsections: ['Policy Approval & Communication', 'Annual Policy Review'] },
      { name: 'Risk Management', subsections: ['Asset Inventory', 'Risk Treatment Plan'] },
      { name: 'Compliance Mapping', subsections: ['Regulatory Mapping', 'Internal Audit Cycles'] },
    ]},
    { name: 'Identity & Access', sections: [
      { name: 'Access Control', subsections: ['Role-Based Access (RBAC)', 'Privileged Access Reviews'] },
      { name: 'Authentication', subsections: ['Multi-Factor Authentication', 'Password Policy Enforcement'] },
      { name: 'User Lifecycle', subsections: ['Joiner-Mover-Leaver Workflow', 'Service Account Governance'] },
    ]},
    { name: 'Operations Security', sections: [
      { name: 'Vulnerability Management', subsections: ['Patch SLA Adherence', 'Vulnerability Scan Cadence'] },
      { name: 'Endpoint Security', subsections: ['EDR Deployment Coverage', 'Removable Media Controls'] },
      { name: 'Logging & Monitoring', subsections: ['Centralised Log Collection', 'Security Alert Tuning'] },
    ]},
    { name: 'Network & Cloud', sections: [
      { name: 'Network Segmentation', subsections: ['Production / Dev Separation', 'Zero-Trust Initiatives'] },
      { name: 'Cloud Security', subsections: ['IaC Configuration Scanning', 'Cloud Identity Federation'] },
      { name: 'Encryption', subsections: ['Data-in-Transit Encryption', 'Key Management Lifecycle'] },
    ]},
    { name: 'Incident & Resilience', sections: [
      { name: 'Incident Response', subsections: ['IR Playbook Coverage', 'Post-Incident Review'] },
      { name: 'Business Continuity', subsections: ['BCP Tabletop Exercises', 'RTO/RPO Validation'] },
      { name: 'Backup & Recovery', subsections: ['Backup Restore Testing', 'Immutable Backup Adoption'] },
    ]},
    { name: 'Supplier & Awareness', sections: [
      { name: 'Third-Party Risk', subsections: ['Supplier Security Assessments', 'Supplier Contract Clauses'] },
      { name: 'Awareness & Training', subsections: ['Phishing Simulation Frequency', 'Annual Security Training Completion'] },
      { name: 'Privacy & Data Protection', subsections: ['Data Classification Discipline', 'Data Subject Request SLA'] },
    ]},
  ],
  questions: {
    'Policy Approval & Communication': [
      { question: 'Is the information security policy approved by the executive management and version-controlled?', type: 'boolean', weightage: 8 },
      { question: 'How is the policy made discoverable to all staff?', type: 'multiple_choice', options: ['Mandatory acknowledgement at onboarding + annual', 'Intranet posting only', 'On request', 'Not formally communicated'], weightage: 5 },
    ],
    'Annual Policy Review': [
      { question: 'Has the policy been reviewed within the last 12 months with documented evidence?', type: 'boolean', weightage: 6 },
      { question: 'Date of last review (year-month).', type: 'text', weightage: 3 },
    ],
    'Asset Inventory': [
      { question: 'Is there a single source of truth for IT asset inventory updated within 7 days of change?', type: 'boolean', weightage: 7 },
      { question: 'Latest reconciliation accuracy between CMDB and discovery scan (%).', type: 'number', weightage: 6 },
    ],
    'Risk Treatment Plan': [
      { question: 'Are top-10 risks tracked with named owner, treatment, and target close date?', type: 'boolean', weightage: 7 },
      { question: 'Number of overdue risk treatment actions currently open.', type: 'number', weightage: 5 },
    ],
    'Regulatory Mapping': [
      { question: 'Are applicable regulations (GDPR, HIPAA, SOC 2, ISO 27001) mapped to controls in your ISMS?', type: 'boolean', weightage: 6 },
      { question: 'Describe how regulatory changes are tracked and incorporated.', type: 'text', weightage: 5 },
    ],
    'Internal Audit Cycles': [
      { question: 'Is an internal audit performed against ISMS controls at least annually with findings tracked?', type: 'boolean', weightage: 6 },
      { question: 'Number of major non-conformities open from last internal audit.', type: 'number', weightage: 5 },
    ],
    'Role-Based Access (RBAC)': [
      { question: 'Are user permissions assigned through roles rather than direct grants for at least 95% of systems?', type: 'boolean', weightage: 7 },
      { question: 'Latest percentage of systems migrated to RBAC.', type: 'number', weightage: 6 },
    ],
    'Privileged Access Reviews': [
      { question: 'Are privileged accounts reviewed quarterly with sign-off from the system owner?', type: 'boolean', weightage: 8 },
      { question: 'How many dormant privileged accounts were removed in the last review cycle?', type: 'number', weightage: 5 },
    ],
    'Multi-Factor Authentication': [
      { question: 'Is MFA enforced for all administrative interfaces and remote access without exception?', type: 'boolean', weightage: 9 },
      { question: 'Coverage of MFA across employee accounts (%).', type: 'number', weightage: 7 },
    ],
    'Password Policy Enforcement': [
      { question: 'Are passwords required to meet length and complexity rules and screened against breached-password lists?', type: 'boolean', weightage: 6 },
      { question: 'Minimum password length enforced.', type: 'number', weightage: 4 },
    ],
    'Joiner-Mover-Leaver Workflow': [
      { question: 'Is access automatically deprovisioned within 24 hours of leaver notification?', type: 'boolean', weightage: 8 },
      { question: 'Average time, in hours, from leaver effective date to last access removal.', type: 'number', weightage: 6 },
    ],
    'Service Account Governance': [
      { question: 'Are service accounts inventoried with named owners and reviewed every 6 months?', type: 'boolean', weightage: 6 },
      { question: 'Number of service accounts with shared/unowned credentials currently in use.', type: 'number', weightage: 6 },
    ],
    'Patch SLA Adherence': [
      { question: 'Are critical patches applied to production within 14 days of vendor release?', type: 'boolean', weightage: 9 },
      { question: 'Latest 30-day SLA compliance rate (%).', type: 'number', weightage: 7 },
    ],
    'Vulnerability Scan Cadence': [
      { question: 'Are external-facing assets scanned at least weekly and internal assets at least monthly?', type: 'boolean', weightage: 7 },
      { question: 'How are vulnerabilities prioritised when SLA cannot be met?', type: 'text', weightage: 5 },
    ],
    'EDR Deployment Coverage': [
      { question: 'Is EDR (endpoint detection and response) deployed to ≥98% of company endpoints?', type: 'boolean', weightage: 7 },
      { question: 'Latest EDR coverage percentage.', type: 'number', weightage: 6 },
    ],
    'Removable Media Controls': [
      { question: 'Are USB ports default-blocked with exceptions requiring documented business justification?', type: 'boolean', weightage: 6 },
      { question: 'Describe DLP controls applied when removable media is permitted.', type: 'text', weightage: 5 },
    ],
    'Centralised Log Collection': [
      { question: 'Are security logs from critical systems forwarded to a SIEM within 5 minutes of event?', type: 'boolean', weightage: 7 },
      { question: 'Median ingestion latency, in minutes, from event to SIEM availability.', type: 'number', weightage: 5 },
    ],
    'Security Alert Tuning': [
      { question: 'Is the SIEM detection ruleset reviewed at least quarterly to reduce false positives?', type: 'boolean', weightage: 6 },
      { question: 'False-positive rate of high-severity alerts in the last 30 days (%).', type: 'number', weightage: 5 },
    ],
    'Production / Dev Separation': [
      { question: 'Are production and non-production environments network-segmented with no shared credentials?', type: 'boolean', weightage: 8 },
      { question: 'How are developer breakglass access requests handled?', type: 'text', weightage: 5 },
    ],
    'Zero-Trust Initiatives': [
      { question: 'Has any zero-trust principle (continuous verification, least privilege, device posture) been implemented for at least one critical service?', type: 'boolean', weightage: 5 },
      { question: 'Rate the maturity of your zero-trust roadmap.', type: 'rating', weightage: 4 },
    ],
    'IaC Configuration Scanning': [
      { question: 'Are IaC templates scanned for misconfigurations before merge to main branch?', type: 'boolean', weightage: 6 },
      { question: 'Average number of high-severity IaC findings per week.', type: 'number', weightage: 5 },
    ],
    'Cloud Identity Federation': [
      { question: 'Are cloud accounts federated with the corporate IdP (no local admin users) for at least 90% of cloud subscriptions?', type: 'boolean', weightage: 6 },
      { question: 'Percentage of cloud accounts on federated identity.', type: 'number', weightage: 5 },
    ],
    'Data-in-Transit Encryption': [
      { question: 'Is TLS 1.2 or higher enforced on all internet-facing endpoints with TLS 1.0/1.1 disabled?', type: 'boolean', weightage: 8 },
      { question: 'How frequently are TLS scans run against external endpoints?', type: 'multiple_choice', options: ['Continuously / weekly', 'Monthly', 'Quarterly', 'Less frequently / never'], weightage: 6 },
    ],
    'Key Management Lifecycle': [
      { question: 'Are cryptographic keys rotated on a defined schedule with rotation failures alerted?', type: 'boolean', weightage: 7 },
      { question: 'Maximum key lifetime, in days, for production data-encryption keys.', type: 'number', weightage: 5 },
    ],
    'IR Playbook Coverage': [
      { question: 'Are IR playbooks defined for the top-5 incident scenarios (ransomware, BEC, data breach, DDoS, insider)?', type: 'boolean', weightage: 8 },
      { question: 'Describe how playbook ownership is assigned across IT and Security teams.', type: 'text', weightage: 5 },
    ],
    'Post-Incident Review': [
      { question: 'Is a blameless post-incident review held within 7 days of every Sev-1 incident?', type: 'boolean', weightage: 7 },
      { question: 'How many of last year\'s post-incident actions are still open?', type: 'number', weightage: 5 },
    ],
    'BCP Tabletop Exercises': [
      { question: 'Is at least one full BCP tabletop exercise conducted annually with executive participation?', type: 'boolean', weightage: 6 },
      { question: 'Date of most recent tabletop exercise (year-month).', type: 'text', weightage: 4 },
    ],
    'RTO/RPO Validation': [
      { question: 'Are stated Recovery Time and Recovery Point Objectives proven through actual recovery testing each year?', type: 'boolean', weightage: 7 },
      { question: 'How are deviations between target and tested RTO addressed?', type: 'text', weightage: 5 },
    ],
    'Backup Restore Testing': [
      { question: 'Are backup restore tests performed at least monthly on critical systems?', type: 'boolean', weightage: 8 },
      { question: 'Percentage of restore tests completed successfully on first attempt.', type: 'number', weightage: 7 },
    ],
    'Immutable Backup Adoption': [
      { question: 'Are at least one set of backups stored in an immutable / air-gapped state to defend against ransomware?', type: 'boolean', weightage: 8 },
      { question: 'Retention period of immutable copies, in days.', type: 'number', weightage: 6 },
    ],
    'Supplier Security Assessments': [
      { question: 'Are critical suppliers risk-assessed before contract signature and reviewed annually thereafter?', type: 'boolean', weightage: 7 },
      { question: 'Percentage of critical suppliers with current security assessment on file.', type: 'number', weightage: 6 },
    ],
    'Supplier Contract Clauses': [
      { question: 'Do supplier contracts include breach notification, audit rights, and data-handling clauses?', type: 'boolean', weightage: 7 },
      { question: 'How are contract gaps remediated mid-contract?', type: 'text', weightage: 5 },
    ],
    'Phishing Simulation Frequency': [
      { question: 'Are phishing simulations sent at least quarterly to all staff with targeted training for click-throughs?', type: 'boolean', weightage: 6 },
      { question: 'Latest phish click-through rate (%).', type: 'number', weightage: 5 },
    ],
    'Annual Security Training Completion': [
      { question: 'Have ≥98% of staff completed the mandatory annual security awareness training?', type: 'boolean', weightage: 6 },
      { question: 'Current completion percentage.', type: 'number', weightage: 5 },
    ],
    'Data Classification Discipline': [
      { question: 'Is data classified into defined tiers (e.g. Public, Internal, Confidential, Restricted) with handling rules per tier?', type: 'boolean', weightage: 6 },
      { question: 'Describe how classification is enforced when staff create new documents/datasets.', type: 'text', weightage: 5 },
    ],
    'Data Subject Request SLA': [
      { question: 'Are data subject requests (access, deletion) responded to within the regulatory deadline (e.g. 30 days)?', type: 'boolean', weightage: 7 },
      { question: 'Last 12-month average response time (days).', type: 'number', weightage: 5 },
    ],
  },
};

const NEW_CERTS = [MANUFACTURING_DEF, HEALTHCARE_DEF, RETAIL_DEF, ISMS_DEF];

// ─────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label) {
  let lastErr;
  for (let i = 0; i < 5; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const code = e.code || e.response?.status;
      const transient =
        e.code === 'ECONNRESET' ||
        e.code === 'ETIMEDOUT' ||
        e.code === 'ECONNREFUSED' ||
        e.code === 'EAI_AGAIN' ||
        code === 502 || code === 503 || code === 504 || code === 429;
      if (!transient) throw e;
      const wait = 700 * Math.pow(2, i);
      console.warn(`   ↻ retry ${i + 1}/5 for ${label}: ${e.code || code} — waiting ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

function makeClient(token) {
  const client = axios.create({
    baseURL: CONFIG.BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  // Wrap every request method to retry + pace
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const original = client[method].bind(client);
    client[method] = async (...args) => {
      const r = await withRetry(() => original(...args), `${method.toUpperCase()} ${args[0]}`);
      await sleep(200); // 5 req/s pacing
      return r;
    };
  }
  return client;
}

async function login() {
  const { data } = await makeClient().post('/auth/login', {
    email: CONFIG.ADMIN_EMAIL, password: CONFIG.ADMIN_PASSWORD,
  });
  return data?.tokens?.access_token;
}

async function listIndustries(client) {
  const { data } = await client.get('/industries?page=1&limit=100');
  const raw = data?.data?.industries || data?.data?.data || data?.data || [];
  const list = Array.isArray(raw) ? raw : raw.industries || [];
  const m = new Map();
  for (const i of list) m.set(String(i.name).toLowerCase(), i.id);
  return m;
}

async function ensureIndustry(client, idMap, name) {
  if (idMap.has(name.toLowerCase())) return idMap.get(name.toLowerCase());
  const { data } = await client.post('/industries', { name });
  const id = data?.data?.id || data?.id;
  idMap.set(name.toLowerCase(), id);
  return id;
}

async function createCertificate(client, def, industryId) {
  const { data } = await client.post('/certificates', {
    certificate_id: def.certCode,
    name: def.name,
    industry_ids: [industryId],
    disclosure_price: 1500,
    assured_price: 2500,
    validity_years: 1,
    description: TEST_DESC,
    is_published: false,            // ← UNPUBLISHED per requirement
    badges: STANDARD_BADGES,
  });
  return data?.data?.id || data?.id;
}

async function createMainSections(client, certId, hierarchy) {
  const { data } = await client.post(`/certificates/${certId}/main-sections`, {
    sections: hierarchy.map((m, i) => ({ name: m.name, rank: i + 1 })),
  });
  const map = new Map();
  for (const item of (data?.data || [])) map.set(item.name, item.id);
  return map;
}

async function createChildren(client, parentId, parentType, names) {
  const { data } = await client.post(`/sections/${parentId}/subsections`, {
    parent_type: parentType,
    sections: names.map((name, i) => ({ name, rank: i + 1 })),
  });
  const map = new Map();
  for (const item of (data?.data || [])) map.set(item.name, item.id);
  return map;
}

async function addQuestionsTo(client, sectionId, questions) {
  await client.post(`/sections/${sectionId}/questions`, {
    section_type: 'sub_section',
    questions,
  });
}

// Track every question text we've ever sent — fail-loud if we'd send a duplicate
const sentQuestionTexts = new Set();
function pickQuestions(map, subsectionName) {
  const qs = map[subsectionName];
  if (!qs) {
    console.warn(`     ⚠ no questions defined for "${subsectionName}"`);
    return [];
  }
  for (const q of qs) {
    if (sentQuestionTexts.has(q.question)) {
      throw new Error(`Duplicate question text would be sent: "${q.question}"`);
    }
    sentQuestionTexts.add(q.question);
  }
  return qs;
}

async function seedQuestionsForExistingHospitality(client) {
  console.log(`\n→ Adding genuine questions to Hospitality cert (${HOSPITALITY_ID})`);
  const { data: cert } = await client.get(
    `/certificates/${HOSPITALITY_ID}?include=sections,subsections,questions`,
  );
  const root = cert?.data || cert;

  // Walk to find subsection IDs by name
  const subIdByName = new Map();
  function walk(o) {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o && typeof o === 'object') {
      // is_third_level subsection has id and name
      if (o.id && o.name && (o.questions !== undefined || o.is_third_level === true)) {
        // could be section or subsection — store anyway, lookup keyed on name
        subIdByName.set(o.name, o.id);
      }
      Object.values(o).forEach(walk);
    }
  }
  walk(root);

  let total = 0;
  for (const subName of Object.keys(HOSPITALITY_QUESTIONS)) {
    const subId = subIdByName.get(subName);
    if (!subId) {
      console.warn(`   ⚠ subsection not found: ${subName}`);
      continue;
    }
    const qs = pickQuestions(HOSPITALITY_QUESTIONS, subName);
    await addQuestionsTo(client, subId, qs);
    total += qs.length;
    console.log(`   ✓ ${subName} (+${qs.length})`);
  }
  console.log(`   → added ${total} hospitality questions`);
}

async function seedFreshCertificate(client, def, industryIdMap) {
  console.log(`\n→ Creating cert "${def.name}" (industry: ${def.industry})`);
  const indId = await ensureIndustry(client, industryIdMap, def.industry);
  const certId = await createCertificate(client, def, indId);
  console.log(`   created id: ${certId}`);

  const mainIds = await createMainSections(client, certId, def.hierarchy);
  let secCount = 0, subCount = 0, qCount = 0;
  for (const main of def.hierarchy) {
    const mid = mainIds.get(main.name);
    if (!mid) continue;
    const secIds = await createChildren(client, mid, 'main', main.sections.map((s) => s.name));
    for (const sec of main.sections) {
      const sid = secIds.get(sec.name);
      if (!sid) continue;
      secCount += 1;
      const subIds = await createChildren(client, sid, 'section', sec.subsections);
      for (const subName of sec.subsections) {
        const subId = subIds.get(subName);
        if (!subId) continue;
        subCount += 1;
        const qs = pickQuestions(def.questions, subName);
        if (qs.length) {
          await addQuestionsTo(client, subId, qs);
          qCount += qs.length;
        }
      }
    }
  }
  console.log(`   structure: ${mainIds.size} main / ${secCount} sections / ${subCount} subsections / ${qCount} questions`);
  return { id: certId, mains: mainIds.size, sections: secCount, subsections: subCount, questions: qCount };
}

(async () => {
  console.log('━━━ Genuine-Question Seeder ━━━');
  console.log(`Backend: ${CONFIG.BASE_URL}`);

  const token = await login();
  const client = makeClient(token);
  const industryIdMap = await listIndustries(client);

  // 1. Hospitality (already has structure, just add questions)
  await seedQuestionsForExistingHospitality(client);

  // 2. Four new unpublished certs
  const summary = [];
  for (const def of NEW_CERTS) {
    try {
      const res = await seedFreshCertificate(client, def, industryIdMap);
      summary.push({ name: def.name, ok: true, ...res });
    } catch (e) {
      const status = e.response?.status;
      const body = e.response?.data;
      console.error(`   ✗ FAILED: ${status} ${JSON.stringify(body || e.message)}`);
      summary.push({ name: def.name, ok: false, error: status || e.message });
    }
  }

  console.log('\n━━━ SUMMARY ━━━');
  console.log(`Distinct questions sent: ${sentQuestionTexts.size}`);
  for (const s of summary) {
    if (s.ok) console.log(`✓ ${s.name} → ${s.id} (${s.questions} q)`);
    else console.log(`✗ ${s.name} → ${s.error}`);
  }
})().catch((e) => {
  console.error('FATAL:', e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
