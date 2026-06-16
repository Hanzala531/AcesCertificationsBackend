import { ApiProperty } from '@nestjs/swagger';

export class AssessmentMetricsDto {
  @ApiProperty({ example: 8, description: 'Total number of assessments' })
  totalAssessments: number;

  @ApiProperty({
    example: 8,
    description: 'Number of assessments flagged by AI',
  })
  aiFlagged: number;

  @ApiProperty({
    example: 8,
    description: 'Number of assessments pending audit',
  })
  pendingAudits: number;

  @ApiProperty({ example: 8, description: 'Number of completed assessments' })
  completed: number;
}

export class GetAssessmentMetricsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AssessmentMetricsDto })
  data: AssessmentMetricsDto;
}

export class AdminAssessmentRecordDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  assessmentId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  organizationId: string;

  @ApiProperty({ example: 'Grand Hyatt Singapore' })
  organizationName: string;

  @ApiProperty({
    example: 'HOS-WKP-HR: Workplace',
    description: 'Certificate name',
  })
  certificationType: string;

  @ApiProperty({
    example: false,
    description:
      'Whether certificate allocation/progression is blocked by admin for this assessment',
  })
  isCertificateBlocked: boolean;

  @ApiProperty({
    example: 'Critical evidence missing',
    nullable: true,
    description: 'Reason provided by admin when blocking the assessment',
  })
  certificateBlockReason: string | null;

  @ApiProperty({
    example: 'ACES Rated / Gold',
    nullable: true,
    description: 'Badge status display',
  })
  badgeStatus: string | null;

  @ApiProperty({
    example: '#FFD700',
    nullable: true,
    description: 'Badge color',
  })
  badgeColor: string | null;

  @ApiProperty({
    example: 'Sarah Chen',
    nullable: true,
    description: 'Assigned reviewer name',
  })
  assignedReviewer: string | null;

  @ApiProperty({
    example: '2 discrepancies flagged by AI',
    nullable: true,
    description: 'AI flag reason or status',
  })
  aiFlagReason: string | null;

  @ApiProperty({
    example: 'Michael Wong',
    nullable: true,
    description: 'Assigned auditor name',
  })
  assignedAuditor: string | null;

  @ApiProperty({
    example: true,
    description:
      'Whether an auditor has been invited (pending invitation) for this assessment',
  })
  auditorInvited: boolean;

  @ApiProperty({
    example: 'Michael Wong',
    nullable: true,
    description:
      'Name of the auditor who has been invited (pending) for this assessment',
  })
  invitedAuditorName: string | null;

  @ApiProperty({
    example: '2024-12-20T10:00:00.000Z',
    nullable: true,
    description: 'Date when assessment was flagged/submitted',
  })
  flaggedDate: Date | null;

  @ApiProperty({
    example: '2024-12-22T10:00:00.000Z',
    nullable: true,
    description: 'Scheduled audit date',
  })
  auditDate: Date | null;

  @ApiProperty({ example: 92.5, nullable: true })
  score: number | null;

  @ApiProperty({
    example: 'completed',
    enum: ['in_progress', 'submitted', 'ai_reviewing', 'completed', 'expired'],
  })
  status: string;

  @ApiProperty({ example: 'assured', enum: ['self_disclosure', 'assured'] })
  assessmentType: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174002',
    nullable: true,
    description: 'Assurance review ID (present only for assured assessments)',
  })
  assuranceId: string | null;
}

export class AdminAssessmentListResponse {
  @ApiProperty({ type: [AdminAssessmentRecordDto] })
  data: AdminAssessmentRecordDto[];

  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}

export class GetAdminAssessmentListApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AdminAssessmentListResponse })
  data: AdminAssessmentListResponse;
}

export class AiReviewDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Assessment review completed', nullable: true })
  reviewDescription: string | null;

  @ApiProperty({
    example: 'completed',
    enum: ['pending', 'in_progress', 'completed', 'failed'],
  })
  reviewStatus: string;

  @ApiProperty({ example: 2 })
  totalFlags: number;

  @ApiProperty({
    example: 'open',
    nullable: true,
    enum: ['open', 'pending', 'escalated', 'resolved'],
  })
  flagStatus: string | null;

  @ApiProperty({ example: 92.5, nullable: true })
  score: number | null;

  @ApiProperty({ example: '2024-12-20T10:00:00.000Z', nullable: true })
  startedAt: Date | null;

  @ApiProperty({ example: '2024-12-20T10:05:00.000Z', nullable: true })
  completedAt: Date | null;
}

export class AdminAssessmentDetailsDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  assessmentId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  organizationId: string;

  @ApiProperty({ example: 'Grand Hyatt Singapore' })
  organizationName: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174002',
    nullable: true,
  })
  branchId: string | null;

  @ApiProperty({ example: 'Main Branch', nullable: true })
  branchName: string | null;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174003' })
  certificateId: string;

  @ApiProperty({ example: 'HOS-WKP-HR: Workplace' })
  certificateName: string;

  @ApiProperty({ example: 'HOS-WKP-HR-2024', nullable: true })
  certificateProductId: string | null;

  @ApiProperty({
    example: false,
    description:
      'Whether certificate allocation/progression is blocked by admin for this assessment',
  })
  isCertificateBlocked: boolean;

  @ApiProperty({
    example: 'Critical evidence missing',
    nullable: true,
    description: 'Reason provided by admin when blocking the assessment',
  })
  certificateBlockReason: string | null;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174004' })
  paymentId: string;

  @ApiProperty({ example: 'assured', enum: ['self_disclosure', 'assured'] })
  assessmentType: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174005',
    nullable: true,
  })
  badgeId: string | null;

  @ApiProperty({
    example: 'gold',
    nullable: true,
    enum: ['bronze', 'silver', 'gold', 'platinum'],
  })
  badgeName: string | null;

  @ApiProperty({ example: '#FFD700', nullable: true })
  badgeColor: string | null;

  @ApiProperty({ example: 92.5, nullable: true })
  score: number | null;

  @ApiProperty({ example: true })
  isSubmitted: boolean;

  @ApiProperty({
    example: 'completed',
    enum: ['in_progress', 'submitted', 'ai_reviewing', 'completed', 'expired'],
  })
  status: string;

  @ApiProperty({ example: '2024-12-20T10:00:00.000Z', nullable: true })
  submittedAt: Date | null;

  @ApiProperty({ example: '2024-12-20T10:05:00.000Z', nullable: true })
  completedAt: Date | null;

  @ApiProperty({ example: '2024-12-22T10:00:00.000Z', nullable: true })
  auditDate: Date | null;

  @ApiProperty({ example: '2024-12-20T09:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-12-20T10:05:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: AiReviewDto, nullable: true })
  aiReview: AiReviewDto | null;

  @ApiProperty({ example: 'Sarah Chen', nullable: true })
  assignedReviewer: string | null;

  @ApiProperty({ example: 'Michael Wong', nullable: true })
  assignedAuditor: string | null;

  @ApiProperty({
    example: true,
    description:
      'Whether an auditor has been invited (pending invitation) for this assessment',
  })
  auditorInvited: boolean;

  @ApiProperty({
    example: 'Michael Wong',
    nullable: true,
    description:
      'Name of the auditor who has been invited (pending) for this assessment',
  })
  invitedAuditorName: string | null;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174006',
    nullable: true,
    description: 'Assurance review ID (present only for assured assessments)',
  })
  assuranceId: string | null;
}

export class GetAdminAssessmentDetailsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AdminAssessmentDetailsDto })
  data: AdminAssessmentDetailsDto;
}

export class AdminAssessmentErrorDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 'Assessment not found' })
  message: string;
}

export class SelfDisclosureStatsDto {
  @ApiProperty({ example: 12, description: 'Total number of published certificates' })
  totalCertificates: number;

  @ApiProperty({ example: 5, description: 'Number of in-progress self-disclosure assessments' })
  inProgress: number;

  @ApiProperty({ example: 7, description: 'Number of completed self-disclosure assessments' })
  completed: number;

  @ApiProperty({ example: 4, description: 'Number of issued certificates that have not expired and are not blocked' })
  activeIssuedCertificates: number;
}

export class SelfAssuredStatsDto {
  @ApiProperty({ example: 10, description: 'Total number of self-assured assessments' })
  total: number;

  @ApiProperty({ example: 3, description: 'Number of in-progress self-assured assessments' })
  inProgress: number;

  @ApiProperty({ example: 2, description: 'Number of self-assured assessments in auditor-assigned phase' })
  auditorAssigned: number;

  @ApiProperty({ example: 5, description: 'Number of completed self-assured assessments' })
  completed: number;
}

export class AdminDashboardStatsDto {
  @ApiProperty({ type: SelfDisclosureStatsDto })
  selfDisclosure: SelfDisclosureStatsDto;

  @ApiProperty({ type: SelfAssuredStatsDto })
  selfAssured: SelfAssuredStatsDto;
}

export class GetAdminDashboardStatsApiResponse {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AdminDashboardStatsDto })
  data: AdminDashboardStatsDto;
}
