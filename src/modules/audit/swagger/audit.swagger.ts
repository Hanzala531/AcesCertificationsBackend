import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  UpdateReviewerNotesDto,
  UpdateAuditorNotesDto,
  UpsertAuditDto,
  UpsertReviewDto,
  BlockCertificateDto,
  ComplianceActionDto,
  GetAuditorAuditsQueryDto,
} from '../dto/audit.dto';
import {
  GetAuditViewResponseDto,
  UpdateReviewerNotesResponseDto,
  UpdateAuditorNotesResponseDto,
  UpsertAuditResponseDto,
  UpsertReviewResponseDto,
  IssuedCertificateResponseDto,
  IssuedCertificateDataDto,
  BlockCertificateResponseDto,
  ReauditResponseDto,
  ReauditDataDto,
  ComplianceActionResponseDto,
  ComplianceActionDataDto,
  ConflictErrorDto,
  BadRequestErrorDto,
  NotFoundErrorDto,
  ForbiddenErrorDto,
  UnauthorizedErrorDto,
  AuditAssessmentViewDto,
  AuditMainSectionDto,
  AuditSectionDto,
  AuditSubSectionDto,
  AuditQuestionDto,
  AiReviewDataDto,
  AuditRecordDto,
  AssessmentQueryResponseDto,
  AiAuditScoreResponseDto,
  AiAuditScoreDataDto,
  GetAuditorAuditsResponseDto,
  AuditorAuditItemDto,
  AuditorAuditsPaginatedDataDto,
} from '../dto/audit-response.dto';

export function SwaggerGetAuditView() {
  return applyDecorators(
    ApiExtraModels(
      GetAuditViewResponseDto,
      AuditAssessmentViewDto,
      AuditMainSectionDto,
      AuditSectionDto,
      AuditSubSectionDto,
      AuditQuestionDto,
      AiReviewDataDto,
      AuditRecordDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Get complete assessment audit view',
      description: `
Returns the full question hierarchy with applicant answers, AI review data, reviewer notes, and auditor notes for an assessment.

Works for both \`assured\` and \`self_disclosure\` assessment types.
- For **assured** assessments, applicant answers are sourced from the linked completed self-disclosure assessment.
- For **self_disclosure** assessments, applicant answers are sourced from the assessment itself.

**Hierarchy structure:**
\`mainSection → section → subSection (optional) → question\`

**Each question includes:**
- Applicant's submitted answer
- Reviewer notes (set by assigned reviewer)
- Auditor notes (set by assigned auditor)
- AI review result (flagged status, risk level, confidence score, category, suggestion)

**auditRecord includes:**
- Auditor fields: \`audit_summary\`, \`audit_summary_doc\`, \`audit_description\`, \`status\`, \`auditor_name\`, \`auditor_email\`, \`auditor_signature\`
- Reviewer fields: \`review_summary\`, \`review_summary_doc\`, \`review_description\`, \`review_status\`, \`review_score\`, \`reviewer_name\`, \`reviewer_email\`, \`reviewer_signature\`, \`reviewed_by\`, \`reviewed_at\`

**Access Control:**
- \`admin\`, \`subadmin\`: full access to all assessments
- \`auditor\`: must be assigned as auditor on the assessment
- \`reviewer\`: must be assigned as reviewer on the assessment
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'UUID of the certificate assessment',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440002',
    }),
    ApiQuery({
      name: 'questionType',
      required: false,
      enum: ['pdf', 'text', 'boolean'],
      description: 'Filter questions by response type. Returns only questions of the specified type.',
      example: 'pdf',
    }),
    ApiQuery({
      name: 'flaggedOnly',
      required: false,
      type: 'boolean',
      description: 'When true, returns only AI-flagged questions. Combine with questionType to filter by both.',
      example: true,
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Audit view retrieved successfully',
      type: GetAuditViewResponseDto,
      content: {
        'application/json': {
          examples: {
            all_questions: {
              summary: 'flaggedOnly=false — all answered questions',
              value: {
                success: true,
                message: 'Audit view retrieved successfully',
                data: {
                  assessmentId: '550e8400-e29b-41d4-a716-446655440002',
                  certificateId: '550e8400-e29b-41d4-a716-446655440010',
                  certificateName: 'ISO 9001:2015 Quality Management',
                  organizationId: '550e8400-e29b-41d4-a716-446655440001',
                  organizationName: 'Acme Manufacturing Ltd.',
                  status: 'ai_reviewing',
                  assessmentType: 'assured',
                  auditDate: '2026-03-15T10:00:00.000Z',
                  auditRecord: null,
                  sections: [
                    {
                      mainSectionId: '9a8b7c6d-5e4f-3210-fedc-ba9876543210',
                      mainSectionName: 'Operational Compliance',
                      sections: [
                        {
                          sectionId: 'a1b2c3d4-e5f6-7890-abcd-123456789012',
                          sectionName: 'Health & Safety',
                          subSections: [],
                          questions: [
                            {
                              questionId: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
                              questionText: 'Does your organization maintain a documented health and safety policy?',
                              questionType: 'boolean',
                              applicantAnswer: 'yes',
                              responseType: 'boolean',
                              responseFiles: null,
                              reviewerNotes: 'Policy document reviewed and appears comprehensive',
                              auditorNotes: null,
                              aiReview: {
                                isFlagged: false,
                                flagReason: null,
                                confidenceScore: 95,
                                riskLevel: 'low',
                                category: 'compliance',
                                summary: 'Applicant provided clear evidence of a documented policy.',
                                aiSuggestion: null,
                              },
                            },
                            {
                              questionId: 'd4e5f6a7-b8c9-0123-defa-456789012345',
                              questionText: 'Please upload your health and safety policy document.',
                              questionType: 'file',
                              applicantAnswer: null,
                              responseType: 'pdf',
                              responseFiles: [
                                'https://storage.example.com/files/hs-policy-2026.pdf',
                              ],
                              reviewerNotes: null,
                              auditorNotes: 'Document verified on-site',
                              aiReview: {
                                isFlagged: true,
                                flagReason: 'Document appears outdated — last revision date is 2019.',
                                confidenceScore: 78,
                                riskLevel: 'medium',
                                category: 'documentation',
                                summary: 'Policy document exists but may not reflect current requirements.',
                                aiSuggestion: 'Request updated document revised within the last 12 months.',
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                statusCode: 200,
                timestamp: '2026-03-15T10:00:00.000Z',
              },
            },
            flagged_only: {
              summary: 'flaggedOnly=true — only AI-flagged questions',
              value: {
                success: true,
                message: 'Audit view retrieved successfully',
                data: {
                  assessmentId: '550e8400-e29b-41d4-a716-446655440002',
                  certificateId: '550e8400-e29b-41d4-a716-446655440010',
                  certificateName: 'ISO 9001:2015 Quality Management',
                  organizationId: '550e8400-e29b-41d4-a716-446655440001',
                  organizationName: 'Acme Manufacturing Ltd.',
                  status: 'ai_reviewing',
                  assessmentType: 'assured',
                  auditDate: '2026-03-15T10:00:00.000Z',
                  auditRecord: null,
                  sections: [
                    {
                      mainSectionId: '9a8b7c6d-5e4f-3210-fedc-ba9876543210',
                      mainSectionName: 'Operational Compliance',
                      sections: [
                        {
                          sectionId: 'a1b2c3d4-e5f6-7890-abcd-123456789012',
                          sectionName: 'Health & Safety',
                          subSections: [],
                          questions: [
                            {
                              questionId: 'd4e5f6a7-b8c9-0123-defa-456789012345',
                              questionText: 'Please upload your health and safety policy document.',
                              questionType: 'file',
                              applicantAnswer: null,
                              responseType: 'pdf',
                              responseFiles: ['https://storage.example.com/files/hs-policy-2026.pdf'],
                              reviewerNotes: null,
                              auditorNotes: null,
                              aiReview: {
                                isFlagged: true,
                                flagReason: 'Document appears outdated — last revision date is 2019.',
                                confidenceScore: 78,
                                riskLevel: 'medium',
                                category: 'documentation',
                                summary: 'Policy document exists but may not reflect current requirements.',
                                aiSuggestion: 'Request updated document revised within the last 12 months.',
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                statusCode: 200,
                timestamp: '2026-03-15T10:00:00.000Z',
              },
            },
            no_answers_yet: {
              summary: 'Assessment has no answered questions yet — empty sections',
              value: {
                success: true,
                message: 'Audit view retrieved successfully',
                data: {
                  assessmentId: '550e8400-e29b-41d4-a716-446655440002',
                  certificateId: '550e8400-e29b-41d4-a716-446655440010',
                  certificateName: 'ISO 9001:2015 Quality Management',
                  organizationId: '550e8400-e29b-41d4-a716-446655440001',
                  organizationName: 'Acme Manufacturing Ltd.',
                  status: 'in_progress',
                  assessmentType: 'self_disclosure',
                  auditDate: null,
                  auditRecord: null,
                  sections: [],
                },
                statusCode: 200,
                timestamp: '2026-03-15T10:00:00.000Z',
              },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Forbidden — not assigned as auditor or reviewer',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: UnauthorizedErrorDto,
    }),
  );
}

export function SwaggerUpdateReviewerNotes() {
  return applyDecorators(
    ApiExtraModels(
      UpdateReviewerNotesResponseDto,
      AssessmentQueryResponseDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Update reviewer notes for an assessment query',
      description: `
Sets or overwrites the reviewer notes field on a specific assessment query.

**Access Control:** Restricted to the \`reviewer\` role — must be the assigned reviewer on this assessment.
      `,
    }),
    ApiParam({ name: 'assessmentId', type: 'string', format: 'uuid' }),
    ApiParam({ name: 'questionId', type: 'string', format: 'uuid' }),
    ApiBody({ type: UpdateReviewerNotesDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Reviewer notes updated successfully',
      type: UpdateReviewerNotesResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment query not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Not assigned as reviewer',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: UnauthorizedErrorDto,
    }),
  );
}

export function SwaggerUpdateAuditorNotes() {
  return applyDecorators(
    ApiExtraModels(
      UpdateAuditorNotesResponseDto,
      AssessmentQueryResponseDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Update auditor notes for an assessment query',
      description: `
Sets or overwrites the auditor notes field on a specific assessment query.

**Access Control:** Restricted to the \`auditor\` role — must be the assigned auditor on this assessment.
      `,
    }),
    ApiParam({ name: 'assessmentId', type: 'string', format: 'uuid' }),
    ApiParam({ name: 'questionId', type: 'string', format: 'uuid' }),
    ApiBody({ type: UpdateAuditorNotesDto }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Auditor notes updated successfully',
      type: UpdateAuditorNotesResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment query not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Not assigned as auditor',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: UnauthorizedErrorDto,
    }),
  );
}

export function SwaggerUpsertAudit() {
  return applyDecorators(
    ApiExtraModels(
      UpsertAuditResponseDto,
      AuditRecordDto,
      BadRequestErrorDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Create or update the audit record for an assessment (auditor)',
      description: `
Upserts the audit record linked to the given assessment. Auditor-specific fields: \`auditSummary\`, \`auditSummaryDoc\`, \`auditDescription\`, \`status\`.

**Score is generated automatically by AI** after the reviewer submits their review.

**Signature requirement:** when \`status\` is provided (finalizing the audit decision), the assigned auditor must have a \`signature\` uploaded on their profile. Otherwise a 400 is returned. Auto-save calls (no \`status\`) are not gated.

**Access Control:** \`admin\`, \`subadmin\`, \`auditor\` (auditor must be assigned).
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440002',
    }),
    ApiBody({
      type: UpsertAuditDto,
      examples: {
        fullApproval: {
          summary: 'Full approval',
          value: {
            auditSummary: 'Strong compliance across all areas.',
            status: 'approved',
          },
        },
        rejection: {
          summary: 'Rejected',
          value: {
            auditSummary: 'Critical non-conformity found.',
            status: 'rejected',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Audit record saved successfully',
      type: UpsertAuditResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        'Auditor signature missing — upload a signature on the auditor profile before finalizing the decision',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Not assigned as auditor',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: UnauthorizedErrorDto,
    }),
  );
}

export function SwaggerUpsertReview() {
  return applyDecorators(
    ApiExtraModels(
      UpsertReviewResponseDto,
      AuditRecordDto,
      BadRequestErrorDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: "Submit or update the reviewer's final review for an assessment",
      description: `
Saves the reviewer's review fields on the active audit record. Reviewer fields: \`reviewSummary\`, \`reviewSummaryDoc\`, \`reviewDescription\`, \`reviewStatus\`.

**Score is generated automatically by AI** after submission, based on both the auditor's and reviewer's assessments.

**Reviewer has final authority** — the \`reviewStatus\` is the definitive decision used when issuing a certificate.

**Signature requirement:** when \`reviewStatus\` is provided (finalizing the review), the reviewer must have a \`signature\` uploaded on their profile. Otherwise a 400 is returned. Auto-save calls (no \`reviewStatus\`) are not gated.

**Access Control:** \`reviewer\` role only — must be the assigned reviewer on this assessment.

**Constraints:**
- An auditor must have created an audit record first
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440002',
    }),
    ApiBody({
      type: UpsertReviewDto,
      examples: {
        fullApproval: {
          summary: 'Reviewer approves',
          value: {
            reviewSummary:
              'All documentation verified. Organisation meets all requirements.',
            reviewDescription:
              'Reviewed audit findings and corroborating evidence. No outstanding issues.',
            reviewStatus: 'approved',
          },
        },
        conditionalApproval: {
          summary: 'Conditional approval',
          value: {
            reviewSummary:
              'Approved subject to resolution of two minor non-conformities within 60 days.',
            reviewStatus: 'conditionally_approved',
          },
        },
        rejection: {
          summary: 'Reviewer rejects',
          value: {
            reviewSummary:
              'Assessment does not meet minimum requirements. Re-audit required.',
            reviewStatus: 'rejected',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description:
        'Review record saved successfully. AI scoring triggered automatically.',
      type: UpsertReviewResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description:
        'No audit record exists yet, or reviewer signature missing when finalizing the review',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Not assigned as reviewer',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: UnauthorizedErrorDto,
    }),
  );
}

export function SwaggerIssueCertificate() {
  return applyDecorators(
    ApiExtraModels(
      IssuedCertificateResponseDto,
      IssuedCertificateDataDto,
      ConflictErrorDto,
      BadRequestErrorDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Issue a certificate for an approved assessment',
      description: `
Issues a certificate for the assessment. Badge is **automatically assigned** based on the **AI-generated score** against the per-certificate badge thresholds.

**What this does:**
- Validates the reviewer has submitted a final \`reviewStatus\` (approved or conditionally_approved)
- Requires the AI audit score to be available (generated after review submission)
- Looks up the highest badge whose score threshold ≤ AI score for this certificate
- Generates a unique certificate number (format: \`ACES-{YEAR}-{000001}\`)
- Creates an \`issued_certificates\` record
- Marks the assessment as \`completed\`
- Notifies the organisation

**Access Control:** \`reviewer\` role only — must be the assigned reviewer.

**Constraints:**
- \`reviewStatus\` must already be set (reviewer must have submitted a review)
- AI scoring must have completed (triggered automatically on review submission)
- \`reviewStatus = rejected\` blocks certificate issuance
- Only one active (non-blocked) certificate per assessment
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440002',
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Certificate issued successfully',
      type: IssuedCertificateResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Active certificate already exists for this assessment',
      type: ConflictErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Review not finalised or assessment rejected',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Not assigned as reviewer',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: UnauthorizedErrorDto,
    }),
  );
}

export function SwaggerBlockCertificate() {
  return applyDecorators(
    ApiExtraModels(
      BlockCertificateResponseDto,
      IssuedCertificateDataDto,
      ConflictErrorDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Block an issued certificate',
      description: `
Blocks an issued certificate for this assessment.

**What this does:**
- Sets \`is_blocked = true\` on the \`issued_certificates\` record
- Sets \`is_certificate_blocked = true\` on the \`certificate_assessments\` record
- Notifies the organisation

**Access Control:** \`admin\`, \`subadmin\`, \`reviewer\`.

**Constraints:** Certificate must exist and not already be blocked.
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440002',
    }),
    ApiBody({
      type: BlockCertificateDto,
      examples: {
        standard: {
          summary: 'Block with reason',
          value: {
            reason:
              'Fraudulent documentation discovered during post-issuance review.',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Certificate blocked successfully',
      type: BlockCertificateResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Certificate is already blocked',
      type: ConflictErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'No issued certificate found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Insufficient role',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: UnauthorizedErrorDto,
    }),
  );
}

export function SwaggerReauditAssessment() {
  return applyDecorators(
    ApiExtraModels(
      ReauditResponseDto,
      ReauditDataDto,
      BadRequestErrorDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Trigger a re-audit of an assessment',
      description: `
Archives the current audit (and reviewer review) record and creates a fresh audit record, allowing the assigned auditor to audit the assessment again.

**What this does:**
1. Archives the active audit row (\`is_archived = true\`)
2. Creates a new blank audit row (version incremented)
3. If an issued certificate exists and is active → blocks it
4. Notifies the assigned auditor

**Access Control:** \`admin\`, \`subadmin\` only.
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440002',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Re-audit initiated',
      type: ReauditResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Insufficient role',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: UnauthorizedErrorDto,
    }),
  );
}

export function SwaggerPostComplianceAction() {
  return applyDecorators(
    ApiExtraModels(
      ComplianceActionResponseDto,
      ComplianceActionDataDto,
      ConflictErrorDto,
      BadRequestErrorDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Post a compliance action on a specific question',
      description: `
Records a compliance action (Non-Compliant, Request Clarification, or Compliant) for a question in an assessment.

**What this does:**
- Saves the action to the \`compliance_actions\` table
- Sends a prefixed message to the relevant chat thread (see thread routing below)
- Notifies the relevant participants

**Chat thread routing:**
| Role | Action | \`clarificationTarget\` | Thread used |
|------|--------|----------------------|-------------|
| auditor | any | \`applicant\` (default) | \`auditor_applicant\` |
| auditor | \`request_clarification\` | \`reviewer\` | \`auditor_reviewer\` (created if needed) |
| reviewer | any | — | \`reviewer_applicant\` |

**Access Control:**
- \`auditor\`: must be the assigned auditor
- \`reviewer\`: must be the assigned reviewer

**Constraints:**
- Blocked once the reviewer has submitted a final review status → 409 Conflict
- \`clarificationTarget\` is only meaningful for auditors using \`request_clarification\`; defaults to \`applicant\` if omitted
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440002',
    }),
    ApiParam({
      name: 'questionId',
      type: 'string',
      format: 'uuid',
      example: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    }),
    ApiBody({
      type: ComplianceActionDto,
      examples: {
        nonCompliant: {
          summary: 'Non-Compliant',
          value: {
            action: 'non_compliant',
            message: 'No supporting documentation was provided.',
          },
        },
        requestClarificationToApplicant: {
          summary: 'Request Clarification → Applicant (auditor)',
          value: {
            action: 'request_clarification',
            message:
              'Please clarify whether the procedure applies to all branches.',
            clarificationTarget: 'applicant',
          },
        },
        requestClarificationToReviewer: {
          summary: 'Request Clarification → Reviewer (auditor only)',
          value: {
            action: 'request_clarification',
            message:
              'The applicant answer conflicts with the audit notes — please advise.',
            clarificationTarget: 'reviewer',
          },
        },
        compliant: {
          summary: 'Compliant',
          value: {
            action: 'compliant',
            message: 'Documentation reviewed and verified. Fully compliant.',
          },
        },
      },
    }),
    ApiResponse({
      status: HttpStatus.CREATED,
      description: 'Compliance action recorded successfully',
      type: ComplianceActionResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description: 'Audit is finalised',
      type: ConflictErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Assessment not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Not assigned as auditor or reviewer',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: UnauthorizedErrorDto,
    }),
  );
}

export function SwaggerGetAuditorAudits() {
  return applyDecorators(
    ApiExtraModels(
      GetAuditorAuditsResponseDto,
      AuditorAuditsPaginatedDataDto,
      AuditorAuditItemDto,
      BadRequestErrorDto,
      NotFoundErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'List audits assigned to an auditor',
      description: `
Returns all audits assigned to a specific auditor, with assessment and lifecycle details.

**Access Control:**
- \`auditor\`: uses their own user ID from the auth token
- \`admin\`, \`subadmin\`: must provide \`auditorProfileId\` query parameter

**Optional filter:** \`lifecycleStatus\` to filter by audit lifecycle stage.
      `,
    }),
    ApiQuery({
      name: 'auditorProfileId',
      required: false,
      type: 'string',
      description:
        'Auditor profile ID (required for admin/subadmin, ignored for auditor)',
    }),
    ApiQuery({
      name: 'lifecycleStatus',
      required: false,
      enum: ['pending', 'in_progress', 'submitted', 'rejected', 'completed'],
      description: 'Filter by computed audit status',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      example: 1,
      description: 'Page number (default: 1)',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 10,
      description: 'Items per page (default: 10)',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'Audits retrieved successfully',
      type: GetAuditorAuditsResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'auditorProfileId required for admin',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'Auditor not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: UnauthorizedErrorDto,
    }),
  );
}

export function SwaggerGetAiAuditScore() {
  return applyDecorators(
    ApiExtraModels(
      AiAuditScoreResponseDto,
      AiAuditScoreDataDto,
      NotFoundErrorDto,
      ForbiddenErrorDto,
      UnauthorizedErrorDto,
    ),
    ApiOperation({
      summary: 'Get the AI-generated audit score for an assessment',
      description: `
Returns the latest AI-generated audit score for the assessment. The score is automatically generated after the reviewer submits their review.

**Response includes:**
- \`aiScore\`: Numeric score (0–100) determined by AI
- \`aiReasoning\`: Explanation of how the score was determined
- \`modelUsed\`: The AI model that generated the score
- \`promptVersion\`: Version of the scoring prompt used

**Access Control:** \`admin\`, \`subadmin\`, \`auditor\`, \`reviewer\`.
      `,
    }),
    ApiParam({
      name: 'assessmentId',
      description: 'UUID of the certificate assessment',
      type: 'string',
      format: 'uuid',
      example: '550e8400-e29b-41d4-a716-446655440002',
    }),
    ApiResponse({
      status: HttpStatus.OK,
      description: 'AI audit score retrieved successfully',
      type: AiAuditScoreResponseDto,
    }),
    ApiResponse({
      status: HttpStatus.NOT_FOUND,
      description: 'No AI score found for this assessment',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.FORBIDDEN,
      description: 'Forbidden',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized',
      type: UnauthorizedErrorDto,
    }),
  );
}

