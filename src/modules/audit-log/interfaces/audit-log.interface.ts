export interface AuditLog {
  id: string;
  action: string;
  category: string;
  actor_id: string | null;
  actor_role: string | null;
  target_entity: string | null;
  target_id: string | null;
  http_method: string | null;
  http_path: string | null;
  http_status_code: number | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: Date;
}

export interface CreateAuditLogInput {
  action: string;
  category: string;
  actor_id?: string | null;
  actor_role?: string | null;
  target_entity?: string | null;
  target_id?: string | null;
  http_method?: string | null;
  http_path?: string | null;
  http_status_code?: number | null;
  request_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
  error_message?: string | null;
  duration_ms?: number | null;
}
