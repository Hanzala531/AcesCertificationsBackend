import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UnauthorizedErrorDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Unauthorized' })
  message: string;

  @ApiProperty({ example: 401 })
  statusCode: number;
}

export class ForbiddenErrorDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Not assigned as reviewer for this assessment' })
  message: string;

  @ApiProperty({ example: 403 })
  statusCode: number;
}

export class NotFoundErrorDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Assessment not found' })
  message: string;

  @ApiProperty({ example: 404 })
  statusCode: number;
}

export class BadRequestErrorDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Assessment is not of type assured' })
  message: string;

  @ApiProperty({ example: 400 })
  statusCode: number;
}

export class AiReviewDataDto {
  @ApiProperty({ example: true })
  isFlagged: boolean;

  @ApiPropertyOptional({
    example: 'Applicant answered "no" to a compliance requirement',
  })
  flagReason: string | null;

  @ApiPropertyOptional({ example: 92 })
  confidenceScore: number | null;

  @ApiPropertyOptional({
    example: 'high',
    enum: ['low', 'medium', 'high', 'critical'],
  })
  riskLevel: string | null;

  @ApiPropertyOptional({ example: 'compliance_issue' })
  category: string | null;

  @ApiPropertyOptional({
    example: 'Organization does not maintain required safety documentation',
  })
  summary: string | null;

  @ApiPropertyOptional({
    example: 'Recommend requesting evidence of safety policy documentation',
  })
  aiSuggestion: string | null;
}

export class AuditQuestionDto {
  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-345678901234' })
  questionId: string;

  @ApiProperty({
    example:
      'Does your organization maintain a documented health and safety policy?',
  })
  questionText: string;

  @ApiProperty({ example: 'boolean', enum: ['boolean', 'text', 'pdf'] })
  questionType: string;

  @ApiPropertyOptional({ example: 'yes' })
  applicantAnswer: string | null;

  @ApiPropertyOptional({ example: 'boolean', enum: ['boolean', 'text', 'pdf'] })
  responseType: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://storage.example.com/files/doc1.pdf'],
    description: 'File URLs for PDF-type answers (up to 3 files)',
    nullable: true,
  })
  responseFiles: string[] | null;

  @ApiPropertyOptional({
    example: 'Policy document reviewed and appears comprehensive',
  })
  reviewerNotes: string | null;

  @ApiPropertyOptional({
    example: 'Evidence of implementation required at site visit',
  })
  auditorNotes: string | null;

  @ApiPropertyOptional({ type: () => AiReviewDataDto })
  aiReview: AiReviewDataDto | null;
}

export class AuditSubSectionDto {
  @ApiProperty({ example: 'b2c3d4e5-f6a7-8901-bcde-234567890123' })
  subSectionId: string;

  @ApiProperty({ example: 'Emergency Procedures' })
  subSectionName: string;

  @ApiProperty({ type: () => [AuditQuestionDto] })
  questions: AuditQuestionDto[];
}

export class AuditSectionDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-123456789012' })
  sectionId: string;

  @ApiProperty({ example: 'Health & Safety' })
  sectionName: string;

  @ApiProperty({ type: () => [AuditSubSectionDto] })
  subSections: AuditSubSectionDto[];

  @ApiProperty({ type: () => [AuditQuestionDto] })
  questions: AuditQuestionDto[];
}

export class AuditMainSectionDto {
  @ApiProperty({ example: '9a8b7c6d-5e4f-3210-fedc-ba9876543210' })
  mainSectionId: string;

  @ApiProperty({ example: 'Operational Compliance' })
  mainSectionName: string;

  @ApiProperty({ type: () => [AuditSectionDto] })
  sections: AuditSectionDto[];
}

export class AuditRecordDto {
  @ApiProperty({ example: 'f1e2d3c4-b5a6-7890-fedc-ba0987654321' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  assessment_id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  certificate_id: string;

  @ApiPropertyOptional({
    example:
      'Organization demonstrates strong compliance across all assessed areas.',
  })
  audit_summary: string | null;

  @ApiPropertyOptional({
    example: 'https://storage.example.com/audits/summary-doc-2026.pdf',
  })
  audit_summary_doc: string | null;

  @ApiPropertyOptional({
    example: 'Minor gaps identified in emergency response documentation.',
  })
  audit_description: string | null;

  @ApiPropertyOptional({
    example: 'conditionally_approved',
    enum: ['approved', 'conditionally_approved', 'rejected'],
  })
  status: string | null;

  @ApiPropertyOptional({
    example: 87.5,
    description: 'AI-generated score (0-100)',
  })
  score: number | null;

  @ApiPropertyOptional({
    example: 'Final decision: approved after review of all documentation.',
  })
  review_summary: string | null;

  @ApiPropertyOptional({
    example: 'https://storage.example.com/reviews/summary-doc-2026.pdf',
  })
  review_summary_doc: string | null;

  @ApiPropertyOptional({
    example: 'All corrective actions verified. Certificate approved.',
  })
  review_description: string | null;

  @ApiPropertyOptional({
    example: 'approved',
    enum: ['approved', 'conditionally_approved', 'rejected'],
  })
  review_status: string | null;

  @ApiPropertyOptional({
    example: 91.0,
    description: 'AI-generated review score (0-100)',
  })
  review_score: number | null;

  @ApiPropertyOptional({ example: 'f834b692-4137-42d6-9b8f-0a73b1c9b2a6' })
  reviewed_by: string | null;

  @ApiPropertyOptional({ example: '2026-02-23T12:00:00.000Z' })
  reviewed_at: Date | null;

  @ApiPropertyOptional({
    example: 'f834b692-4137-42d6-9b8f-0a73b1c9b2a6',
    description: 'UUID of the assigned auditor',
  })
  assigned_auditor_id: string | null;

  @ApiPropertyOptional({
    example: 'John Smith',
    description: 'Full name of the assigned auditor',
  })
  auditor_name: string | null;

  @ApiPropertyOptional({
    example: 'john.smith@audit-firm.com',
    description: 'Email of the assigned auditor',
  })
  auditor_email: string | null;

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/account/image/upload/v123/auditors/signature.png',
    description: 'Cloudinary URL of the assigned auditor signature',
  })
  auditor_signature: string | null;

  @ApiPropertyOptional({
    example: 'Jane Reviewer',
    description: 'Full name of the reviewer who submitted the review',
  })
  reviewer_name: string | null;

  @ApiPropertyOptional({
    example: 'jane.reviewer@review-firm.com',
    description: 'Email of the reviewer who submitted the review',
  })
  reviewer_email: string | null;

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/account/image/upload/v123/reviewers/signature.png',
    description: 'Cloudinary URL of the reviewer signature',
  })
  reviewer_signature: string | null;

  @ApiProperty({ example: false })
  is_archived: boolean;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: '2026-02-22T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-02-22T14:30:00.000Z' })
  updated_at: Date;
}

export class AuditAssessmentViewDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  assessmentId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  certificateId: string;

  @ApiProperty({ example: 'ISO 9001:2015 Quality Management' })
  certificateName: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  organizationId: string;

  @ApiProperty({ example: 'Acme Manufacturing Ltd.' })
  organizationName: string;

  @ApiProperty({
    example: 'ai_review_completed',
    description: 'Current status of the assessment',
  })
  status: string;

  @ApiProperty({ example: 'assured' })
  assessmentType: string;

  @ApiPropertyOptional({
    example: 'f834b692-4137-42d6-9b8f-0a73b1c9b2a6',
    description: 'UUID of the assigned auditor (from certificate_assessments)',
  })
  assignedAuditorId: string | null;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'UUID of the assigned reviewer (from certificate_assessments)',
  })
  assignedReviewerId: string | null;

  @ApiPropertyOptional({
    example: '2026-03-15T10:00:00.000Z',
    description: 'Scheduled audit date for the assessment',
  })
  auditDate: Date | null;

  @ApiPropertyOptional({ type: () => AuditRecordDto })
  auditRecord: AuditRecordDto | null;

  @ApiProperty({ type: () => [AuditMainSectionDto] })
  sections: AuditMainSectionDto[];
}

export class GetAuditViewResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Audit view retrieved successfully' })
  message: string;

  @ApiProperty({ type: () => AuditAssessmentViewDto })
  data: AuditAssessmentViewDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-02-22T10:00:00.000Z' })
  timestamp: string;
}

export class AssessmentQueryResponseDto {
  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-345678901234' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  certificate_assessment_id: string;

  @ApiProperty({ example: '9a8b7c6d-5e4f-3210-fedc-ba9876543210' })
  question_id: string;

  @ApiProperty({ example: 'boolean', enum: ['boolean', 'text', 'pdf'] })
  response_type: string;

  @ApiPropertyOptional({ example: 'yes' })
  response_value: string | null;

  @ApiPropertyOptional({
    example: 'Policy document reviewed and appears comprehensive',
  })
  reviewer_notes: string | null;

  @ApiPropertyOptional({
    example: 'Evidence of implementation required at site visit',
  })
  auditor_notes: string | null;

  @ApiProperty({ example: '2026-02-22T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-02-22T14:30:00.000Z' })
  updated_at: Date;
}

export class UpdateReviewerNotesResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Reviewer notes updated successfully' })
  message: string;

  @ApiProperty({ type: () => AssessmentQueryResponseDto })
  data: AssessmentQueryResponseDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-02-22T14:30:00.000Z' })
  timestamp: string;
}

export class UpdateAuditorNotesResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Auditor notes updated successfully' })
  message: string;

  @ApiProperty({ type: () => AssessmentQueryResponseDto })
  data: AssessmentQueryResponseDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-02-22T14:30:00.000Z' })
  timestamp: string;
}

export class UpsertAuditResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Audit record saved successfully' })
  message: string;

  @ApiProperty({ type: () => AuditRecordDto })
  data: AuditRecordDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-02-22T14:30:00.000Z' })
  timestamp: string;
}

export class ComplianceActionDataDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-123456789012' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  assessmentId: string;

  @ApiProperty({ example: 'c3d4e5f6-a7b8-9012-cdef-345678901234' })
  questionId: string;

  @ApiProperty({
    example: 'request_clarification',
    enum: ['request_clarification'],
  })
  actionType: string;

  @ApiProperty({
    example: 'Please provide documentation for your health and safety policy.',
  })
  message: string;

  @ApiProperty({ example: 'f834b692-4137-42d6-9b8f-0a73b1c9b2a6' })
  createdBy: string;

  @ApiProperty({ example: 'auditor' })
  createdByRole: string;

  @ApiPropertyOptional({ example: 'd5e6f7a8-b9c0-1234-5678-90abcdef1234' })
  chatMessageId: string | null;

  @ApiPropertyOptional({
    enum: ['applicant', 'reviewer'],
    example: 'reviewer',
    description:
      'Who the clarification was directed at. Null for non-clarification actions.',
  })
  clarificationTarget: 'applicant' | 'reviewer' | null;

  @ApiProperty({ example: '2026-02-22T14:30:00.000Z' })
  createdAt: Date;
}

export class ComplianceActionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Compliance action recorded successfully' })
  message: string;

  @ApiProperty({ type: () => ComplianceActionDataDto })
  data: ComplianceActionDataDto;

  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: '2026-02-22T14:30:00.000Z' })
  timestamp: string;
}

export class ConflictErrorDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({
    example:
      'Assessment audit is finalized; no further compliance actions are allowed',
  })
  message: string;

  @ApiProperty({ example: 409 })
  statusCode: number;
}

// ── Reviewer Review ──────────────────────────────────────────────────────────

export class UpsertReviewResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Review record saved successfully' })
  message: string;

  @ApiProperty({ type: () => AuditRecordDto })
  data: AuditRecordDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  timestamp: string;
}

// ── Issued Certificate ───────────────────────────────────────────────────────

export class IssuedCertificateDataDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-123456789012' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  assessmentId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  certificateId: string;

  @ApiProperty({ example: 'ISO 9001:2015 Quality Management' })
  certificateName: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  organizationId: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440020' })
  branchId: string | null;

  @ApiPropertyOptional({ example: 'b2c3d4e5-f6a7-8901-bcde-234567890123' })
  badgeId: string | null;

  @ApiPropertyOptional({ example: 'Verified' })
  badgeName: string | null;

  @ApiPropertyOptional({
    example: '#4CAF50',
    description: 'Badge color based on score range',
  })
  badgeColor: string | null;

  @ApiProperty({ example: 'ACES-2026-000001' })
  certificateNumber: string;

  @ApiPropertyOptional({
    example: 91.0,
    description: 'AI-generated score used for badge allocation',
  })
  reviewScore: number | null;

  @ApiProperty({ example: 'f834b692-4137-42d6-9b8f-0a73b1c9b2a6' })
  issuedBy: string;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  issuedAt: Date;

  @ApiPropertyOptional({ example: '2027-02-23T00:00:00.000Z' })
  expiryDate: Date | null;

  @ApiProperty({ example: false })
  isBlocked: boolean;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  updatedAt: Date;
}

export class IssuedCertificateResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Certificate issued successfully' })
  message: string;

  @ApiProperty({ type: () => IssuedCertificateDataDto })
  data: IssuedCertificateDataDto;

  @ApiProperty({ example: 201 })
  statusCode: number;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  timestamp: string;
}

// ── Block Certificate ────────────────────────────────────────────────────────

export class BlockCertificateResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Certificate blocked successfully' })
  message: string;

  @ApiProperty({ type: () => IssuedCertificateDataDto })
  data: IssuedCertificateDataDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  timestamp: string;
}

// ── Re-audit ─────────────────────────────────────────────────────────────────

export class ReauditDataDto {
  @ApiProperty({
    example: 'f1e2d3c4-b5a6-7890-fedc-ba0987654321',
    description: 'New (active) audit record id',
  })
  newAuditId: string;

  @ApiProperty({ example: 2 })
  version: number;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  assessmentId: string;

  @ApiProperty({
    example: true,
    description: 'Whether the previous issued certificate was blocked',
  })
  previousCertificateBlocked: boolean;
}

export class ReauditResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example:
      'Re-audit initiated. Previous audit archived and new audit record created.',
  })
  message: string;

  @ApiProperty({ type: () => ReauditDataDto })
  data: ReauditDataDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  timestamp: string;
}

// ── AI Audit Score ──────────────────────────────────────────────────────────

export class AiAuditScoreDataDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-123456789012' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  assessmentId: string;

  @ApiProperty({ example: 'f1e2d3c4-b5a6-7890-fedc-ba0987654321' })
  auditId: string;

  @ApiProperty({ example: 88.5, description: 'AI-generated score (0-100)' })
  aiScore: number;

  @ApiProperty({
    example:
      'Both auditor and reviewer approved. Reviews are detailed and evidence-based, demonstrating strong compliance.',
    description: 'AI reasoning for the score',
  })
  aiReasoning: string;

  @ApiProperty({ example: '1.0' })
  promptVersion: string;

  @ApiProperty({ example: 'gpt-4o' })
  modelUsed: string;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  createdAt: Date;
}

export class AiAuditScoreResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'AI audit score retrieved successfully' })
  message: string;

  @ApiProperty({ type: () => AiAuditScoreDataDto })
  data: AiAuditScoreDataDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  timestamp: string;
}

// ── Auditor Audits List ─────────────────────────────────────────────────────

export class AuditorAuditItemDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  assessmentId: string;

  @ApiProperty({ example: 'assured', enum: ['self_disclosure', 'assured'] })
  assessmentType: string;

  @ApiProperty({ example: 'submitted' })
  assessmentStatus: string;

  @ApiProperty({ example: 'Acme Manufacturing Ltd.' })
  organizationName: string;

  @ApiProperty({ example: 'ISO 9001:2015 Quality Management' })
  certificateName: string;

  @ApiPropertyOptional({ example: '2026-03-15T10:00:00.000Z' })
  auditDate: Date | null;

  @ApiPropertyOptional({ example: 'f1e2d3c4-b5a6-7890-fedc-ba0987654321' })
  auditId: string | null;

  @ApiPropertyOptional({
    example: 'auditor_submitted',
    enum: [
      'in_progress',
      'auditor_submitted',
      'reviewer_submitted',
      'completed',
    ],
  })
  auditLifecycleStatus: string | null;

  @ApiPropertyOptional({
    example: 'approved',
    enum: ['approved', 'conditionally_approved', 'rejected'],
  })
  auditStatus: string | null;

  @ApiPropertyOptional({
    example: 'approved',
    enum: ['approved', 'conditionally_approved', 'rejected'],
  })
  reviewStatus: string | null;

  @ApiPropertyOptional({ example: 87.5 })
  score: number | null;

  @ApiPropertyOptional({ example: 91.0 })
  reviewScore: number | null;

  @ApiPropertyOptional({ example: '2026-02-22T10:00:00.000Z' })
  auditCreatedAt: Date | null;

  @ApiPropertyOptional({ example: '2026-02-22T14:30:00.000Z' })
  auditUpdatedAt: Date | null;

  @ApiProperty({
    example: 'submitted',
    enum: ['pending', 'in_progress', 'submitted', 'rejected', 'completed'],
    description:
      'Computed status: pending (no work done), in_progress (auditor started), submitted (auditor done, reviewer pending), rejected (reviewer rejected), completed (both done)',
  })
  computedStatus: string;
}

export class AuditorAuditsPaginatedDataDto {
  @ApiProperty({ type: () => [AuditorAuditItemDto] })
  items: AuditorAuditItemDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class GetAuditorAuditsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Audits retrieved successfully' })
  message: string;

  @ApiProperty({ type: () => AuditorAuditsPaginatedDataDto })
  data: AuditorAuditsPaginatedDataDto;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-02-23T12:00:00.000Z' })
  timestamp: string;
}

