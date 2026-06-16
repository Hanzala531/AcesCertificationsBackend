export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  certificate_id: string | null;
  description: string;
  supporting_document: string | null;
  ticket_type: SupportTicketType;
  target_type: SupportTicketTargetType;
  target_id: string | null;
  metadata: Record<string, unknown>;
  resolved_by: string | null;
  resolved_at: Date | null;
  status: SupportTicketStatus;
  created_at: Date;
  updated_at: Date;
}

export type SupportTicketStatus =
  | 'pending'
  | 'in_progress'
  | 'completed';

export type SupportTicketType =
  | 'support'
  | 'dispute'
  | 'billing'
  | 'technical'
  | 'other';

export type SupportTicketTargetType =
  | 'certificate'
  | 'assessment'
  | 'payment'
  | 'account'
  | 'other';

export interface SupportTicketWithCertificate extends SupportTicket {
  certificate_name: string | null;
  product_id: string | null;
}
