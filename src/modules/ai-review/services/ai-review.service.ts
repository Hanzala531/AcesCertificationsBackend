import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  AiReviewRepository,
  AiReview,
  AiResponseWithQuestion,
} from '../ai-review.repository';
import { AssessmentRepository } from '../../assessment/assessment.repository';
import { OrganizationRepository } from '../../organization/organization.repository';
import { EmployeeRepository } from '../../employee/employee.repository';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import { CertificateRepository } from '../../certificate/certificate.repository';
import { AiReviewAnalysisService } from './ai-review-analysis.service';

@Injectable()
export class AiReviewService {
  private readonly logger = new Logger(AiReviewService.name);

  constructor(
    private readonly aiReviewRepo: AiReviewRepository,
    private readonly assessmentRepo: AssessmentRepository,
    private readonly organizationRepo: OrganizationRepository,
    private readonly employeeRepo: EmployeeRepository,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly certificateRepo: CertificateRepository,
    @Inject(forwardRef(() => AiReviewAnalysisService))
    private readonly analysisService: AiReviewAnalysisService,
  ) {}

  async getAiReviewForAssessment(
    userId: string,
    userRole: string,
    assessmentId: string,
  ): Promise<AiReview & { responses: AiResponseWithQuestion[] }> {
    await this.verifyAssessmentAccess(userId, userRole, assessmentId);

    const review =
      await this.aiReviewRepo.findAiReviewByAssessmentId(assessmentId);

    if (!review) {
      throw new NotFoundException('AI review not found for this assessment');
    }

    const responses = await this.aiReviewRepo.findAiResponsesByReviewId(
      review.id,
    );

    return {
      ...review,
      responses,
    };
  }

  async getFlaggedResponses(
    userId: string,
    userRole: string,
    assessmentId: string,
  ): Promise<AiResponseWithQuestion[]> {
    await this.verifyAssessmentAccess(userId, userRole, assessmentId);

    return this.aiReviewRepo.findFlaggedResponsesByAssessmentId(assessmentId);
  }

  async getAiSuggestionForQuestion(
    userId: string,
    userRole: string,
    assessmentId: string,
    questionId: string,
  ): Promise<{
    question_text: string;
    question_type: string;
    applicant_answer: string | null;
    ai_suggestion: string | null;
    flag_reason: string | null;
    is_flagged: boolean;
    risk_level: 'low' | 'medium' | 'high' | null;
    category: string | null;
  }> {
    await this.verifyAssessmentAccess(userId, userRole, assessmentId);

    const aiResponse = await this.aiReviewRepo.getAiResponseByQuestionId(
      assessmentId,
      questionId,
    );

    if (!aiResponse) {
      throw new NotFoundException(
        'AI response not found for this question. The assessment may not have been reviewed yet.',
      );
    }

    let suggestion = aiResponse.ai_suggestion || null;
    if (suggestion) {
      const maxLength = 3000;
      if (suggestion.length > maxLength) {
        suggestion = suggestion.substring(0, maxLength).trim() + '...';
      }
    }

    return {
      question_text: aiResponse.question_text || 'Unknown question',
      question_type: aiResponse.question_type || 'unknown',
      applicant_answer:
        aiResponse.applicant_answer || aiResponse.response_value || null,
      ai_suggestion: suggestion,
      flag_reason: aiResponse.flag_reason,
      is_flagged: aiResponse.is_flagged,
      risk_level: aiResponse.risk_level || null,
      category: aiResponse.category || null,
    };
  }

  async getQuestionGuidance(questionId: string): Promise<{
    question_id: string;
    question_text: string;
    question_type: string;
    suggestions: string[];
  }> {
    const question = await this.certificateRepo.findQuestionById(questionId);

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const aiProvider = this.aiProviderFactory.getProviderByName('openai');
    const suggestions = await aiProvider.generateQuestionGuidance(
      question.question,
      question.type,
      question.hint || null,
    );

    return {
      question_id: question.id,
      question_text: question.question,
      question_type: question.type,
      suggestions,
    };
  }

  async getAllAiFlags(params: {
    status?: 'open' | 'pending' | 'escalated' | 'resolved';
    limit?: number;
    offset?: number;
  }) {
    return this.aiReviewRepo.findAllAiFlags(params);
  }

  async getFlaggedAssessments(params: { limit?: number; offset?: number }) {
    return this.aiReviewRepo.findFlaggedAssessments(params);
  }

  async getAiFlagDetails(reviewId: string): Promise<{
    review: AiReview;
    flaggedResponses: AiResponseWithQuestion[];
    organizationName: string;
    certificateName: string;
    isReviewerAssigned: boolean;
  }> {
    const review = await this.aiReviewRepo.findAiReviewById(reviewId);
    if (!review) {
      throw new NotFoundException('AI review not found');
    }

    const assessment = await this.assessmentRepo.findAssessmentById(
      review.certificate_assessment_id,
    );
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const [certificate, organization, flaggedResponses] = await Promise.all([
      this.certificateRepo.findCertificateById(assessment.certificate_id),
      this.organizationRepo.findById(assessment.organization_id),
      this.aiReviewRepo.findFlaggedResponses(reviewId),
    ]);

    return {
      review,
      flaggedResponses,
      organizationName: organization?.name || 'Unknown',
      certificateName: certificate?.name || 'Unknown',
      isReviewerAssigned: review.is_reviewer_assigned,
    };
  }

  async updateFlagStatus(
    reviewId: string,
    status: 'open' | 'pending' | 'escalated' | 'resolved',
  ): Promise<AiReview> {
    const review = await this.aiReviewRepo.findAiReviewById(reviewId);
    if (!review) {
      throw new NotFoundException('AI review not found');
    }

    return this.aiReviewRepo.updateFlagStatus(reviewId, status);
  }

  async triggerAiReview(assessmentId: string): Promise<AiReview> {
    this.logger.log(`[AI Review] Trigger started for assessment ${assessmentId}`);
    
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);

    if (!assessment) {
      this.logger.error(`[AI Review] Assessment not found: ${assessmentId}`);
      throw new NotFoundException('Assessment not found');
    }

    this.logger.log(`[AI Review] Assessment found, checking for existing review: ${assessmentId}`);
    
    let review =
      await this.aiReviewRepo.findAiReviewByAssessmentId(assessmentId);

    if (!review) {
      this.logger.log(`[AI Review] Creating new AI review for assessment: ${assessmentId}`);
      review = await this.aiReviewRepo.createAiReview(assessmentId);
    } else {
      this.logger.log(`[AI Review] Found existing AI review ${review.id} for assessment: ${assessmentId}, status: ${review.review_status}`);

      // Delete old review and create fresh one for re-review
      this.logger.log(`[AI Review] Deleting existing review ${review.id} and creating new one`);
      await this.aiReviewRepo.deleteAiReview(review.id);
      // Clear old badge and score so stale data doesn't persist during re-review
      await this.assessmentRepo.updateAssessmentBadge(assessmentId, undefined);
      await this.assessmentRepo.updateAssessmentScore(assessmentId, 0);
      review = await this.aiReviewRepo.createAiReview(assessmentId);
    }

    this.logger.log(`[AI Review] Updating review status to in_progress: ${review.id}`);
    await this.aiReviewRepo.updateAiReviewStatus(review.id, 'in_progress');

    // Process AI review — let it run to completion, no artificial timeout
    this.logger.log(`[AI Review] Starting processing for review: ${review.id}`);
    await this.analysisService.processAiReview(review.id, assessmentId);
    this.logger.log(`[AI Review] Processing completed for assessment ${assessmentId}`);

    this.logger.log(`[AI Review] Trigger completed successfully for assessment ${assessmentId}, review ID: ${review.id}`);
    return review;
  }

  private async processAiReviewAsync(reviewId: string, assessmentId: string): Promise<void> {
    try {
      this.logger.log(`[AI Review] Starting async AI review processing for assessment ${assessmentId}`);
      
      // Add a small delay to ensure the HTTP response has been sent
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Log environment information for debugging
      this.logger.log(`[AI Review] Environment: NODE_ENV=${process.env.NODE_ENV}, VERCEL=${process.env.VERCEL || 'false'}`);
      this.logger.log(`[AI Review] Memory usage: ${JSON.stringify(process.memoryUsage())}`);
      
      await this.analysisService.processAiReview(reviewId, assessmentId);
      this.logger.log(`[AI Review] AI review processing completed successfully for assessment ${assessmentId}`);
    } catch (error) {
      this.logger.error(
        `[AI Review] AI review processing failed for assessment ${assessmentId}:`,
        error,
      );
      
      // Log detailed error information 
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[AI Review] Error type: ${error?.constructor?.name || 'Unknown'}`);
      this.logger.error(`[AI Review] Error message: ${errorMessage}`);
      this.logger.error(`[AI Review] Stack trace: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      
      // The error handling inside processAiReview will handle cleanup and notifications
      throw error;
    }
  }

  private async verifyAssessmentAccess(
    userId: string,
    userRole: string,
    assessmentId: string,
  ): Promise<void> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    let organizationId: string;
    let branchId: string | undefined;

    // Allow admins and subadmins to access any assessment
    if (userRole === 'admin' || userRole === 'subadmin') {
      this.logger.debug(`Admin/subadmin access granted for role: ${userRole}`);
      return;
    }

    if (userRole === 'organization') {
      const org = await this.organizationRepo.findByUserId(userId);
      if (!org) {
        throw new ForbiddenException('Organization not found');
      }
      organizationId = org.id;
    } else if (userRole === 'organization_member') {
      const employee = await this.employeeRepo.findByUserId(userId);
      if (!employee) {
        throw new ForbiddenException('Employee not found');
      }
      organizationId = employee.organization_id;
      branchId = employee.branch_id ?? undefined;
    } else {
      throw new ForbiddenException('Invalid role');
    }

    if (assessment.organization_id !== organizationId) {
      throw new ForbiddenException('Access denied to this assessment');
    }

    if (
      userRole === 'organization_member' &&
      branchId &&
      assessment.branch_id
    ) {
      if (assessment.branch_id !== branchId) {
        throw new ForbiddenException('Access denied to this assessment');
      }
    }
  }

  async listAvailableModels() {
    const provider = this.aiProviderFactory.getProviderByName('openai');
    return await provider.listAvailableModels();
  }

  async approveQuestion(
    reviewId: string,
    responseId: string,
  ): Promise<{
    response: import('../ai-review.repository').AiResponse;
    reviewClosed: boolean;
    review: AiReview;
  }> {
    const review = await this.aiReviewRepo.findAiReviewById(reviewId);
    if (!review) {
      throw new NotFoundException('AI review not found');
    }

    const aiResponse = await this.aiReviewRepo.findAiResponseByIdAndReviewId(
      responseId,
      reviewId,
    );
    if (!aiResponse) {
      throw new NotFoundException(
        'AI response not found or does not belong to this review',
      );
    }

    const updatedResponse =
      await this.aiReviewRepo.approveQuestionResponse(responseId);

    const allApproved =
      await this.aiReviewRepo.areAllFlaggedResponsesApproved(reviewId);

    let updatedReview = review;
    let reviewClosed = false;

    if (allApproved) {
      updatedReview = await this.aiReviewRepo.updateFlagStatus(
        reviewId,
        'resolved',
      );
      reviewClosed = true;
    }

    return { response: updatedResponse, reviewClosed, review: updatedReview };
  }
}
