export interface Audit {
  id: string;
  assessment_id: string;
  certificate_id: string;
  audit_summary: string | null;
  audit_summary_doc: string | null;
  audit_description: string | null;
  status: 'approved' | 'conditionally_approved' | 'rejected' | null;
  score: number | null;
  // Reviewer fields
  review_summary: string | null;
  review_summary_doc: string | null;
  review_description: string | null;
  review_status: 'approved' | 'conditionally_approved' | 'rejected' | null;
  review_score: number | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  // Assignment
  assigned_auditor_id: string | null;
  assigned_reviewer_id: string | null;
  // Lifecycle
  audit_lifecycle_status:
    | 'in_progress'
    | 'auditor_submitted'
    | 'reviewer_submitted'
    | 'completed';
  // Archive / versioning
  is_archived: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface AuditWithDetails extends Audit {
  auditor_name: string | null;
  auditor_email: string | null;
  auditor_signature: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  reviewer_signature: string | null;
}

export interface IssuedCertificate {
  id: string;
  assessment_id: string;
  certificate_id: string;
  certificate_name: string;
  organization_id: string;
  branch_id: string | null;
  badge_id: string | null;
  badge_name: string | null;
  badge_color: string | null;
  certificate_number: string;
  review_score: number | null;
  issued_by: string;
  issued_at: Date;
  expiry_date: Date | null;
  is_blocked: boolean;
  block_reason: string | null;
  blocked_by: string | null;
  blocked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AuditQuestionRow {
  main_section_id: string;
  main_section_name: string;
  main_section_short_code: string | null;
  main_section_rank: number;
  section_id: string;
  section_name: string;
  section_short_code: string | null;
  section_rank: number;
  sub_section_id: string | null;
  sub_section_name: string | null;
  sub_section_short_code: string | null;
  sub_section_rank: number | null;
  question_id: string;
  question_text: string;
  question_short_code: string | null;
  question_type: string;
  is_third_level: boolean;
  question_rank: number;
  answer_id: string | null;
  response_type: string | null;
  response_value: string | null;
  response_files: string[] | null;
  reviewer_notes: string | null;
  auditor_notes: string | null;
  is_flagged: boolean | null;
  flag_reason: string | null;
  confidence_score: number | null;
  risk_level: string | null;
  category: string | null;
  summary: string | null;
  ai_suggestion: string | null;
}

export interface AuditQuestion {
  questionId: string;
  questionText: string;
  questionShortCode: string | null;
  questionType: string;
  applicantAnswer: string | null;
  responseType: string | null;
  responseFiles: string[] | null;
  reviewerNotes: string | null;
  auditorNotes: string | null;
  aiReview: {
    isFlagged: boolean;
    flagReason: string | null;
    confidenceScore: number | null;
    riskLevel: string | null;
    category: string | null;
    summary: string | null;
    aiSuggestion: string | null;
  } | null;
}

export interface AuditSubSection {
  subSectionId: string;
  subSectionName: string;
  subSectionShortCode: string | null;
  questions: AuditQuestion[];
}

export interface AuditSection {
  sectionId: string;
  sectionName: string;
  sectionShortCode: string | null;
  subSections: AuditSubSection[];
  questions: AuditQuestion[];
}

export interface AuditMainSection {
  mainSectionId: string;
  mainSectionName: string;
  mainSectionShortCode: string | null;
  sections: AuditSection[];
}

export interface AuditAssessmentView {
  assessmentId: string;
  certificateId: string;
  certificateName: string;
  organizationId: string;
  organizationName: string;
  status: string;
  assessmentType: string;
  assignedAuditorId: string | null;
  assignedReviewerId: string | null;
  auditDate: Date | null;
  requestedReviewer: {
    isTrue: boolean;
    name: string | null;
    date: Date | null;
  };
  auditRecord: AuditWithDetails | null;
  sections: AuditMainSection[];
}

export interface AiAuditScore {
  id: string;
  assessment_id: string;
  audit_id: string;
  ai_score: number;
  ai_reasoning: string;
  prompt_version: string;
  model_used: string;
  created_at: Date;
}

export interface AuditorAuditRow {
  assessment_id: string;
  assessment_type: string;
  assessment_status: string;
  organization_name: string;
  certificate_name: string;
  audit_date: Date | null;
  audit_id: string | null;
  audit_lifecycle_status: string | null;
  audit_status: string | null;
  review_status: string | null;
  score: number | null;
  review_score: number | null;
  audit_created_at: Date | null;
  audit_updated_at: Date | null;
  computed_status: 'pending' | 'in_progress' | 'submitted' | 'rejected' | 'completed';
}

export interface AuditorAuditsPaginatedResult {
  items: AuditorAuditRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ComplianceAction {
  id: string;
  assessmentId: string;
  questionId: string;
  actionType: 'request_clarification';
  message: string;
  createdBy: string;
  createdByRole: string;
  chatMessageId: string | null;
  clarificationTarget: 'applicant' | 'reviewer' | null;
  createdAt: Date;
}
