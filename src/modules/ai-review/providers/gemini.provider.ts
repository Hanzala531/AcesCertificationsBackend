import { Injectable, Logger } from '@nestjs/common';
import {
  IAiProvider,
  AiAnalysisResult,
  QuestionAnswerPair,
  AssessmentAnalysisResult,
  AuditReviewData,
  AuditScoreResult,
} from './ai-provider.interface';
import { AiConfigService } from '../../../config/ai.config';

@Injectable()
export class GeminiProvider implements IAiProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private configLogged = false;

  constructor(private aiConfig: AiConfigService) {}

  private normalizeModelName(model: string): string {
    return model.startsWith('models/') ? model.replace('models/', '') : model;
  }

  private logConfigurationOnce(): void {
    if (this.configLogged) return;

    try {
      const rawModel = this.aiConfig.getModel();
      const model = this.normalizeModelName(rawModel);
      const baseUrl =
        this.aiConfig.getBaseUrl() ||
        'https://generativelanguage.googleapis.com/v1beta';

      this.logger.log(
        `[GeminiProvider] Using model: ${model} (raw: ${rawModel})`,
      );
      this.logger.log(`[GeminiProvider] Base URL: ${baseUrl}`);
      this.configLogged = true;
    } catch (error) {
      this.logger.warn('[GeminiProvider] Could not log configuration', error);
    }
  }

  async analyzeAnswer(
    questionText: string,
    questionType: string,
    responseValue: string | null,
    responseType: string,
    context?: {
      certificateName?: string;
      organizationName?: string;
      sectionName?: string;
    },
  ): Promise<AiAnalysisResult> {
    this.logConfigurationOnce();

    try {
      const apiKey = this.aiConfig.getApiKey();
      const model = this.normalizeModelName(this.aiConfig.getModel());
      const baseUrl =
        this.aiConfig.getBaseUrl() ||
        'https://generativelanguage.googleapis.com/v1beta';

      const prompt = this.buildPrompt(
        questionText,
        questionType,
        responseValue,
        responseType,
        context,
      );

      const response = await fetch(
        `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Gemini API error: ${response.status} - ${errorText}`,
        );
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const analysisText =
        data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return this.parseGeminiResponse(analysisText, responseValue);
    } catch (error) {
      this.logger.error('Error calling Gemini API:', error);
      return this.getFallbackAnalysis(responseValue, responseType);
    }
  }

  private buildPrompt(
    questionText: string,
    questionType: string,
    responseValue: string | null,
    responseType: string,
    context?: {
      certificateName?: string;
      organizationName?: string;
      sectionName?: string;
    },
  ): string {
    const contextInfo = context
      ? `\nContext: Certificate: ${context.certificateName || 'N/A'}, Organization: ${context.organizationName || 'N/A'}`
      : '';

    return `You are an AI compliance reviewer checking assessment responses like an exam paper. Be concise and direct.

Question: ${questionText}
Question Type: ${questionType}
Response Type: ${responseType}
Response Value: ${responseValue || 'No response provided'}${contextInfo}

Analyze this response and provide a JSON response with the following structure:
{
  "response": "Brief analysis (max 100 words)",
  "is_flagged": true/false,
  "flag_reason": "Concise reason if flagged, max 200 characters, null otherwise",
  "confidence_score": 0-100,
  "risk_level": "low/medium/high (only if flagged)",
  "category": "Category of issue if flagged (e.g., 'Documentation', 'Compliance', 'Safety'), null otherwise",
  "summary": "Brief one-line summary of the review result (max 150 characters), always required",
  "applicant_answer": "The applicant's answer extracted from the response"
}

IMPORTANT CONSTRAINTS:
- response: Keep it brief and exam-style (max 100 words). Focus on what's wrong or right, not suggestions.
- flag_reason: Must be concise (max 200 characters). State the specific problem clearly.
- summary: Brief one-line summary of the review result (max 150 characters). Always required for every answer, whether flagged or not.
- DO NOT include ai_suggestion field - this is exam checking, not guidance.

Flagging rules:
- Missing, empty, or whitespace-only responses -> FLAG
- Explicit non-compliance or direct contradiction of requirements (for example, clear "no" where compliance is required) -> FLAG
- Responses that are materially incomplete and fail to address the core requirement -> FLAG
- If a response is partially complete or cautious but still provides relevant evidence, do not auto-flag; keep unflagged and lower confidence instead
- Do not flag based only on hedging words (for example: "may", "sometimes", "depends") unless they indicate a real compliance gap

Provide ONLY valid JSON, no additional text.`;
  }

  private parseGeminiResponse(
    responseText: string,
    originalResponse: string | null,
  ): AiAnalysisResult {
    try {
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonText);

      return {
        response: parsed.response || 'Response analyzed',
        is_flagged: parsed.is_flagged === true,
        flag_reason: parsed.flag_reason || null,
        confidence_score: this.adjustConfidenceScore(
          parsed.confidence_score,
          originalResponse,
          'text',
        ),
        risk_level: parsed.risk_level || undefined,
        category: parsed.category || undefined,
        summary: parsed.summary || undefined,
        applicant_answer: parsed.applicant_answer || originalResponse || null,
      };
    } catch (error) {
      this.logger.warn('Failed to parse Gemini JSON response, using fallback');
      return this.getFallbackAnalysis(originalResponse, 'text');
    }
  }

  private adjustConfidenceScore(
    providedScore: number | undefined,
    responseValue: string | null,
    responseType: string,
    questionType?: string,
  ): number {
    if (providedScore === undefined || providedScore === null) {
      if (!responseValue || responseValue.trim().length === 0) {
        return 100;
      }
      return 65;
    }

    let adjustedScore = Math.max(0, Math.min(100, providedScore));
    const rv = responseValue ?? '';
    const normalizedValue = rv.toLowerCase();

    if (!responseValue || rv.trim().length === 0) {
      return 100;
    }

    if (questionType === 'file' && adjustedScore > 85) {
      adjustedScore = Math.min(adjustedScore, 85);
    }

    if (responseType === 'text' || questionType === 'text') {
      const textLength = rv.trim().length;

      if (textLength < 30 && adjustedScore > 75) {
        adjustedScore = Math.min(adjustedScore, 75);
      }

      if (textLength < 60 && adjustedScore > 85) {
        adjustedScore = Math.min(adjustedScore, 85);
      }

      if (textLength < 120 && adjustedScore > 90) {
        adjustedScore = Math.min(adjustedScore, 90);
      }
    }

    if (responseType === 'boolean') {
      const lowerValue = normalizedValue;
      if (lowerValue === 'yes' || lowerValue === 'no') {
        if (lowerValue === 'no' && adjustedScore < 85) {
          adjustedScore = 85;
        }
      } else {
        if (adjustedScore > 80) {
          adjustedScore = Math.min(adjustedScore, 80);
        }
      }
    }

    if (adjustedScore > 95) {
      const hasStrongEvidence =
        !responseValue ||
        rv.trim().length === 0 ||
        (responseType === 'boolean' && normalizedValue === 'no') ||
        normalizedValue.includes('not applicable') ||
        normalizedValue.includes('none');

      if (!hasStrongEvidence && adjustedScore > 95) {
        adjustedScore = Math.min(adjustedScore, 92);
      }
    }

    if (adjustedScore >= 85 && adjustedScore < 95) {
      const vagueIndicators = [
        'may',
        'might',
        'possibly',
        'sometimes',
        'usually',
        'generally',
        'often',
        'typically',
        'depends',
        'varies',
      ];
      const isVague = vagueIndicators.some((indicator) =>
        normalizedValue.includes(indicator),
      );
      if (isVague) {
        adjustedScore = Math.min(adjustedScore, 82);
      }
    }

    return Math.max(0, Math.min(100, adjustedScore));
  }

  private getFallbackAnalysis(
    responseValue: string | null,
    responseType: string,
  ): AiAnalysisResult {
    if (!responseValue) {
      return {
        response: 'No response provided for this question.',
        is_flagged: true,
        flag_reason: 'Missing response',
        confidence_score: 100,
        risk_level: 'high',
        category: 'Missing',
        summary: 'No response provided',
        applicant_answer: null,
      };
    }

    if (responseType === 'boolean' && responseValue.toLowerCase() === 'no') {
      return {
        response: 'Response indicates non-compliance.',
        is_flagged: true,
        flag_reason: 'Negative compliance response',
        confidence_score: 95,
        risk_level: 'high',
        category: 'Compliance',
        summary: 'Non-compliant response detected',
        applicant_answer: responseValue,
      };
    }

    return {
      response: 'Response reviewed and appears compliant.',
      is_flagged: false,
      flag_reason: null,
      confidence_score: 65,
      applicant_answer: responseValue,
    };
  }

  async analyzeAssessment(
    questionsAndAnswers: QuestionAnswerPair[],
    context: {
      certificateName?: string;
      organizationName?: string;
    },
    fileAttachments?: Array<{
      questionId: string;
      filePath: string;
    }>,
  ): Promise<AssessmentAnalysisResult> {
    try {
      const apiKey = this.aiConfig.getApiKey();
      const model = this.normalizeModelName(this.aiConfig.getModel());
      const baseUrl =
        this.aiConfig.getBaseUrl() ||
        'https://generativelanguage.googleapis.com/v1beta';

      const fileDataParts: Array<{
        fileData: { fileUri: string; mimeType: string };
      }> = [];
      if (fileAttachments && fileAttachments.length > 0) {
        this.logger.log(
          `Attempting to upload ${fileAttachments.length} file(s) to Gemini File API...`,
        );

        for (const attachment of fileAttachments) {
          try {
            const fileUri = await this.uploadFileToGemini(
              attachment.filePath,
              apiKey,
              baseUrl,
            );
            const mimeType = this.getMimeTypeFromPath(attachment.filePath);
            fileDataParts.push({
              fileData: {
                fileUri,
                mimeType,
              },
            });
            this.logger.log(
              `Successfully uploaded file ${attachment.filePath} to Gemini, URI: ${fileUri}`,
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            this.logger.warn(
              `Failed to upload file ${attachment.filePath} to Gemini: ${errorMessage}. The AI review will proceed with the document URL in the prompt instead.`,
            );
          }
        }

        if (fileDataParts.length === 0 && fileAttachments.length > 0) {
          const errorMessage = `Failed to upload all ${fileAttachments.length} document(s) to Gemini. Document upload is required for assessment review.`;
          this.logger.error(errorMessage);
          throw new Error(errorMessage);
        } else if (fileDataParts.length < fileAttachments.length) {
          this.logger.warn(
            `Only ${fileDataParts.length} of ${fileAttachments.length} file(s) could be uploaded to Gemini. Some documents failed to upload.`,
          );
        } else {
          this.logger.log(
            `Successfully uploaded ${fileDataParts.length} of ${fileAttachments.length} file(s) to Gemini.`,
          );
        }
      }

      const prompt = this.buildAssessmentPrompt(
        questionsAndAnswers,
        context,
        fileAttachments,
      );

      const parts: Array<
        { text: string } | { fileData: { fileUri: string; mimeType: string } }
      > = [{ text: prompt }, ...fileDataParts];

      const response = await fetch(
        `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts,
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Gemini API error: ${response.status} - ${errorText}`,
        );
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const analysisText =
        data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return this.parseAssessmentResponse(analysisText, questionsAndAnswers);
    } catch (error) {
      this.logger.error('Error calling Gemini API for assessment:', error);
      return this.getFallbackAssessmentAnalysis(questionsAndAnswers);
    }
  }

  private buildAssessmentPrompt(
    questionsAndAnswers: QuestionAnswerPair[],
    context: {
      certificateName?: string;
      organizationName?: string;
    },
    fileAttachments?: Array<{
      questionId: string;
      filePath: string;
    }>,
  ): string {
    const contextInfo = `Certificate: ${context.certificateName || 'N/A'}, Organization: ${context.organizationName || 'N/A'}`;

    const fileAttachmentMap = new Map<string, string>();
    if (fileAttachments) {
      fileAttachments.forEach((fa) => {
        fileAttachmentMap.set(fa.questionId, fa.filePath);
      });
    }

    let questionsText = '';
    const questionsWithDocuments: string[] = [];

    questionsAndAnswers.forEach((qa, index) => {
      const hintText = qa.hint ? `\nHelp Text: ${qa.hint}` : '';
      const scoreInfo =
        qa.score != null
          ? `\nQuestion Score: ${qa.score}`
          : '';
      const aiReviewInfo = qa.aiReviewEnabled
        ? `\nAI Review Criteria: ${qa.aiReviewCriteria || 'No criteria provided'}${
            qa.questionType === 'boolean'
              ? `\nBoolean Scores: yes=${qa.yesScore ?? 'N/A'}, no=${qa.noScore ?? 'N/A'}`
              : `\nAI Review Score: ${qa.aiReviewScore ?? 'N/A'}`
          }`
        : '';
      const sectionInfo = qa.sectionName
        ? `\nSection: ${qa.sectionName}${qa.subSectionName ? ` > ${qa.subSectionName}` : ''}`
        : '';

      const hasDocument = fileAttachmentMap.has(qa.questionId);
      const documentNote = hasDocument
        ? `\n⚠️ DOCUMENT ATTACHED: A document file is attached to this question. You MUST read and evaluate the document content to assess the answer quality, completeness, and correctness. The document contains the actual submission for this question.`
        : '';

      if (hasDocument) {
        questionsWithDocuments.push(
          `Question ${index + 1} (ID: ${qa.questionId})`,
        );
      }

      const optionsText = qa.options && qa.options.length > 0
        ? `\nAvailable Options: ${qa.options.join(', ')}`
        : '';

      questionsText += `\n\nQuestion ${index + 1} (ID: ${qa.questionId}):
Question Text: ${qa.questionText}${hintText}
Question Type: ${qa.questionType}${optionsText}${scoreInfo}${aiReviewInfo}${sectionInfo}
Response Type: ${qa.responseType || 'N/A'}
Response Value: ${qa.responseValue || 'No response provided'}${documentNote}`;
    });

    const documentHeader =
      questionsWithDocuments.length > 0
        ? `\n\n📎 DOCUMENT ATTACHMENTS:\nThe following ${questionsWithDocuments.length} question(s) have document attachments that you MUST read and evaluate:\n${questionsWithDocuments.map((q, i) => `  ${i + 1}. ${q}`).join('\n')}\n\nIMPORTANT: For questions with document attachments, you MUST:\n- Read the entire document content\n- Evaluate the document against the question requirements\n- Assess completeness, accuracy, and compliance based on the document content\n- Do NOT rely solely on the response_value field - the document IS the answer\n`
        : '';

    return `You are an AI compliance reviewer checking assessment responses like an exam paper. Be concise and direct. Apply balanced, evidence-based judgement.

Context: ${contextInfo}${documentHeader}

ASSESSMENT QUESTIONS AND ANSWERS:
${questionsText}

Analyze ALL questions and responses above with balanced compliance standards. Provide a JSON response with the following structure:
{
  "${questionsAndAnswers[0].questionId}": {
    "response": "Brief analysis (max 100 words) - exam-style checking, not guidance",
    "is_flagged": true/false,
    "flag_reason": "Concise reason if flagged (max 200 characters), null if not flagged",
    "confidence_score": 0-100,  // MUST VARY based on your certainty (DO NOT default to 85)
    "risk_level": "low/medium/high (only if flagged, null otherwise)",
    "category": "Category of issue if flagged (e.g., 'Documentation', 'Compliance', 'Process'), null otherwise",
    "summary": "Brief one-line summary of the review result (max 150 characters), always required",
    "applicant_answer": "The applicant's answer extracted from the response_value field"
  },
  "${questionsAndAnswers[1]?.questionId || ''}": { ... },
  ...
}

IMPORTANT JSON REQUIREMENTS:
- confidence_score MUST vary between questions (DO NOT use the same value for all)
- response: Keep brief and exam-style (max 100 words). Focus on what's wrong or right, not suggestions.
- flag_reason: Must be concise (max 200 characters). State the specific problem clearly.
- summary: Brief one-line summary of the review result (max 150 characters). Always required for every answer, whether flagged or not.
- DO NOT include ai_suggestion field - this is exam checking, not guidance.
- flag_reason MUST explain the specific problem if flagged
- applicant_answer MUST be extracted from the response_value provided

BALANCED COMPLIANCE RULES:

1. **MANDATORY FLAGS:**
  - Missing, empty, null, or whitespace-only responses
  - Explicit non-compliance with the requirement (for example: clear "no" where compliance is required)
  - Responses that materially contradict the question requirements or provided evidence
  - Responses that fail to address the core requirement at all

2. **MATERIAL RISK INDICATORS (FLAG WHEN MATERIAL):**
  - Indications of significant gaps: "not compliant", "not implemented", "missing evidence", "not verified", "pending critical control"
  - Repeated or major incompleteness that prevents confidence in compliance
  - High-impact process weaknesses that create a clear compliance risk
  - Contradictions between response content and claimed compliance

  **IMPORTANT:**
  - Do not auto-flag only because the response contains words like "however", "may", "sometimes", "depends", or "partially".
  - Flag only when those terms indicate a real, material compliance gap.

3. **QUALITY STANDARDS (FLAG IF):**
  - The answer is too brief or unclear to assess core compliance
  - The response meaningfully misses required evidence or key controls
  - There is a clear mismatch with certification requirements
  - There are major inconsistencies between related answers

4. **COMPLIANCE VIOLATIONS (FLAG IF):**
   - Any indication of non-compliance with requirements
   - Responses suggesting shortcuts, workarounds, or incomplete implementations
   - Missing documentation, evidence, or proof where required
   - Unclear explanations that don't convincingly demonstrate full compliance

5. **EVALUATION CRITERIA:**
  - Help text/hint represents expected requirements; evaluate whether intent is substantially met
  - For partially compliant responses with minor gaps, prefer lower confidence and concise feedback instead of automatic flagging
  - When evidence is mixed or uncertain, use moderate confidence; flag only if risk is material
   - Assess risk: "high" for critical issues, "medium" for significant concerns, "low" for minor issues

CRITICAL REQUIREMENTS:
- Provide analysis for EVERY question ID listed above
- Use exact question IDs as keys in your JSON response
- Do not flag solely for cautious wording or minor ambiguity if the core requirement is still met
- Set risk_level appropriately: "high" for critical, "medium" for significant, "low" for minor
- **Confidence scoring (0-100) based on evidence and certainty:**
  * 90-100: Very high certainty with clear evidence
  * 75-89: High certainty with mostly clear evidence and minor ambiguity
  * 60-74: Moderate certainty with mixed evidence
  * 40-59: Low certainty due to limited detail or ambiguity
  * 20-39: Very low certainty with minimal reliable evidence
  * 0-19: Minimal certainty when the response is largely unusable

  **SCORING RULES:**
  - Vary confidence scores by question; do not default to one score
  - Avoid very high scores when evidence is weak, brief, or highly ambiguous
  - Document-based questions without clear document analysis should usually be in the 55-80 range
  - Text responses requiring interpretation are often in the 60-88 range
  - Use 90+ only when evidence is strong and explicit
- Keep all responses concise and exam-style - this is checking, not providing guidance
- Extract applicant_answer from response_value field
- Keep evaluations fair and consistent; do not over-penalize minor wording issues

Provide ONLY valid JSON, no additional text or markdown formatting.`;
  }

  private parseAssessmentResponse(
    responseText: string,
    questionsAndAnswers: QuestionAnswerPair[],
  ): AssessmentAnalysisResult {
    try {
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonText) as Record<
        string,
        Partial<AiAnalysisResult>
      >;

      const result: AssessmentAnalysisResult = {};

      for (const qa of questionsAndAnswers) {
        const analysis = parsed[qa.questionId];
        if (analysis) {
          result[qa.questionId] = {
            response: analysis.response || 'Response analyzed',
            is_flagged: analysis.is_flagged === true,
            flag_reason: analysis.flag_reason || null,
            confidence_score: this.adjustConfidenceScore(
              analysis.confidence_score,
              qa.responseValue,
              qa.responseType || 'text',
              qa.questionType,
            ),
            risk_level: analysis.risk_level || undefined,
            category: analysis.category || undefined,
            summary: analysis.summary || undefined,
            applicant_answer:
              analysis.applicant_answer || qa.responseValue || null,
          };
        } else {
          result[qa.questionId] = this.getFallbackAnalysis(
            qa.responseValue,
            qa.responseType || 'text',
          );
        }
      }

      return result;
    } catch (error) {
      this.logger.warn(
        'Failed to parse Gemini assessment JSON response, using fallback',
      );
      return this.getFallbackAssessmentAnalysis(questionsAndAnswers);
    }
  }

  private getFallbackAssessmentAnalysis(
    questionsAndAnswers: QuestionAnswerPair[],
  ): AssessmentAnalysisResult {
    const result: AssessmentAnalysisResult = {};
    for (const qa of questionsAndAnswers) {
      result[qa.questionId] = this.getFallbackAnalysis(
        qa.responseValue,
        qa.responseType || 'text',
      );
    }
    return result;
  }

  async generateQuestionGuidance(
    questionText: string,
    questionType: string,
    hint?: string | null,
  ): Promise<string[]> {
    try {
      const apiKey = this.aiConfig.getApiKey();
      const model = this.normalizeModelName(this.aiConfig.getModel());
      const baseUrl =
        this.aiConfig.getBaseUrl() ||
        'https://generativelanguage.googleapis.com/v1beta';

      const prompt = this.buildGuidancePrompt(questionText, questionType, hint);

      const response = await fetch(
        `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Gemini API error for guidance: ${response.status} - ${errorText}`,
        );
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const guidanceText =
        data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return this.parseGuidanceResponse(guidanceText);
    } catch (error) {
      this.logger.error('Error generating question guidance:', error);
      return this.getFallbackGuidance(questionType);
    }
  }

  private buildGuidancePrompt(
    questionText: string,
    questionType: string,
    hint?: string | null,
  ): string {
    const hintSection = hint ? `\n\nHint/Criteria: ${hint}` : '';

    return `You are a helpful guidance assistant. Your role is to provide neutral, reusable guidance suggestions for answering a certification question.

Question: ${questionText}
Question Type: ${questionType}${hintSection}

Generate exactly 3 guidance suggestions that help users think about how to approach this question. These suggestions must be:

1. **Guidance-oriented**: Focus on aspects to consider, approaches to take, or things to think about
2. **Neutral and generic**: Not personalized, not dependent on any specific user, organization, or assessment context
3. **Not direct answers**: Do NOT provide finalized responses or complete answers
4. **Reusable**: Should be helpful for anyone answering this question
5. **Concise**: Each suggestion should be 1-2 sentences (50-100 words max)

CRITICAL CONSTRAINTS:
- DO NOT provide full answers or completed responses
- DO NOT personalize suggestions to any user or organization
- DO NOT reference any assessment, scoring, or compliance outcomes
- DO NOT mention specific companies, names, or personal information
- Focus on guiding the user's thinking process

Provide your response as a JSON array with exactly 3 strings:
["Suggestion 1", "Suggestion 2", "Suggestion 3"]

Return ONLY valid JSON, no additional text or markdown formatting.`;
  }

  private parseGuidanceResponse(responseText: string): string[] {
    try {
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const suggestions = JSON.parse(jsonText) as string[];

      if (Array.isArray(suggestions) && suggestions.length === 3) {
        return suggestions
          .slice(0, 3)
          .map((s) => s.trim())
          .filter((s) => s);
      }

      this.logger.warn(
        `Expected 3 suggestions, got ${suggestions?.length || 0}. Using fallback.`,
      );
      return this.getFallbackGuidance('text');
    } catch (error) {
      this.logger.warn(
        'Failed to parse guidance JSON response, using fallback',
        error,
      );
      return this.getFallbackGuidance('text');
    }
  }

  private getFallbackGuidance(questionType: string): string[] {
    if (questionType === 'boolean') {
      return [
        'Consider the specific requirements and criteria that determine a yes or no answer.',
        'Think about any edge cases or exceptions that might apply to your situation.',
        'Review relevant documentation or evidence that supports your response.',
      ];
    }

    return [
      'Consider the key aspects or components that this question is asking about.',
      'Think about what specific details, examples, or evidence would help answer this question.',
      'Review any relevant documentation, processes, or standards that apply to this topic.',
    ];
  }

  private async uploadFileToGemini(
    filePath: string,
    apiKey: string,
    baseUrl: string,
  ): Promise<string> {
    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = filePath.split(/[/\\]/).pop() || 'document';
    const mimeType = this.getMimeTypeFromPath(filePath);

    const boundary = `----formdata-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const parts: Buffer[] = [];

    const metadata = {
      file: {
        displayName: fileName,
      },
    };
    const metadataJson = JSON.stringify(metadata);
    const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataJson}\r\n`;
    parts.push(Buffer.from(metadataPart, 'utf-8'));

    const filePart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
    parts.push(Buffer.from(filePart, 'utf-8'));
    parts.push(fileBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'));

    const multipartBuffer = Buffer.concat(parts);

    this.logger.debug(
      `Uploading file to Gemini: ${fileName} (${fileBuffer.length} bytes, MIME: ${mimeType})`,
    );

    let uploadUrl: string;
    if (baseUrl.includes('/v1beta')) {
      uploadUrl = baseUrl.replace('/v1beta', '/upload/v1beta/files');
    } else if (baseUrl.includes('generativelanguage.googleapis.com')) {
      uploadUrl =
        'https://generativelanguage.googleapis.com/upload/v1beta/files';
    } else {
      const urlObj = new URL(baseUrl);
      uploadUrl = `${urlObj.protocol}//${urlObj.host}/upload/v1beta/files`;
    }
    uploadUrl = `${uploadUrl}?key=${apiKey}`;

    this.logger.debug(`Uploading to: ${uploadUrl}`);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'X-Goog-Upload-Protocol': 'multipart',
      },
      body: multipartBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      this.logger.error(
        `Gemini file upload failed: ${uploadResponse.status} - ${errorText}`,
      );
      throw new Error(
        `Failed to upload file to Gemini: ${uploadResponse.status} - ${errorText}`,
      );
    }

    let uploadData: any;
    try {
      const responseText = await uploadResponse.text();
      this.logger.debug(
        `Gemini file upload raw response (${uploadResponse.status}): ${responseText.substring(0, 500)}`,
      );

      uploadData = JSON.parse(responseText);
    } catch (parseError) {
      this.logger.error(
        `Failed to parse Gemini upload response as JSON:`,
        parseError,
      );
      throw new Error(
        `Failed to parse Gemini file upload response. Status: ${uploadResponse.status}`,
      );
    }

    this.logger.debug(
      `Gemini file upload parsed response: ${JSON.stringify(uploadData, null, 2)}`,
    );

    let fileUri: string | null = null;

    if (uploadData.file?.uri) {
      fileUri = uploadData.file.uri;
    } else if (uploadData.uri) {
      fileUri = uploadData.uri;
    } else if (uploadData.name) {
      fileUri = uploadData.name;
    } else if (typeof uploadData.file === 'string') {
      fileUri = uploadData.file;
    } else if (uploadData.file?.name) {
      fileUri = uploadData.file.name;
    }

    if (!fileUri) {
      this.logger.error(
        `No URI found in Gemini upload response. Full response structure: ${JSON.stringify(uploadData, null, 2)}`,
      );
      throw new Error(
        `File upload succeeded but no URI returned. Response structure: ${JSON.stringify(uploadData)}`,
      );
    }

    if (!fileUri.startsWith('http') && !fileUri.startsWith('files/')) {
      if (fileUri.includes('/')) {
      } else {
        fileUri = `files/${fileUri}`;
      }
    }

    this.logger.debug(`File uploaded successfully, URI: ${fileUri}`);

    await this.waitForFileProcessing(fileUri, apiKey, baseUrl);

    return fileUri;
  }

  private async waitForFileProcessing(
    fileUri: string,
    apiKey: string,
    baseUrl: string,
    maxAttempts: number = 10,
  ): Promise<void> {
    const statusUrl = fileUri.startsWith('http')
      ? `${fileUri}?key=${apiKey}`
      : `${baseUrl}/${fileUri}?key=${apiKey}`;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const statusResponse = await fetch(statusUrl, {
          method: 'GET',
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          this.logger.debug(
            `File processing status (attempt ${attempt + 1}/${maxAttempts}): ${JSON.stringify(statusData)}`,
          );

          const state =
            statusData.file?.state ||
            statusData.state ||
            (statusData.file && typeof statusData.file === 'object'
              ? statusData.file.state
              : null);

          if (state === 'ACTIVE' || state === 'PROCESSING_COMPLETE') {
            this.logger.debug(`File processing completed: ${fileUri}`);
            return;
          }
          if (state === 'FAILED' || state === 'PROCESSING_FAILED') {
            throw new Error(
              `File processing failed in Gemini. State: ${state}`,
            );
          }
        } else {
          this.logger.warn(
            `File status check failed: ${statusResponse.status} - ${await statusResponse.text()}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Error checking file status (attempt ${attempt + 1}):`,
          error,
        );
      }

      const waitTime = Math.min(1000 * Math.pow(1.5, attempt), 5000);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.logger.warn(
      `File processing timeout for ${fileUri}. Proceeding anyway - file may still be processing.`,
    );
  }

  private getMimeTypeFromPath(filePath: string): string {
    const extension = filePath.toLowerCase().split('.').pop() || '';
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  private async callGemini(prompt: string): Promise<string> {
    const apiKey = this.aiConfig.getApiKey();
    const model = this.normalizeModelName(this.aiConfig.getModel());
    const baseUrl =
      this.aiConfig.getBaseUrl() ||
      'https://generativelanguage.googleapis.com/v1beta';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(
        `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              topP: 0.9,
              maxOutputTokens: 4096,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Gemini API error: ${response.status} - ${errorText}`,
        );
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } finally {
      clearTimeout(timeout);
    }
  }

  async listAvailableModels(): Promise<{
    allModels: Array<{
      name: string;
      displayName: string;
      supportedGenerationMethods: string[];
      description?: string;
    }>;
    models: Array<{
      name: string;
      displayName: string;
      supportedGenerationMethods: string[];
      description?: string;
    }>;
    freeModels: string[];
  }> {
    try {
      const apiKey = this.aiConfig.getApiKey();
      const baseUrl =
        this.aiConfig.getBaseUrl() ||
        'https://generativelanguage.googleapis.com/v1beta';

      const response = await fetch(`${baseUrl}/models?key=${apiKey}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Gemini API error listing models: ${response.status} - ${errorText}`,
        );
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const allModels = data?.models || [];

      this.logger.log(
        `[GeminiProvider] Total models returned by API: ${allModels.length}`,
      );

      allModels.forEach((model: any) => {
        this.logger.debug(
          `[GeminiProvider] Model: ${model.name} | Display: ${model.displayName || 'N/A'} | Methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`,
        );
      });

      const supportedModels = allModels
        .filter((model: any) =>
          model.supportedGenerationMethods?.includes('generateContent'),
        )
        .map((model: any) => ({
          name: model.name,
          displayName: model.displayName || model.name,
          supportedGenerationMethods: model.supportedGenerationMethods || [],
          description: model.description,
        }));

      const freeModels = supportedModels
        .filter(
          (model: any) =>
            model.name.toLowerCase().includes('flash') ||
            model.name.toLowerCase().includes('gemini-1.5-flash'),
        )
        .map((model: any) => model.name);

      this.logger.log(
        `[GeminiProvider] Found ${supportedModels.length} models supporting generateContent`,
      );
      this.logger.log(
        `[GeminiProvider] Supported models: ${supportedModels.map((m) => m.name).join(', ')}`,
      );
      this.logger.log(
        `[GeminiProvider] Free-tier models: ${freeModels.length > 0 ? freeModels.join(', ') : 'None identified'}`,
      );

      return {
        allModels: allModels.map((model: any) => ({
          name: model.name,
          displayName: model.displayName || model.name,
          supportedGenerationMethods: model.supportedGenerationMethods || [],
          description: model.description,
        })),
        models: supportedModels,
        freeModels,
      };
    } catch (error) {
      this.logger.error('Error listing available Gemini models:', error);
      throw error;
    }
  }

  async scoreAuditReview(
    auditData: AuditReviewData,
    context: {
      certificateName?: string;
      organizationName?: string;
      assessmentType?: string;
    },
  ): Promise<AuditScoreResult> {
    const prompt = `You are an AI scoring engine for compliance audit reviews. Based on the auditor's and reviewer's complete assessments, provide a numerical compliance score.

Context:
- Certificate: ${context.certificateName || 'N/A'}
- Organization: ${context.organizationName || 'N/A'}
- Assessment Type: ${context.assessmentType || 'N/A'}

AUDITOR'S ASSESSMENT:
- Status: ${auditData.auditStatus || 'Not provided'}
- Summary: ${auditData.auditSummary || 'Not provided'}
- Description: ${auditData.auditDescription || 'Not provided'}

REVIEWER'S ASSESSMENT:
- Status: ${auditData.reviewStatus || 'Not provided'}
- Summary: ${auditData.reviewSummary || 'Not provided'}
- Description: ${auditData.reviewDescription || 'Not provided'}

SCORING RULES:
- Score range: 0-100
- If BOTH auditor and reviewer approve: base score 80-100
- If ONE approves and ONE conditionally approves: base score 65-85
- If BOTH conditionally approve: base score 50-75
- If EITHER rejects: base score 0-40
- Adjust based on quality/depth of summaries and descriptions
- Higher scores for detailed, specific, evidence-based reviews
- Lower scores for vague, incomplete, or contradictory reviews

Return ONLY valid JSON:
{
  "score": <number 0-100>,
  "reasoning": "<2-3 sentence explanation of the score>"
}`;

    const responseText = await this.callGemini(prompt);

    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const reasoning =
      typeof parsed.reasoning === 'string'
        ? parsed.reasoning
        : 'AI scoring completed.';

    return { score, reasoning };
  }
}
