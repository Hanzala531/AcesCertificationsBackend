export interface AiAnalysisResult {
  response: string;
  is_flagged: boolean;
  flag_reason: string | null;
  confidence_score: number;
  risk_level?: 'low' | 'medium' | 'high';
  category?: string;
  summary?: string;
  applicant_answer?: string | null;
}

export interface QuestionAnswerPair {
  questionId: string;
  questionText: string;
  hint?: string | null;
  questionType: string;
  options?: string[] | null;
  score?: number;
  aiReviewEnabled?: boolean;
  aiReviewCriteria?: string | null;
  aiReviewScore?: number | null;
  yesScore?: number | null;
  noScore?: number | null;
  sectionName?: string | null;
  subSectionName?: string | null;
  answerId: string | null;
  responseType: string | null;
  responseValue: string | null;
  filePath?: string | null;
}

export interface AssessmentAnalysisResult {
  [questionId: string]: AiAnalysisResult;
}

export interface AiModelInfo {
  name: string;
  displayName: string;
  supportedGenerationMethods: string[];
  description?: string;
}

export interface AiModelList {
  allModels: AiModelInfo[];
  models: AiModelInfo[];
  freeModels: string[];
}

export interface AuditReviewData {
  auditSummary: string | null;
  auditDescription: string | null;
  auditStatus: string | null;
  reviewSummary: string | null;
  reviewDescription: string | null;
  reviewStatus: string | null;
}

export interface AuditScoreResult {
  score: number;
  reasoning: string;
}

export interface IAiProvider {
  analyzeAnswer(
    questionText: string,
    questionType: string,
    responseValue: string | null,
    responseType: string,
    context?: {
      certificateName?: string;
      organizationName?: string;
      sectionName?: string;
    },
  ): Promise<AiAnalysisResult>;

  analyzeAssessment(
    questionsAndAnswers: QuestionAnswerPair[],
    context: {
      certificateName?: string;
      organizationName?: string;
    },
    fileAttachments?: Array<{
      questionId: string;
      filePath: string;
    }>,
  ): Promise<AssessmentAnalysisResult>;

  generateQuestionGuidance(
    questionText: string,
    questionType: string,
    hint?: string | null,
  ): Promise<string[]>;

  listAvailableModels(): Promise<AiModelList>;

  scoreAuditReview(
    auditData: AuditReviewData,
    context: {
      certificateName?: string;
      organizationName?: string;
      assessmentType?: string;
    },
  ): Promise<AuditScoreResult>;
}
