export type ChatThreadStatus = 'active' | 'locked' | 'archived';
export type ChatParticipantRole = 'applicant' | 'auditor' | 'reviewer' | 'admin';
export type ChatThreadType =
  | 'auditor_applicant'
  | 'auditor_reviewer'
  | 'reviewer_applicant'
  | 'support_ticket';

export interface ChatThread {
  id: string;
  assessment_id: string | null;
  support_ticket_id: string | null;
  question_id: string | null;
  thread_type: ChatThreadType;
  status: ChatThreadStatus;
  created_at: Date;
  updated_at: Date;
  locked_at: Date | null;
  locked_reason: string | null;
}

export interface ChatParticipant {
  id: string;
  thread_id: string;
  user_id: string;
  role: ChatParticipantRole;
  joined_at: Date;
  last_read_at: Date | null;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  is_system_message: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ChatThreadWithDetails extends ChatThread {
  assessment_type?: string;
  certificate_name?: string;
  organization_name?: string;
  support_ticket_subject?: string;
  support_ticket_category?: string;
  question_text?: string;
  participant_count?: number;
  unread_count?: number;
  last_message?: ChatMessageWithSender | null;
}

export interface ChatMessageWithSender extends ChatMessage {
  sender_name?: string;
  sender_role?: ChatParticipantRole;
}

export interface ChatParticipantWithUser extends ChatParticipant {
  first_name?: string;
  last_name?: string;
  email?: string;
}
