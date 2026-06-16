-- ============================================================================
-- 011 — Audit logs (system request/action log)
-- Folds: 034 (actor_id / target_id are TEXT — defined inline here)
-- Standalone table with no FK dependencies (actor/target stored as text).
-- ============================================================================

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"               uuid        NOT NULL DEFAULT uuid_generate_v4(),
  "action"           varchar(50) NOT NULL,
  "category"         varchar(30) NOT NULL,
  "actor_id"         text,
  "actor_role"       varchar(20),
  "target_entity"    varchar(50),
  "target_id"        text,
  "http_method"      varchar(10),
  "http_path"        varchar(500),
  "http_status_code" int,
  "request_id"       uuid,
  "ip_address"       varchar(45),
  "user_agent"       varchar(500),
  "metadata"         jsonb,
  "error_message"    text,
  "duration_ms"      int,
  "created_at"       TIMESTAMP   NOT NULL DEFAULT now(),
  CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actor_id"   ON "audit_logs" ("actor_id");
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action"     ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_category"   ON "audit_logs" ("category");
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_target"     ON "audit_logs" ("target_entity", "target_id");
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_created_at" ON "audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_http_path"  ON "audit_logs" ("http_path");
