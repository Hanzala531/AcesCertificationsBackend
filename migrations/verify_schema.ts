import { Client } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

// Configuration
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "aces_test",
};

interface ColumnDefinition {
  name: string;
  type: string | string[];
  nullable: boolean | "any";
  isArray?: boolean;
}

// Expected Schema Definition based on your unified migration files
const expectedSchema: Record<string, ColumnDefinition[]> = {
  users: [
    { name: "id", type: "uuid", nullable: false },
    { name: "email", type: "character varying", nullable: false },
    { name: "password", type: "text", nullable: false },
    { name: "role", type: "user_role", nullable: false }, // Enum
    { name: "is_active", type: "boolean", nullable: false },
    { name: "is_deleted", type: "boolean", nullable: false },
    { name: "is_verified", type: "boolean", nullable: false },
    { name: "email_verified", type: "boolean", nullable: false },
    { name: "login_attempts", type: "integer", nullable: false },
    { name: "refresh_token", type: "text", nullable: true },
    { name: "last_login", type: "timestamp with time zone", nullable: true },
    { name: "locked_until", type: "timestamp with time zone", nullable: true },
    { name: "last_failed_login", type: "timestamp with time zone", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  login_logs: [
    { name: "id", type: "uuid", nullable: false },
    { name: "user_id", type: "uuid", nullable: false },
    { name: "email", type: "character varying", nullable: false },
    { name: "device", type: "text", nullable: true },
    { name: "location", type: "character varying", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
  ],
  otp: [
    { name: "id", type: "uuid", nullable: false },
    { name: "user_id", type: "uuid", nullable: false },
    { name: "otp_code", type: "character varying", nullable: false },
    { name: "purpose", type: ["otp_purpose", "character varying", "text"], nullable: "any" }, // Enum or varchar
    { name: "expires_at", type: "timestamp with time zone", nullable: false },
    { name: "is_used", type: "boolean", nullable: "any" },
    { name: "attempts", type: "integer", nullable: "any" },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
  ],
  industry: [
    { name: "id", type: "uuid", nullable: false },
    { name: "name", type: "character varying", nullable: false },
    { name: "created_by", type: "uuid", nullable: true },
    { name: "updated_by", type: "uuid", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  organization: [
    { name: "id", type: "uuid", nullable: false },
    { name: "name", type: "character varying", nullable: false },
    { name: "user_id", type: "uuid", nullable: false },
    { name: "contact_no", type: "character varying", nullable: true },
    { name: "company_size", type: "character varying", nullable: true },
    { name: "website", type: "character varying", nullable: true },
    { name: "logo", type: "text", nullable: true },
    { name: "industry_id", type: "uuid", nullable: true },
    { name: "total_branches", type: "integer", nullable: true },
    { name: "organization_type", type: "character varying", nullable: true },
    { name: "business_id", type: "character varying", nullable: true },
    { name: "legal_city", type: "character varying", nullable: true },
    { name: "legal_state", type: "character varying", nullable: true },
    { name: "legal_country", type: "character varying", nullable: true },
    { name: "description", type: "text", nullable: true },
    { name: "legal_document_url", type: "character varying", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  organization_industries: [
    { name: "id", type: "uuid", nullable: false },
    { name: "organization_id", type: "uuid", nullable: false },
    { name: "industry_id", type: "uuid", nullable: false },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
  ],
  branches: [
    { name: "id", type: "uuid", nullable: false },
    { name: "organization_id", type: "uuid", nullable: false },
    { name: "name", type: "character varying", nullable: false },
    { name: "branch_size", type: "character varying", nullable: true },
    { name: "address", type: "text", nullable: true },
    { name: "city", type: "character varying", nullable: true },
    { name: "state", type: "character varying", nullable: true },
    { name: "country", type: "character varying", nullable: true },
    { name: "postal_code", type: "character varying", nullable: true },
    { name: "contact_no", type: "character varying", nullable: true },
    { name: "email", type: "character varying", nullable: true },
    { name: "is_main", type: "boolean", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  employee: [
    { name: "id", type: "uuid", nullable: false },
    { name: "user_id", type: "uuid", nullable: false },
    { name: "first_name", type: "character varying", nullable: false },
    { name: "last_name", type: "character varying", nullable: false },
    { name: "organization_id", type: "uuid", nullable: false },
    { name: "branch_id", type: "uuid", nullable: true },
    { name: "position", type: "character varying", nullable: true },
    { name: "department", type: "character varying", nullable: true },
    { name: "profile_picture", type: "character varying", nullable: true },
    { name: "permissions", type: "jsonb", nullable: true },
    { name: "status", type: "character varying", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  auditor: [
    { name: "id", type: "uuid", nullable: false },
    { name: "user_id", type: "uuid", nullable: false },
    { name: "first_name", type: "character varying", nullable: false },
    { name: "last_name", type: "character varying", nullable: false },
    { name: "profile_picture", type: "character varying", nullable: true },
    { name: "country", type: "character varying", nullable: true },
    { name: "state", type: "character varying", nullable: true },
    { name: "city", type: "character varying", nullable: true },
    { name: "assigned_certificates", type: "text", nullable: true, isArray: true },
    { name: "status", type: "status_enum", nullable: true },
    { name: "accountstatus", type: "boolean", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  reviewer: [
    { name: "id", type: "uuid", nullable: false },
    { name: "user_id", type: "uuid", nullable: false },
    { name: "first_name", type: "character varying", nullable: false },
    { name: "last_name", type: "character varying", nullable: false },
    { name: "profile_picture", type: "character varying", nullable: true },
    { name: "tags", type: "text", nullable: true, isArray: true },
    { name: "accountstatus", type: "boolean", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  subadmin: [
    { name: "id", type: "uuid", nullable: false },
    { name: "user_id", type: "uuid", nullable: false },
    { name: "first_name", type: "character varying", nullable: false },
    { name: "last_name", type: "character varying", nullable: false },
    { name: "profile_picture", type: "character varying", nullable: true },
    { name: "accountstatus", type: "boolean", nullable: true },
    { name: "permissions", type: "jsonb", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  certificates: [
    { name: "id", type: "uuid", nullable: false },
    { name: "certificate_id", type: "character varying", nullable: false },
    { name: "name", type: "character varying", nullable: false },
    { name: "industry_ids", type: "uuid", nullable: true, isArray: true },
    { name: "disclosure_price", type: "numeric", nullable: false },
    { name: "assured_price", type: "numeric", nullable: true },
    { name: "validity_days", type: "integer", nullable: true },
    { name: "validity_months", type: "integer", nullable: true },
    { name: "validity_years", type: "integer", nullable: true },
    { name: "compulsory_docs", type: "text", nullable: true, isArray: true },
    { name: "description", type: "text", nullable: true },
    { name: "is_published", type: "boolean", nullable: "any" },
    { name: "created_by", type: "uuid", nullable: true },
    { name: "updated_by", type: "uuid", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  badges: [
    { name: "id", type: "uuid", nullable: false },
    { name: "certificate_id", type: "uuid", nullable: false },
    { name: "name", type: "character varying", nullable: false },
    { name: "color", type: "character varying", nullable: true },
    { name: "score", type: "integer", nullable: true },
    { name: "slot", type: "integer", nullable: "any" },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  badge_colors: [
    { name: "id", type: "uuid", nullable: false },
    { name: "badge_id", type: "uuid", nullable: false },
    { name: "color", type: "character varying", nullable: false },
    { name: "min_score", type: "integer", nullable: false },
    { name: "max_score", type: "integer", nullable: false },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
  ],
  main_section: [
    { name: "id", type: "uuid", nullable: false },
    { name: "certificate_id", type: "uuid", nullable: false },
    { name: "name", type: "character varying", nullable: true },
    { name: "rank", type: "integer", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  sections: [
    { name: "id", type: "uuid", nullable: false },
    { name: "certificate_id", type: "uuid", nullable: false },
    { name: "main_id", type: "uuid", nullable: false },
    { name: "name", type: "character varying", nullable: false },
    { name: "rank", type: "integer", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  sub_section: [
    { name: "id", type: "uuid", nullable: false },
    { name: "name", type: "character varying", nullable: false },
    { name: "main_id", type: "uuid", nullable: false },
    { name: "certificate_id", type: "uuid", nullable: false },
    { name: "section_id", type: "uuid", nullable: false },
    { name: "rank", type: "integer", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  questions: [
    { name: "id", type: "uuid", nullable: false },
    { name: "certificate_id", type: "uuid", nullable: false },
    { name: "main_section_id", type: "uuid", nullable: false },
    { name: "section_id", type: "uuid", nullable: false },
    { name: "sub_section_id", type: "uuid", nullable: true },
    { name: "question", type: "text", nullable: false },
    { name: "hint", type: "text", nullable: true },
    { name: "type", type: "character varying", nullable: false },
    { name: "is_third_level", type: "boolean", nullable: false },
    { name: "criteria", type: "text", nullable: true },
    { name: "conditions", type: "jsonb", nullable: true },
    { name: "question_number", type: "integer", nullable: true },
    { name: "certificate_question_number", type: "integer", nullable: true },
    { name: "rank", type: "integer", nullable: false },
    { name: "created_at", type: "timestamp with time zone", nullable: false },
    { name: "updated_at", type: "timestamp with time zone", nullable: false },
    // Note: sub_sub_section_id and help_text are from 0020 migration, included here as optional
    // { name: "sub_sub_section_id", type: "uuid", nullable: true },
    // { name: "help_text", type: "text", nullable: true },
  ],
  payments: [
    { name: "id", type: "uuid", nullable: false },
    { name: "user_id", type: "uuid", nullable: false },
    { name: "certificate_id", type: "uuid", nullable: false },
    { name: "payment_type", type: "payment_type", nullable: false },
    { name: "amount", type: "numeric", nullable: false },
    { name: "currency", type: "character varying", nullable: true },
    { name: "status", type: "payment_status", nullable: true },
    { name: "is_paid", type: "boolean", nullable: true },
    { name: "transaction_id", type: "character varying", nullable: true },
    { name: "payment_method", type: "character varying", nullable: true },
    { name: "paid_at", type: "timestamp with time zone", nullable: true },
    { name: "stripe_payment_intent_id", type: "character varying", nullable: true },
    { name: "stripe_customer_id", type: "character varying", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  certificate_assessments: [
    { name: "id", type: "uuid", nullable: false },
    { name: "organization_id", type: "uuid", nullable: false },
    { name: "branch_id", type: "uuid", nullable: true },
    { name: "certificate_id", type: "uuid", nullable: false },
    { name: "payment_id", type: "uuid", nullable: false },
    { name: "assessment_type", type: "assessment_type", nullable: false },
    { name: "badge_id", type: "uuid", nullable: true },
    { name: "score", type: "numeric", nullable: true },
    { name: "is_submitted", type: "boolean", nullable: true },
    { name: "status", type: "assessment_status", nullable: true },
    { name: "submitted_at", type: "timestamp with time zone", nullable: true },
    { name: "completed_at", type: "timestamp with time zone", nullable: true },
    { name: "assigned_auditor_id", type: "uuid", nullable: true },
    { name: "assigned_reviewer_id", type: "uuid", nullable: true },
    { name: "assigned_by", type: "uuid", nullable: true },
    { name: "is_certificate_blocked", type: "boolean", nullable: true },
    { name: "certificate_block_reason", type: "text", nullable: true },
    { name: "audit_date", type: "timestamp with time zone", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  assessment_queries: [
    { name: "id", type: "uuid", nullable: false },
    { name: "certificate_assessment_id", type: "uuid", nullable: false },
    { name: "question_id", type: "uuid", nullable: false },
    { name: "response_type", type: "response_type", nullable: false },
    { name: "response_value", type: "text", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  ai_reviews: [
    { name: "id", type: "uuid", nullable: false },
    { name: "certificate_assessment_id", type: "uuid", nullable: false },
    { name: "review_description", type: "text", nullable: true },
    { name: "review_status", type: "ai_review_status", nullable: true },
    { name: "total_flags", type: "integer", nullable: true },
    { name: "flag_status", type: "ai_flag_status", nullable: true },
    { name: "score", type: "numeric", nullable: true },
    { name: "started_at", type: "timestamp with time zone", nullable: true },
    { name: "completed_at", type: "timestamp with time zone", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  ai_responses: [
    { name: "id", type: "uuid", nullable: false },
    { name: "assessment_query_id", type: "uuid", nullable: false },
    { name: "ai_review_id", type: "uuid", nullable: false },
    { name: "response", type: "text", nullable: true },
    { name: "is_flagged", type: "boolean", nullable: true },
    { name: "flag_reason", type: "text", nullable: true },
    { name: "confidence_score", type: "numeric", nullable: true },
    { name: "risk_level", type: "character varying", nullable: true },
    { name: "category", type: "character varying", nullable: true },
    { name: "summary", type: "text", nullable: true },
    { name: "ai_suggestion", type: "text", nullable: true },
    { name: "applicant_answer", type: "text", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
  ],
  payment_methods: [
    { name: "id", type: "uuid", nullable: false },
    { name: "organization_id", type: "uuid", nullable: false },
    { name: "stripe_payment_method_id", type: "character varying", nullable: false },
    { name: "stripe_customer_id", type: "character varying", nullable: true },
    { name: "type", type: "character varying", nullable: false },
    { name: "card_brand", type: "character varying", nullable: true },
    { name: "card_last4", type: "character varying", nullable: true },
    { name: "card_exp_month", type: "integer", nullable: true },
    { name: "card_exp_year", type: "integer", nullable: true },
    { name: "is_default", type: "boolean", nullable: true },
    { name: "billing_details", type: "jsonb", nullable: true },
    { name: "metadata", type: "jsonb", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  notification_settings: [
    { name: "id", type: "uuid", nullable: false },
    { name: "user_id", type: "uuid", nullable: false },
    { name: "email_enabled", type: "boolean", nullable: false },
    { name: "in_app_enabled", type: "boolean", nullable: false },
    { name: "assessment_submissions_enabled", type: "boolean", nullable: false },
    { name: "ai_flags_enabled", type: "boolean", nullable: false },
    { name: "audit_scheduling_enabled", type: "boolean", nullable: false },
    { name: "payment_events_enabled", type: "boolean", nullable: false },
    { name: "certificate_events_enabled", type: "boolean", nullable: false },
    { name: "reminder_frequency", type: "character varying", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  notifications: [
    { name: "id", type: "uuid", nullable: false },
    { name: "user_id", type: "uuid", nullable: false },
    { name: "organization_id", type: "uuid", nullable: true },
    { name: "branch_id", type: "uuid", nullable: true },
    { name: "module", type: "notification_module", nullable: false },
    { name: "type", type: "character varying", nullable: false },
    { name: "title", type: "character varying", nullable: false },
    { name: "message", type: "text", nullable: false },
    { name: "channel", type: "notification_channel", nullable: false },
    { name: "read", type: "boolean", nullable: false },
    { name: "read_at", type: "timestamp with time zone", nullable: true },
    { name: "metadata", type: "jsonb", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  organization_badges: [
    { name: "id", type: "uuid", nullable: false },
    { name: "organization_id", type: "uuid", nullable: false },
    { name: "branch_id", type: "uuid", nullable: true },
    { name: "certificate_id", type: "uuid", nullable: true },
    { name: "badge_name", type: "badge_tier", nullable: false },
    { name: "color", type: "character varying", nullable: false },
    { name: "assessed_by_user_id", type: "uuid", nullable: false },
    { name: "accessed_by_user_id", type: "uuid", nullable: true },
    { name: "score", type: "numeric", nullable: false },
    { name: "assessment_id", type: "uuid", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],
  chat_threads: [
    { name: "id", type: "uuid", nullable: false },
    { name: "assessment_id", type: "uuid", nullable: false },
    { name: "status", type: "chat_thread_status", nullable: false },
    { name: "created_at", type: "timestamp with time zone", nullable: false },
    { name: "updated_at", type: "timestamp with time zone", nullable: false },
    { name: "locked_at", type: "timestamp with time zone", nullable: true },
    { name: "locked_reason", type: "character varying", nullable: true },
  ],
  chat_participants: [
    { name: "id", type: "uuid", nullable: false },
    { name: "thread_id", type: "uuid", nullable: false },
    { name: "user_id", type: "uuid", nullable: false },
    { name: "role", type: "chat_participant_role", nullable: false },
    { name: "joined_at", type: "timestamp with time zone", nullable: false },
    { name: "last_read_at", type: "timestamp with time zone", nullable: true },
  ],
  chat_messages: [
    { name: "id", type: "uuid", nullable: false },
    { name: "thread_id", type: "uuid", nullable: false },
    { name: "sender_id", type: "uuid", nullable: false },
    { name: "content", type: "text", nullable: false },
    { name: "is_system_message", type: "boolean", nullable: false },
    { name: "created_at", type: "timestamp with time zone", nullable: false },
    { name: "updated_at", type: "timestamp with time zone", nullable: false },
  ],
  assurance_reviews: [
    { name: "id", type: "uuid", nullable: false },
    { name: "assessment_id", type: "uuid", nullable: false },
    { name: "final_score", type: "numeric", nullable: true },
    { name: "assessed_by", type: "assurance_assessed_by", nullable: true },
    { name: "status", type: "assurance_review_status", nullable: false },
    { name: "badge_id", type: "uuid", nullable: true },
    { name: "finalized_at", type: "timestamp with time zone", nullable: true },
    { name: "finalized_by", type: "uuid", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: false },
    { name: "updated_at", type: "timestamp with time zone", nullable: false },
  ],
  user_assurance_reviews: [
    { name: "id", type: "uuid", nullable: false },
    { name: "assurance_review_id", type: "uuid", nullable: false },
    { name: "assessor_user_id", type: "uuid", nullable: false },
    { name: "assessor_role", type: "assessor_role", nullable: false },
    { name: "score", type: "numeric", nullable: false },
    { name: "remarks", type: "text", nullable: true },
    { name: "submitted_at", type: "timestamp with time zone", nullable: false },
    { name: "created_at", type: "timestamp with time zone", nullable: false },
    { name: "updated_at", type: "timestamp with time zone", nullable: false },
  ],
  unlocked_certificates: [
    { name: "id", type: "uuid", nullable: false },
    { name: "organization_id", type: "uuid", nullable: false },
    { name: "branch_id", type: "uuid", nullable: true },
    { name: "certificate_id", type: "uuid", nullable: false },
    { name: "assessment_id", type: "uuid", nullable: true },
    { name: "unlocked_by_user_id", type: "uuid", nullable: false },
    { name: "unlocked_at", type: "timestamp with time zone", nullable: false },
    { name: "expiry_date", type: "timestamp with time zone", nullable: true },
    { name: "is_active", type: "boolean", nullable: false },
    { name: "notes", type: "text", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: false },
    { name: "updated_at", type: "timestamp with time zone", nullable: false },
  ],
};

async function validateSchema() {
  // Prefer DATABASE_URL when provided (e.g., Neon), with SSL support when required.
  let client: Client;
  if (process.env.DATABASE_URL) {
    const connStr = process.env.DATABASE_URL;
    // Determine if sslmode=require is present in the connection string query
    let useSsl = false;
    try {
      const urlObj = new URL(connStr);
      const sslmode = urlObj.searchParams.get('sslmode');
      if (sslmode && sslmode.toLowerCase() === 'require') {
        useSsl = true;
      }
    } catch (e) {
      // ignore parsing errors - we'll still attempt to use the connectionString
    }

    client = new Client({
      connectionString: connStr,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
  } else {
    client = new Client(DB_CONFIG);
  }

  await client.connect();

  console.log("🔍 Starting schema validation...\n");

  let hasErrors = false;

  for (const [table, columns] of Object.entries(expectedSchema)) {
    const res = await client.query(
      `SELECT column_name, data_type, is_nullable, udt_name
       FROM information_schema.columns
       WHERE table_name = $1`,
      [table]
    );

    if (res.rows.length === 0) {
      console.error(`❌ Table '${table}' does not exist in the database.`);
      hasErrors = true;
      continue;
    }

    const dbColumns = res.rows.map((r: any) => {
      let type = r.data_type;
      // Handle Arrays and Enums
      if (type === "ARRAY" || type === "USER-DEFINED") {
        type = r.udt_name.replace(/^_/, ""); // Remove leading underscore for arrays (e.g. _uuid -> uuid)
      }
      return {
        name: r.column_name,
        type: type,
        nullable: r.is_nullable === "YES",
      };
    });

    const missing = columns.filter(
      (c) => !dbColumns.find((db) => db.name === c.name)
    );
    const mismatch = columns.filter((c) => {
      const db = dbColumns.find((db) => db.name === c.name);
      if (!db) return false;
      const expectedTypes = Array.isArray(c.type) ? c.type : [c.type];
      const typeMatches = expectedTypes.includes(db.type);
      const nullableMatches =
        c.nullable === "any" ? true : db.nullable === c.nullable;
      return !typeMatches || !nullableMatches;
    });

    if (missing.length > 0) {
      console.warn(`⚠️  Table '${table}' is missing columns:`, missing.map(c => c.name));
      hasErrors = true;
    }
    if (mismatch.length > 0) {
      console.warn(`⚠️  Table '${table}' has column mismatches (type/nullability):`, mismatch);
      hasErrors = true;
    }
    
    if (missing.length === 0 && mismatch.length === 0) {
      console.log(`✅ Table '${table}' matches schema.`);
    }
  }

  console.log("\n" + (hasErrors ? "❌ Schema validation failed with errors." : "🎉 Schema validation passed successfully."));
  await client.end();
}

validateSchema().catch(console.error);
