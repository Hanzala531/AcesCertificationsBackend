import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import {
  AiReviewRepository,
  AiReview,
  AiResponseWithQuestion,
} from '../ai-review.repository';
import { AssessmentRepository } from '../../assessment/assessment.repository';
import { OrganizationRepository } from '../../organization/organization.repository';
import { CertificateRepository } from '../../certificate/certificate.repository';
import { AiProviderFactory } from '../providers/ai-provider.factory';
import {
  FileDownloadService,
  DownloadedFile,
} from '../../../common/services/file-download.service';
import { AiReviewNotificationService } from './ai-review-notification.service';
import { AssessmentService } from '../../assessment/services/assessment.service';
import {
  AssessmentAnalysisResult,
  QuestionAnswerPair,
} from '../providers/ai-provider.interface';
import { ScoreCalculationService } from '../../certificate/services/score-calculation.service';

@Injectable()
export class AiReviewAnalysisService {
  private readonly logger = new Logger(AiReviewAnalysisService.name);

  constructor(
    private readonly aiReviewRepo: AiReviewRepository,
    private readonly assessmentRepo: AssessmentRepository,
    private readonly organizationRepo: OrganizationRepository,
    private readonly certificateRepo: CertificateRepository,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly fileDownloadService: FileDownloadService,
    private readonly notificationService: AiReviewNotificationService,
    private readonly scoreCalculationService: ScoreCalculationService,
    @Inject(forwardRef(() => AssessmentService))
    private readonly assessmentService: AssessmentService,
  ) {}

  private isValidCloudinaryUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      return (
        hostname.includes('cloudinary.com') ||
        url.toLowerCase().includes('res.cloudinary.com')
      );
    } catch {
      return false;
    }
  }

  private async allocateOrganizationBadgeForAssessment(
    assessment: {
      id: string;
      organization_id: string;
      branch_id: string | null;
      certificate_id: string;
    },
    score: number,
  ): Promise<void> {
    const organizationUsers =
      await this.notificationService.getOrganizationUsers(
        assessment.organization_id,
      );

    await this.notificationService.allocateOrganizationBadge(
      assessment,
      score,
      organizationUsers,
    );
  }

  async processAiReview(reviewId: string, assessmentId: string): Promise<void> {
    let downloadedFiles: DownloadedFile[] = [];

    try {
      this.logger.log(`[AI Review] Starting processAiReview for assessment ${assessmentId}, review ${reviewId}`);
      this.logger.log(`[AI Review] Environment info: NODE_ENV=${process.env.NODE_ENV}, VERCEL=${process.env.VERCEL || 'false'}`);
      this.logger.log(`[AI Review] AI Provider config present: ${!!process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
      
      const assessment =
        await this.assessmentRepo.findAssessmentById(assessmentId);
      if (!assessment) {
        this.logger.error(`[AI Review] Assessment not found for ID: ${assessmentId}`);
        throw new Error('Assessment not found');
      }

      this.logger.log(`[AI Review] Assessment found: ${assessmentId}, type: ${assessment.assessment_type}`);

      const certificate = await this.certificateRepo.findCertificateById(
        assessment.certificate_id,
      );
      this.logger.log(`[AI Review] Certificate loaded: ${certificate?.name || 'Unknown'}`);
      
      const organization = await this.organizationRepo.findById(
        assessment.organization_id,
      );
      this.logger.log(`[AI Review] Organization loaded: ${organization?.name || 'Unknown'}`);

      this.logger.log(`[AI Review] Loading questions and answers for assessment ${assessmentId}`);
      const questionsWithAnswers =
        await this.assessmentRepo.getQuestionsWithAnswers(
          assessmentId,
          assessment.certificate_id,
        );
      this.logger.log(`[AI Review] Found ${questionsWithAnswers.length} questions with answers`);

      const answers =
        await this.assessmentRepo.getAssessmentAnswers(assessmentId);
      this.logger.log(`[AI Review] Found ${answers.length} assessment answers`);

      const effectiveQuestions =
        assessment.assessment_type === 'self_disclosure'
          ? questionsWithAnswers.filter((q) => q.answer_id !== null)
          : questionsWithAnswers;

      const fileTypeQuestions = effectiveQuestions.filter(
        (q) =>
          q.question_type === 'file' &&
          q.response_type === 'pdf' &&
          q.response_value &&
          q.response_value.trim() !== '',
      );

      // Only allow cloudinary-hosted files to be downloaded; skip others
      const validFileQuestions = fileTypeQuestions.filter((q) =>
        this.isValidCloudinaryUrl(q.response_value),
      );
      const invalidFileQuestionIds = new Set(
        fileTypeQuestions
          .filter((q) => !this.isValidCloudinaryUrl(q.response_value))
          .map((q) => q.id),
      );

      if (validFileQuestions.length > 0) {
        this.logger.log(
          `[AI Review] Found ${validFileQuestions.length} valid file(s) for assessment ${assessmentId}. Downloading documents...`,
        );

        const filesToDownload = validFileQuestions.map((q) => ({
          url: q.response_value!,
          questionId: q.id,
        }));

        downloadedFiles =
          await this.fileDownloadService.downloadFiles(filesToDownload);

        this.logger.log(
          `[AI Review] Successfully downloaded ${downloadedFiles.length} document(s)`,
        );
      } else if (fileTypeQuestions.length > 0) {
        // There were file-type answers but none had valid URLs
        this.logger.warn(
          `[AI Review] Skipping ${fileTypeQuestions.length} file(s) for assessment ${assessmentId} due to missing/unsupported URLs.`,
        );
      }

      const downloadedFilesMap = new Map(
        downloadedFiles.map((f) => [f.questionId, f]),
      );
      const questionAnswerPairs = effectiveQuestions.map((q) => {
        const downloadedFile = downloadedFilesMap.get(q.id);
        const isInvalidFileAnswer =
          q.question_type === 'file' &&
          q.response_type === 'pdf' &&
          invalidFileQuestionIds.has(q.id);

        return {
          questionId: q.id,
          questionText: q.question_text || 'No question text',
          hint: q.hint || null,
          questionType: q.question_type || 'text',
          options: q.options || null,
          score: q.score ?? 0,
          aiReviewEnabled: q.ai_review_enabled ?? false,
          aiReviewCriteria: q.ai_review_criteria ?? null,
          aiReviewScore: q.ai_review_score ?? null,
          yesScore: q.yes_score ?? null,
          noScore: q.no_score ?? null,
          sectionName: q.section_name || null,
          subSectionName: q.sub_section_name || null,
          answerId: q.answer_id || null,
          responseType: q.response_type || 'text',
          responseValue: isInvalidFileAnswer ? null : q.response_value || '',
          filePath: downloadedFile?.filePath || null,
        };
      });

      const aiProvider = this.aiProviderFactory.getProviderByName('openai');
      const context = {
        certificateName: certificate?.name,
        organizationName: organization?.name,
      };

      if (questionAnswerPairs.length === 0) {
        this.logger.warn(
          `No questions with answers found for assessment ${assessmentId}. Setting score to 0.`,
        );

        const score = 0;
        await this.aiReviewRepo.updateScore(reviewId, score);
        await this.assessmentRepo.updateAssessmentScore(assessmentId, score);

        await this.aiReviewRepo.updateAiReviewStatus(
          reviewId,
          'completed',
          'No answers provided for review.',
        );

        await this.assessmentRepo.updateAssessmentStatus(
          assessmentId,
          'completed',
        );

        return;
      }

      this.logger.log(
        `[AI Review] Starting analysis: ${questionAnswerPairs.length} questions for assessment ${assessmentId} (Certificate: ${certificate?.name || 'N/A'}, Org: ${organization?.name || 'N/A'})${downloadedFiles.length > 0 ? `, ${downloadedFiles.length} document(s) attached` : ''}`,
      );
      const startTime = Date.now();

      const fileAttachments = downloadedFiles.map((f) => ({
        questionId: f.questionId,
        filePath: f.filePath,
      }));

      let analysisResults: AssessmentAnalysisResult;
      try {
        this.logger.log(`[AI Review] Starting AI provider analysis for assessment ${assessmentId}`);
        
        // Add timeout for AI provider calls on Vercel
        const aiProviderPromise = aiProvider.analyzeAssessment(
          questionAnswerPairs,
          context,
          fileAttachments.length > 0 ? fileAttachments : undefined,
        );
        
        const timeoutDuration = process.env.VERCEL ? 30000 : 120000; // 30s for Vercel, 2min for local
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`AI provider timeout after ${timeoutDuration/1000}s`)), timeoutDuration)
        );
        
        analysisResults = await Promise.race([aiProviderPromise, timeoutPromise]);
        this.logger.log(`[AI Review] AI provider analysis completed successfully for assessment ${assessmentId}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        
        this.logger.error(`[AI Review] AI provider analysis failed for assessment ${assessmentId}: ${errorMessage}`);

        // Check if it's a timeout or network error
        if (
          errorMessage.includes('timeout') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('network') ||
          errorMessage.includes('fetch')
        ) {
          this.logger.error(
            `[AI Review] Network/timeout error for assessment ${assessmentId}: ${errorMessage}`,
          );

          // For network/timeout errors, create a fallback score and mark as completed
          await this.handleNetworkTimeoutFallback(reviewId, assessmentId, questionAnswerPairs.length);
          return;
        }

        if (
          errorMessage.includes('Failed to upload') ||
          errorMessage.includes('document upload') ||
          errorMessage.includes('upload failed') ||
          (downloadedFiles.length > 0 && errorMessage.includes('Gemini'))
        ) {
          this.logger.error(
            `[AI Review] Document upload failed for assessment ${assessmentId}: ${errorMessage}`,
          );

          try {
            await this.assessmentService.revertAssessmentSubmission(
              assessmentId,
              `Document upload failed: ${errorMessage}`,
            );
            this.logger.log(
              `[AI Review] Assessment ${assessmentId} submission reverted due to document upload failure`,
            );
          } catch (revertError) {
            this.logger.error(
              `[AI Review] Failed to revert assessment ${assessmentId} after upload failure:`,
              revertError,
            );
          }

          await this.aiReviewRepo.updateAiReviewStatus(
            reviewId,
            'failed',
            `Document upload failed: ${errorMessage}`,
          );

          await this.notificationService.sendAssessmentFailureNotifications(
            assessmentId,
            'document_upload_failed',
            errorMessage,
          );

          return;
        }

        throw error;
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `[AI Review] Analysis completed in ${duration}ms. Received results for ${Object.keys(analysisResults).length} questions.`,
      );

      let totalFlags = 0;
      const answersByQuestionId = new Map(
        answers.map((a) => [a.question_id, a]),
      );

      const batchResponses: Array<{
        assessment_query_id: string;
        ai_review_id: string;
        response?: string;
        is_flagged?: boolean;
        flag_reason?: string;
        confidence_score?: number;
        risk_level?: 'low' | 'medium' | 'high' | null;
        category?: string | null;
        summary?: string | null;
        applicant_answer?: string | null;
      }> = [];

      for (const qaPair of questionAnswerPairs) {
        const aiResult = analysisResults[qaPair.questionId];

        if (!aiResult) {
          this.logger.warn(
            `No AI result found for question ${qaPair.questionId}, skipping`,
          );
          if (
            !qaPair.answerId ||
            !qaPair.responseValue ||
            qaPair.responseValue.trim() === ''
          ) {
            totalFlags++;
          }
          continue;
        }

        const matchingAnswer = answersByQuestionId.get(qaPair.questionId);

        if (matchingAnswer) {
          batchResponses.push({
            assessment_query_id: matchingAnswer.id,
            ai_review_id: reviewId,
            response: aiResult.response,
            is_flagged: aiResult.is_flagged,
            flag_reason: aiResult.flag_reason
              ? aiResult.flag_reason.substring(0, 200)
              : undefined,
            confidence_score: aiResult.confidence_score,
            risk_level: aiResult.risk_level ?? null,
            category: aiResult.category ?? null,
            summary: aiResult.summary
              ? aiResult.summary.substring(0, 150)
              : null,
            applicant_answer: aiResult.applicant_answer ?? null,
          });
        }
        if (
          aiResult.is_flagged ||
          (!matchingAnswer &&
            (!qaPair.responseValue || qaPair.responseValue.trim() === ''))
        ) {
          totalFlags++;
        }
      }

      if (batchResponses.length > 0) {
        await this.aiReviewRepo.createAiResponsesBatch(batchResponses);
      }

      await this.aiReviewRepo.updateTotalFlags(reviewId, totalFlags);

      if (totalFlags > 0) {
        await this.aiReviewRepo.updateFlagStatus(reviewId, 'open');
        this.logger.log(
          `[AI Review] ${totalFlags} flagged response(s) detected for assessment ${assessmentId}`,
        );
      }

      const summary = this.generateReviewSummary(
        effectiveQuestions.length,
        totalFlags,
      );
      await this.aiReviewRepo.updateAiReviewStatus(
        reviewId,
        'completed',
        summary,
      );

      await this.assessmentRepo.updateAssessmentStatus(
        assessmentId,
        'completed',
      );

      const totalQuestions = effectiveQuestions.length;
      const passedQuestions = totalQuestions - totalFlags;
      const scoreSummary = this.calculateReviewScoreSummary(
        questionAnswerPairs,
        batchResponses,
      );
      const score = scoreSummary.finalPercentage;

      this.logger.log(
        `[AI Review] Score Calculation: ${passedQuestions}/${totalQuestions} passed (${totalFlags} flagged) | Earned: ${scoreSummary.earnedScore} | Max: ${scoreSummary.maxScore} | Final Score: ${score}`,
      );

      await this.aiReviewRepo.updateScoreSummary(reviewId, {
        score,
        earned_score: scoreSummary.earnedScore,
        max_score: scoreSummary.maxScore,
        final_percentage: scoreSummary.finalPercentage,
      });
      await this.assessmentRepo.updateAssessmentScore(assessmentId, score, {
        earned_score: scoreSummary.earnedScore,
        max_score: scoreSummary.maxScore,
        final_percentage: scoreSummary.finalPercentage,
      });

      const certificateBadge = await this.scoreCalculationService.assignBadge(
        assessment.certificate_id,
        score,
        assessment.assessment_type,
        assessment.organization_id,
      );

      await this.assessmentRepo.updateAssessmentBadge(
        assessmentId,
        certificateBadge.badgeId ?? undefined,
      );

      const organizationUsers =
        await this.notificationService.getOrganizationUsers(
          assessment.organization_id,
        );

      await this.notificationService.allocateOrganizationBadge(
        assessment,
        score,
        organizationUsers,
      );

      await this.notificationService.sendAssessmentCompletionNotifications(
        assessment,
        score,
        totalFlags,
        organizationUsers,
      );

      this.logger.log(
        `[AI Review] COMPLETED - Assessment: ${assessmentId} | Score: ${score} | Badge: ${certificateBadge.badgeName || 'None'} | Flags: ${totalFlags} | Passed: ${passedQuestions} | Total Questions: ${totalQuestions}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `[AI Review] FAILED - Assessment: ${assessmentId} | Error: ${errorMessage}`,
        errorStack,
      );

      const isUploadError =
        errorMessage.includes('Failed to upload') ||
        errorMessage.includes('document upload') ||
        errorMessage.includes('upload failed') ||
        (downloadedFiles.length > 0 &&
          (errorMessage.includes('Gemini') ||
            errorMessage.includes('OpenAI') ||
            errorMessage.includes('file upload')));

      if (isUploadError) {
        this.logger.error(
          `[AI Review] Document upload failed for assessment ${assessmentId}: ${errorMessage}`,
        );

        try {
          await this.assessmentService.revertAssessmentSubmission(
            assessmentId,
            `Document upload failed: ${errorMessage}`,
          );
          this.logger.log(
            `[AI Review] Assessment ${assessmentId} submission reverted due to document upload failure`,
          );
        } catch (revertError) {
          this.logger.error(
            `[AI Review] Failed to revert assessment ${assessmentId} after upload failure:`,
            revertError,
          );
        }

        await this.aiReviewRepo.updateAiReviewStatus(
          reviewId,
          'failed',
          `Document upload failed: ${errorMessage}`,
        );

        await this.notificationService.sendAssessmentFailureNotifications(
          assessmentId,
          'document_upload_failed',
          errorMessage,
        );
      } else {
        this.logger.error(
          `[AI Review] General AI review failure for assessment ${assessmentId}: ${errorMessage}`,
        );

        try {
          // Revert the assessment submission to allow resubmission
          await this.assessmentService.revertAssessmentSubmission(
            assessmentId,
            `AI review failed: ${errorMessage}`,
          );
          this.logger.log(
            `[AI Review] Assessment ${assessmentId} submission reverted due to AI review failure`,
          );

          // Keep the AI review row marked 'failed' (instead of deleting it) so the
          // scheduled retry job can find and re-run it. A subsequent retry — or a
          // manual resubmission — deletes and recreates this row, so it never
          // blocks resubmission.
          await this.aiReviewRepo.updateAiReviewStatus(
            reviewId,
            'failed',
            `AI review failed: ${errorMessage}`,
          );
          this.logger.log(
            `[AI Review] AI review record ${reviewId} marked failed (kept for retry)`,
          );
        } catch (revertError) {
          this.logger.error(
            `[AI Review] Failed to revert assessment ${assessmentId} after AI review failure:`,
            revertError,
          );
          
          // If revert fails, at least mark AI review as failed
          await this.aiReviewRepo.updateAiReviewStatus(
            reviewId,
            'failed',
            `Review failed: ${errorMessage}`,
          );
        }

        await this.notificationService.sendAssessmentFailureNotifications(
          assessmentId,
          'review_failed',
          errorMessage,
        );
      }
    } finally {
      if (downloadedFiles.length > 0) {
        try {
          await this.fileDownloadService.cleanupFiles(downloadedFiles);
          this.logger.log(
            `[AI Review] Cleaned up ${downloadedFiles.length} downloaded file(s) for assessment ${assessmentId}`,
          );
        } catch (cleanupError) {
          this.logger.error(
            `[AI Review] Failed to cleanup downloaded files for assessment ${assessmentId}:`,
            cleanupError,
          );
          for (const file of downloadedFiles) {
            try {
              await this.fileDownloadService.deleteFile(file.filePath);
            } catch (err) {
              this.logger.error(
                `[AI Review] Failed to delete file ${file.filePath}:`,
                err,
              );
            }
          }
        }
      }
    }
  }

  private simulateAiAnalysis(answer: {
    response_type: string;
    response_value: string | null;
  }): {
    response: string;
    is_flagged: boolean;
    flag_reason: string | null;
    confidence_score: number;
  } {
    if (!answer.response_value) {
      return {
        response: 'No response provided for this question.',
        is_flagged: true,
        flag_reason: 'Missing response',
        confidence_score: 100,
      };
    }

    if (answer.response_type === 'boolean') {
      const value = answer.response_value.toLowerCase();
      if (value === 'no') {
        return {
          response: 'Response indicates non-compliance.',
          is_flagged: true,
          flag_reason: 'Negative compliance response',
          confidence_score: 95,
        };
      }
      return {
        response: 'Response indicates compliance.',
        is_flagged: false,
        flag_reason: null,
        confidence_score: 95,
      };
    }

    if (answer.response_type === 'pdf') {
      return {
        response: 'Document submitted for review.',
        is_flagged: false,
        flag_reason: null,
        confidence_score: 80,
      };
    }

    if (answer.response_type === 'text') {
      if (answer.response_value.length < 20) {
        return {
          response: 'Response may be insufficient.',
          is_flagged: true,
          flag_reason: 'Response too brief',
          confidence_score: 75,
        };
      }
      return {
        response: 'Text response reviewed.',
        is_flagged: false,
        flag_reason: null,
        confidence_score: 85,
      };
    }

    if (answer.response_type === 'number') {
      const num = Number(answer.response_value);
      if (isNaN(num)) {
        return {
          response: 'Invalid numeric response provided.',
          is_flagged: true,
          flag_reason: 'Invalid number format',
          confidence_score: 60,
        };
      }
      return {
        response: 'Numeric response reviewed.',
        is_flagged: false,
        flag_reason: null,
        confidence_score: 85,
      };
    }

    if (answer.response_type === 'checkbox') {
      try {
        const selected = JSON.parse(answer.response_value);
        if (!Array.isArray(selected) || selected.length === 0) {
          return {
            response: 'No options selected.',
            is_flagged: true,
            flag_reason: 'No checkbox options selected',
            confidence_score: 60,
          };
        }
        return {
          response: `${selected.length} option(s) selected and reviewed.`,
          is_flagged: false,
          flag_reason: null,
          confidence_score: 85,
        };
      } catch {
        return {
          response: 'Invalid checkbox response format.',
          is_flagged: true,
          flag_reason: 'Invalid checkbox response format',
          confidence_score: 50,
        };
      }
    }

    if (answer.response_type === 'multiple_choice') {
      if (!answer.response_value || answer.response_value.trim() === '') {
        return {
          response: 'No option selected.',
          is_flagged: true,
          flag_reason: 'No option selected for multiple choice question',
          confidence_score: 60,
        };
      }
      return {
        response: 'Multiple choice response reviewed.',
        is_flagged: false,
        flag_reason: null,
        confidence_score: 85,
      };
    }

    if (answer.response_type === 'rating') {
      const num = Number(answer.response_value);
      if (isNaN(num)) {
        return {
          response: 'Invalid rating value.',
          is_flagged: true,
          flag_reason: 'Invalid rating format',
          confidence_score: 50,
        };
      }
      return {
        response: `Rating of ${num} reviewed.`,
        is_flagged: false,
        flag_reason: null,
        confidence_score: 85,
      };
    }

    return {
      response: 'Response reviewed.',
      is_flagged: false,
      flag_reason: null,
      confidence_score: 70,
    };
  }

  generateReviewSummary(totalAnswers: number, flaggedCount: number): string {
    const passRate =
      totalAnswers > 0
        ? Math.round(((totalAnswers - flaggedCount) / totalAnswers) * 100)
        : 0;

    if (flaggedCount === 0) {
      return `All ${totalAnswers} responses passed AI review. Excellent compliance demonstrated.`;
    } else if (passRate >= 90) {
      return `${totalAnswers - flaggedCount} of ${totalAnswers} responses passed (${passRate}%). ${flaggedCount} response(s) flagged for review.`;
    } else if (passRate >= 70) {
      return `${totalAnswers - flaggedCount} of ${totalAnswers} responses passed (${passRate}%). ${flaggedCount} response(s) require attention.`;
    } else {
      return `Only ${passRate}% of responses passed review. ${flaggedCount} of ${totalAnswers} responses flagged. Significant improvements needed.`;
    }
  }

  async reReviewFlaggedQuestions(assessmentId: string): Promise<void> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const review =
      await this.aiReviewRepo.findAiReviewByAssessmentId(assessmentId);
    if (!review) {
      throw new NotFoundException('AI review not found for this assessment');
    }

    const flaggedResponses = await this.aiReviewRepo.findFlaggedResponses(
      review.id,
    );

    if (flaggedResponses.length > 0) {
      const questionsWithAnswers =
        await this.assessmentRepo.getQuestionsWithAnswers(
          assessmentId,
          assessment.certificate_id,
        );

      const questionAnswerPairs = flaggedResponses
        .map((flagged) => {
          const question = questionsWithAnswers.find(
            (q) => q.answer_id === flagged.assessment_query_id,
          );
          if (!question) return null;
          return {
            questionId: question.id,
            questionText: question.question_text || 'No question text',
            hint: question.hint || null,
            questionType: question.question_type || 'text',
            options: question.options || null,
            score: question.score ?? 0,
            aiReviewEnabled: question.ai_review_enabled ?? false,
            aiReviewCriteria: question.ai_review_criteria ?? null,
            aiReviewScore: question.ai_review_score ?? null,
            yesScore: question.yes_score ?? null,
            noScore: question.no_score ?? null,
            sectionName: question.section_name || null,
            subSectionName: question.sub_section_name || null,
            answerId: question.answer_id || null,
            responseType: question.response_type || 'text',
            responseValue: question.response_value || '',
            filePath: null,
          };
        })
        .filter((item) => item !== null) as QuestionAnswerPair[];

      if (questionAnswerPairs.length > 0) {
        const aiProvider = this.aiProviderFactory.getProviderByName('openai');
        const certificate = await this.certificateRepo.findCertificateById(
          assessment.certificate_id,
        );
        const organization = await this.organizationRepo.findById(
          assessment.organization_id,
        );
        const context = {
          certificateName: certificate?.name,
          organizationName: organization?.name,
        };

        const analysisResults = await aiProvider.analyzeAssessment(
          questionAnswerPairs,
          context,
        );

        const questionsByAnswerId = new Map(
          questionsWithAnswers.map((q) => [q.answer_id, q]),
        );
        const batchUpdates: Array<{
          id: string;
          response?: string | null;
          is_flagged?: boolean;
          flag_reason?: string | null;
          confidence_score?: number | null;
          risk_level?: string | null;
          category?: string | null;
          summary?: string | null;
          applicant_answer?: string | null;
        }> = [];

        for (const flagged of flaggedResponses) {
          const question = questionsByAnswerId.get(flagged.assessment_query_id);
          if (!question) continue;

          const aiResult = analysisResults[question.id];
          if (!aiResult) continue;

          batchUpdates.push({
            id: flagged.id,
            response: aiResult.response,
            is_flagged: aiResult.is_flagged,
            flag_reason: aiResult.flag_reason
              ? aiResult.flag_reason.substring(0, 200)
              : null,
            confidence_score: aiResult.confidence_score,
            risk_level: aiResult.risk_level ?? null,
            category: aiResult.category ?? null,
            summary: aiResult.summary
              ? aiResult.summary.substring(0, 150)
              : null,
            applicant_answer: aiResult.applicant_answer ?? null,
          });
        }

        if (batchUpdates.length > 0) {
          await this.aiReviewRepo.updateAiResponsesBatch(batchUpdates);
        }
      }
    }

    const allResponses = await this.aiReviewRepo.getAllResponsesByReviewId(
      review.id,
    );
    const questionsForScoring =
      await this.assessmentRepo.getQuestionsWithAnswers(
        assessmentId,
        assessment.certificate_id,
      );
    const scoreSummary = this.calculateReviewScoreSummaryFromStoredResponses(
      questionsForScoring,
      allResponses,
    );
    const totalFlags = allResponses.filter((resp) => resp.is_flagged).length;
    const totalQuestions = allResponses.length;
    const score = scoreSummary.finalPercentage;

    await this.aiReviewRepo.updateTotalFlags(review.id, totalFlags);
    await this.aiReviewRepo.updateScoreSummary(review.id, {
      score,
      earned_score: scoreSummary.earnedScore,
      max_score: scoreSummary.maxScore,
      final_percentage: scoreSummary.finalPercentage,
    });
    await this.assessmentRepo.updateAssessmentScore(assessmentId, score, {
      earned_score: scoreSummary.earnedScore,
      max_score: scoreSummary.maxScore,
      final_percentage: scoreSummary.finalPercentage,
    });

    const certificateBadge = await this.scoreCalculationService.assignBadge(
      assessment.certificate_id,
      score,
      assessment.assessment_type,
      assessment.organization_id,
    );
    await this.assessmentRepo.updateAssessmentBadge(
      assessmentId,
      certificateBadge.badgeId ?? undefined,
    );

    if (totalFlags > 0) {
      await this.aiReviewRepo.updateFlagStatus(review.id, 'open');
    } else {
      await this.aiReviewRepo.updateFlagStatus(review.id, 'resolved');
    }

    const summary = this.generateReviewSummary(totalQuestions, totalFlags);
    await this.aiReviewRepo.updateAiReviewStatus(
      review.id,
      'completed',
      summary,
    );

    await this.allocateOrganizationBadgeForAssessment(assessment, score);
    await this.assessmentRepo.updateAssessmentStatus(assessmentId, 'completed');

    this.logger.log(
      `[AI Review] Re-review completed for assessment ${assessmentId}. Score: ${score}, Flags: ${totalFlags}`,
    );
  }

  /**
   * Re-review after a reviewer has submitted their flag review.
   * - Reviewer-accepted flags are treated as 100% compliant (skipped by AI).
   * - Reviewer-rejected flags are re-sent to AI for re-analysis.
   * - If adjustedScore is provided by reviewer, it overrides the calculated score.
   * - If new flags appear after re-review, flag_status stays 'open'.
   */
  async reReviewAfterReviewer(
    assessmentId: string,
    reviewId: string,
    reviewerAdjustedScore?: number | null,
  ): Promise<void> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const review = await this.aiReviewRepo.findAiReviewById(reviewId);
    if (!review) {
      throw new NotFoundException('AI review not found');
    }

    // Get IDs of responses the reviewer accepted (these skip AI re-review)
    const acceptedIds =
      await this.aiReviewRepo.getReviewerAcceptedResponseIds(reviewId);
    const acceptedSet = new Set(acceptedIds);

    // Get all flagged responses
    const flaggedResponses = await this.aiReviewRepo.findFlaggedResponses(
      reviewId,
    );

    // Split into accepted (skip AI) vs rejected (re-send to AI)
    const rejectedResponses = flaggedResponses.filter(
      (r) => !acceptedSet.has(r.id),
    );

    // For accepted responses: mark as unflagged with 100 confidence
    if (acceptedIds.length > 0) {
      const acceptedUpdates = flaggedResponses
        .filter((r) => acceptedSet.has(r.id))
        .map((r) => ({
          id: r.id,
          response: r.response,
          is_flagged: false,
          flag_reason: null,
          confidence_score: 100,
          risk_level: null,
          category: r.category ?? null,
          summary: 'Reviewer approved - marked as compliant',
          applicant_answer: r.applicant_answer ?? null,
        }));

      if (acceptedUpdates.length > 0) {
        await this.aiReviewRepo.updateAiResponsesBatch(acceptedUpdates);
      }
    }

    // For rejected responses: re-send to AI
    if (rejectedResponses.length > 0) {
      const questionsWithAnswers =
        await this.assessmentRepo.getQuestionsWithAnswers(
          assessmentId,
          assessment.certificate_id,
        );

      const questionAnswerPairs = rejectedResponses
        .map((flagged) => {
          const question = questionsWithAnswers.find(
            (q) => q.answer_id === flagged.assessment_query_id,
          );
          if (!question) return null;
          return {
            questionId: question.id,
            questionText: question.question_text || 'No question text',
            hint: question.hint || null,
            questionType: question.question_type || 'text',
            options: question.options || null,
            score: question.score ?? 0,
            aiReviewEnabled: question.ai_review_enabled ?? false,
            aiReviewCriteria: question.ai_review_criteria ?? null,
            aiReviewScore: question.ai_review_score ?? null,
            yesScore: question.yes_score ?? null,
            noScore: question.no_score ?? null,
            sectionName: question.section_name || null,
            subSectionName: question.sub_section_name || null,
            answerId: question.answer_id || null,
            responseType: question.response_type || 'text',
            responseValue: question.response_value || '',
            filePath: null,
          };
        })
        .filter((item) => item !== null) as QuestionAnswerPair[];

      if (questionAnswerPairs.length > 0) {
        const aiProvider = this.aiProviderFactory.getProviderByName('openai');
        const certificate = await this.certificateRepo.findCertificateById(
          assessment.certificate_id,
        );
        const organization = await this.organizationRepo.findById(
          assessment.organization_id,
        );
        const context = {
          certificateName: certificate?.name,
          organizationName: organization?.name,
        };

        const analysisResults = await aiProvider.analyzeAssessment(
          questionAnswerPairs,
          context,
        );

        const questionsByAnswerId = new Map(
          questionsWithAnswers.map((q) => [q.answer_id, q]),
        );

        const batchUpdates: Array<{
          id: string;
          response?: string | null;
          is_flagged?: boolean;
          flag_reason?: string | null;
          confidence_score?: number | null;
          risk_level?: string | null;
          category?: string | null;
          summary?: string | null;
          applicant_answer?: string | null;
        }> = [];

        for (const rejected of rejectedResponses) {
          const question = questionsByAnswerId.get(
            rejected.assessment_query_id,
          );
          if (!question) continue;

          const aiResult = analysisResults[question.id];
          if (!aiResult) continue;

          batchUpdates.push({
            id: rejected.id,
            response: aiResult.response,
            is_flagged: aiResult.is_flagged,
            flag_reason: aiResult.flag_reason
              ? aiResult.flag_reason.substring(0, 200)
              : null,
            confidence_score: aiResult.confidence_score,
            risk_level: aiResult.risk_level ?? null,
            category: aiResult.category ?? null,
            summary: aiResult.summary
              ? aiResult.summary.substring(0, 150)
              : null,
            applicant_answer: aiResult.applicant_answer ?? null,
          });
        }

        if (batchUpdates.length > 0) {
          await this.aiReviewRepo.updateAiResponsesBatch(batchUpdates);
        }
      }
    }

    // Recalculate score from ALL responses
    const allResponses = await this.aiReviewRepo.getAllResponsesByReviewId(
      reviewId,
    );

    const questionsForScoring =
      await this.assessmentRepo.getQuestionsWithAnswers(
        assessmentId,
        assessment.certificate_id,
      );
    const scoreSummary = this.calculateReviewScoreSummaryFromStoredResponses(
      questionsForScoring,
      allResponses,
    );
    const totalFlags = allResponses.filter((resp) => resp.is_flagged).length;
    let score = scoreSummary.finalPercentage;

    // If reviewer provided an adjusted score, use it
    if (reviewerAdjustedScore != null) {
      score = reviewerAdjustedScore;
    }

    await this.aiReviewRepo.updateTotalFlags(reviewId, totalFlags);
    await this.aiReviewRepo.updateScoreSummary(reviewId, {
      score,
      earned_score: reviewerAdjustedScore != null ? null : scoreSummary.earnedScore,
      max_score: reviewerAdjustedScore != null ? null : scoreSummary.maxScore,
      final_percentage:
        reviewerAdjustedScore != null ? reviewerAdjustedScore : scoreSummary.finalPercentage,
    });
    await this.assessmentRepo.updateAssessmentScore(assessmentId, score, {
      earned_score: reviewerAdjustedScore != null ? null : scoreSummary.earnedScore,
      max_score: reviewerAdjustedScore != null ? null : scoreSummary.maxScore,
      final_percentage:
        reviewerAdjustedScore != null ? reviewerAdjustedScore : scoreSummary.finalPercentage,
    });

    const certificateBadge = await this.scoreCalculationService.assignBadge(
      assessment.certificate_id,
      score,
      assessment.assessment_type,
      assessment.organization_id,
    );
    await this.assessmentRepo.updateAssessmentBadge(
      assessmentId,
      certificateBadge.badgeId ?? undefined,
    );

    if (totalFlags > 0) {
      await this.aiReviewRepo.updateFlagStatus(reviewId, 'open');
    } else {
      await this.aiReviewRepo.updateFlagStatus(reviewId, 'resolved');
    }

    const totalQuestions = allResponses.length;
    const summary = this.generateReviewSummary(totalQuestions, totalFlags);
    await this.aiReviewRepo.updateAiReviewStatus(
      reviewId,
      'completed',
      summary,
    );

    await this.allocateOrganizationBadgeForAssessment(assessment, score);
    await this.assessmentRepo.updateAssessmentStatus(assessmentId, 'completed');

    this.logger.log(
      `[AI Review] Reviewer re-review completed for assessment ${assessmentId}. Score: ${score}, Flags: ${totalFlags}, Accepted by reviewer: ${acceptedIds.length}`,
    );
  }

  /**
   * Handles fallback scoring when AI provider fails due to network/timeout issues on Vercel
   */
  private async handleNetworkTimeoutFallback(
    reviewId: string,
    assessmentId: string,
    totalQuestions: number,
  ): Promise<void> {
    try {
      this.logger.log(`[AI Review] Applying network timeout fallback for assessment ${assessmentId}`);
      
      // Create a conservative fallback score (70% - assuming most answers are acceptable)
      const fallbackScore = Math.max(0, Math.min(100, Math.round(totalQuestions > 0 ? 70 : 0)));
      
      this.logger.log(`[AI Review] Setting fallback score ${fallbackScore} for ${totalQuestions} questions`);
      
      await this.aiReviewRepo.updateScoreSummary(reviewId, {
        score: fallbackScore,
        earned_score: null,
        max_score: null,
        final_percentage: fallbackScore,
      });
      await this.assessmentRepo.updateAssessmentScore(assessmentId, fallbackScore);
      
      // Update badge based on score
      const assessment = await this.assessmentRepo.findAssessmentById(assessmentId);
      if (assessment) {
        const certificateBadge = await this.scoreCalculationService.assignBadge(
          assessment.certificate_id,
          fallbackScore,
          assessment.assessment_type,
          assessment.organization_id,
        );
        
        await this.assessmentRepo.updateAssessmentBadge(
          assessmentId,
          certificateBadge.badgeId ?? undefined,
        );

        await this.allocateOrganizationBadgeForAssessment(
          assessment,
          fallbackScore,
        );
      }
      
      // Mark as completed with fallback note
      await this.aiReviewRepo.updateAiReviewStatus(
        reviewId,
        'completed',
        `Completed with fallback scoring due to AI provider timeout. Score: ${fallbackScore}`,
      );
      
      await this.assessmentRepo.updateAssessmentStatus(assessmentId, 'completed');
      
      this.logger.log(
        `[AI Review] Fallback processing completed for assessment ${assessmentId}. Score: ${fallbackScore}`,
      );
      
    } catch (fallbackError) {
      this.logger.error(
        `[AI Review] Fallback processing also failed for assessment ${assessmentId}:`,
        fallbackError,
      );
      
      // Last resort - revert the assessment
      try {
        await this.assessmentService.revertAssessmentSubmission(
          assessmentId,
          'AI review failed and fallback processing also failed',
        );
        await this.aiReviewRepo.deleteAiReview(reviewId);
      } catch (revertError) {
        this.logger.error(
          `[AI Review] Failed to revert assessment after fallback failure:`,
          revertError,
        );
      }
    }
  }

  private calculateReviewScoreSummary(
    questionAnswerPairs: QuestionAnswerPair[],
    responses: Array<{
      assessment_query_id: string;
      is_flagged?: boolean;
      confidence_score?: number;
    }>,
  ) {
    const responseByAnswerId = new Map(
      responses.map((response) => [response.assessment_query_id, response]),
    );

    return this.scoreCalculationService.calculateCertificateScore(
      questionAnswerPairs.map((question) => {
        const response = question.answerId
          ? responseByAnswerId.get(question.answerId)
          : undefined;

        const earnedScore = this.scoreCalculationService.calculateQuestionScore({
          questionId: question.questionId,
          questionType: question.questionType,
          score: question.score ?? 0,
          yesScore: question.yesScore ?? null,
          noScore: question.noScore ?? null,
          aiReviewEnabled: question.aiReviewEnabled ?? false,
          aiReviewScore: question.aiReviewScore ?? null,
          isFlagged: response?.is_flagged ?? false,
          confidenceScore: response?.confidence_score ?? null,
          responseValue: question.responseValue ?? null,
        });

        const maxScore = this.scoreCalculationService.getQuestionMaxScore({
          questionType: question.questionType,
          score: question.score ?? 0,
          yesScore: question.yesScore ?? null,
          noScore: question.noScore ?? null,
          aiReviewEnabled: question.aiReviewEnabled ?? false,
          aiReviewScore: question.aiReviewScore ?? null,
        });

        return { earnedScore, maxScore };
      }),
    );
  }

  private calculateReviewScoreSummaryFromStoredResponses(
    questionsWithAnswers: Array<{
      id: string;
      question_type: string;
      score: number;
      yes_score: number | null;
      no_score: number | null;
      ai_review_enabled: boolean;
      ai_review_score: number | null;
      answer_id: string | null;
      response_value: string | null;
    }>,
    allResponses: Array<{
      assessment_query_id: string;
      is_flagged: boolean;
      confidence_score: number | null;
    }>,
  ) {
    const responseByAnswerId = new Map(
      allResponses.map((response) => [response.assessment_query_id, response]),
    );

    return this.scoreCalculationService.calculateCertificateScore(
      questionsWithAnswers.map((question) => {
        const response = question.answer_id
          ? responseByAnswerId.get(question.answer_id)
          : undefined;

        const input = {
          questionId: question.id,
          questionType: question.question_type,
          score: question.score ?? 0,
          yesScore: question.yes_score ?? null,
          noScore: question.no_score ?? null,
          aiReviewEnabled: question.ai_review_enabled ?? false,
          aiReviewScore: question.ai_review_score ?? null,
          isFlagged: response?.is_flagged ?? false,
          confidenceScore: response?.confidence_score ?? null,
          responseValue: question.response_value ?? null,
        };

        return {
          earnedScore: this.scoreCalculationService.calculateQuestionScore(input),
          maxScore: this.scoreCalculationService.getQuestionMaxScore(input),
        };
      }),
    );
  }
}
