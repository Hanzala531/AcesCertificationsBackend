import { Injectable, Logger } from '@nestjs/common';
import {
  IAiProvider,
  AiAnalysisResult,
  QuestionAnswerPair,
  AssessmentAnalysisResult,
  AiModelList,
  AuditReviewData,
  AuditScoreResult,
} from './ai-provider.interface';
import { AiConfigService } from '../../../config/ai.config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OpenAIProvider implements IAiProvider {
  private readonly logger = new Logger(OpenAIProvider.name);

  constructor(private aiConfig: AiConfigService) {}

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
    try {
      const apiKey = this.aiConfig.getApiKey();
      const model = this.aiConfig.getModel();
      const baseUrl = this.aiConfig.getBaseUrl() || 'https://api.openai.com/v1';

      const prompt = this.buildPrompt(
        questionText,
        questionType,
        responseValue,
        responseType,
        context,
      );

      // Use Responses API for gpt-4o-family models, otherwise use Chat Completions
      const useResponsesApi = model && model.toLowerCase().startsWith('gpt-4o');

      const fetchUrl = useResponsesApi
        ? `${baseUrl}/responses`
        : `${baseUrl}/chat/completions`;

      const bodyPayload = useResponsesApi
        ? JSON.stringify({ model, input: prompt, temperature: 0.3 })
        : JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are an AI compliance reviewer. Analyze assessment responses and provide structured JSON analysis.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3,
          });

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: useResponsesApi
          ? JSON.stringify({ model, input: prompt, temperature: 0.3 })
          : bodyPayload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `OpenAI API error: ${response.status} - ${errorText}`,
        );
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      // Normalize response extraction for both APIs
      const analysisText =
        data.choices?.[0]?.message?.content ||
        data.output?.[0]?.content?.[0]?.text ||
        (data.output_text as string) ||
        '';

      return this.parseOpenAIResponse(analysisText, responseValue);
    } catch (error) {
      this.logger.error('Error calling OpenAI API:', error);
      return this.getFallbackAnalysis(responseValue, responseType);
    }
  }

  private loadPromptTemplate(templateName: string): string | null {
    try {
      const isProduction =
        process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

      // In local/dev, prefer source templates so prompt edits apply immediately.
      if (!isProduction) {
        const srcPath = path.join(
          process.cwd(),
          'src',
          'templates',
          'ai',
          `${templateName}.prompt.txt`,
        );
        if (fs.existsSync(srcPath)) {
          return fs.readFileSync(srcPath, 'utf8');
        }
      }

      const distPath = path.join(
        process.cwd(),
        'dist',
        'templates',
        'ai',
        `${templateName}.prompt.txt`,
      );
      if (fs.existsSync(distPath)) {
        return fs.readFileSync(distPath, 'utf8');
      }

      return null;
    } catch {
      return null;
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

    const template = this.loadPromptTemplate('analyze-answer');
    if (!template) {
      throw new Error(
        'AI prompt template "analyze-answer" could not be loaded',
      );
    }

    return template
      .replace('{{QUESTION_TEXT}}', questionText)
      .replace('{{QUESTION_TYPE}}', questionType)
      .replace('{{RESPONSE_TYPE}}', responseType)
      .replace('{{RESPONSE_VALUE}}', responseValue || 'No response provided')
      .replace('{{CONTEXT_INFO}}', contextInfo);
  }

  private parseOpenAIResponse(
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
      this.logger.warn('Failed to parse OpenAI JSON response, using fallback');
      return this.getFallbackAnalysis(originalResponse, 'text');
    }
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
      // For file questions, do not force 100 when file is present; allow provided score to stand
      if (questionType === 'file') {
        // fall through and use provided adjustedScore
      } else {
        return 100;
      }
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
      const lowerValue = rv.toLowerCase();
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
      const model = this.aiConfig.getModel();
      const baseUrl = this.aiConfig.getBaseUrl() || 'https://api.openai.com/v1';

      const prompt = this.buildAssessmentPrompt(
        questionsAndAnswers,
        context,
        fileAttachments,
      );

      const modelIsGpt4o = model && model.toLowerCase().startsWith('gpt-4o');
      const useResponsesApiForAssessment =
        modelIsGpt4o || (fileAttachments && fileAttachments.length > 0);

      let vectorStoreId: string | undefined = undefined;
      if (fileAttachments && fileAttachments.length > 0) {
        const uploadedFileIds: string[] = [];
        for (const fa of fileAttachments) {
          try {
            const fileId = await this.uploadFileToOpenAI(
              fa.filePath,
              apiKey,
              baseUrl,
            );
            uploadedFileIds.push(fileId);
          } catch (err) {
            this.logger.warn(
              `File upload error for ${fa.filePath}: ${String(err)}`,
            );
          }
        }

        if (uploadedFileIds.length === 0) {
          throw new Error(
            `Failed to upload ${fileAttachments.length} document(s) to OpenAI for file_search.`,
          );
        }

        vectorStoreId = await this.createVectorStore(apiKey, baseUrl);

        for (const fileId of uploadedFileIds) {
          try {
            await this.attachFileToVectorStore(
              vectorStoreId,
              fileId,
              apiKey,
              baseUrl,
            );
          } catch (err) {
            this.logger.warn(
              `Failed to attach file ${fileId} to vector store ${vectorStoreId}: ${String(err)}`,
            );
          }
        }
      }

      // Call Responses API when appropriate
      const fetchUrl = useResponsesApiForAssessment
        ? `${baseUrl}/responses`
        : `${baseUrl}/chat/completions`;

      const requestBody = useResponsesApiForAssessment
        ? JSON.stringify({
            model,
            input: prompt,
            temperature: 0.3,
            tools: vectorStoreId
              ? [
                  {
                    type: 'file_search',
                    vector_store_ids: [vectorStoreId],
                  },
                ]
              : undefined,
          })
        : JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are an AI compliance reviewer. Analyze entire assessment submissions and provide structured JSON analysis for all questions.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.3,
          });

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `OpenAI API error: ${response.status} - ${errorText}`,
        );
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();

      const analysisText = this.extractResponsesText(data);
      if (!analysisText) {
        const dataPreview = JSON.stringify(data).substring(0, 2000);
        this.logger.warn(
          `OpenAI assessment response contained no text output. Response preview: ${dataPreview}`,
        );
      }

      return this.parseAssessmentResponse(analysisText, questionsAndAnswers);
    } catch (error) {
      this.logger.error('Error calling OpenAI API for assessment:', error);
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
      let documentNote = '';
      if (hasDocument) {
        documentNote = `\n⚠️ NOTE: A document file was submitted for this question. Use the file_search tool to read the document content and evaluate it.`;
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
        ? `\n\n📎 NOTE: ${questionsWithDocuments.length} question(s) have document attachments. Use the file_search tool to read and evaluate them.\n`
        : '';

    const template = this.loadPromptTemplate('analyze-assessment');
    if (!template) {
      throw new Error(
        'AI prompt template "analyze-assessment" could not be loaded',
      );
    }

    return template
      .replace('{{CONTEXT_INFO}}', contextInfo)
      .replace('{{DOCUMENT_HEADER}}', documentHeader)
      .replace('{{QUESTIONS_TEXT}}', questionsText)
      .replace('{{FIRST_QUESTION_ID}}', questionsAndAnswers[0].questionId)
      .replace(
        '{{SECOND_QUESTION_ID}}',
        questionsAndAnswers[1]?.questionId || '',
      );
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

      let parsed = JSON.parse(jsonText);
      // Handle cases where the API returns a JSON-encoded string inside the response
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch (e) {
          // leave as-is if double-parse fails
        }
      }

      // If parsed is not an object containing question keys, attempt to extract a JSON substring
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        const match = jsonText.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            parsed = JSON.parse(match[0]);
          } catch (e) {
            // fall through to final fallback
          }
        }
      }

      parsed = parsed as Record<string, Partial<AiAnalysisResult>>;

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
      const preview = responseText
        ? responseText.substring(0, 2000)
        : '<empty>';
      this.logger.warn(
        `Failed to parse OpenAI assessment JSON response, using fallback. Response preview: ${preview}`,
      );
      return this.getFallbackAssessmentAnalysis(questionsAndAnswers);
    }
  }

  private extractResponsesText(data: any): string {
    if (!data) return '';
    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      return data.output_text;
    }

    const output = Array.isArray(data.output) ? data.output : [];
    for (const item of output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        for (const content of item.content) {
          if (
            content?.type === 'output_text' &&
            typeof content.text === 'string'
          ) {
            if (content.text.trim()) return content.text;
          }
          if (content?.type === 'text' && typeof content.text === 'string') {
            if (content.text.trim()) return content.text;
          }
        }
      }
      if (item?.type === 'output_text' && typeof item?.text === 'string') {
        if (item.text.trim()) return item.text;
      }
      if (item?.content?.[0]?.text) {
        const text = item.content[0].text;
        if (typeof text === 'string' && text.trim()) return text;
      }
    }

    return data.choices?.[0]?.message?.content || '';
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

  private async uploadFileToOpenAI(
    filePath: string,
    apiKey: string,
    baseUrl: string,
  ): Promise<string> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found for upload: ${filePath}`);
    }

    if (typeof FormData === 'undefined' || typeof Blob === 'undefined') {
      throw new Error(
        'FormData/Blob not available in this runtime. Upgrade Node or provide a fetch implementation that supports multipart/form-data.',
      );
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = filePath.split(/[/\\]/).pop() || 'document';
    const mimeType = this.getMimeTypeFromPath(filePath);

    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    form.append('file', blob, fileName);
    form.append('purpose', 'user_data');

    const response = await fetch(`${baseUrl}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI file upload failed: ${response.status} - ${errorText}`,
      );
    }

    const data = await response.json();
    if (!data?.id) {
      throw new Error(`OpenAI file upload missing id: ${JSON.stringify(data)}`);
    }

    return data.id as string;
  }

  private async createVectorStore(
    apiKey: string,
    baseUrl: string,
  ): Promise<string> {
    const response = await fetch(`${baseUrl}/vector_stores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        name: `ai-review-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI vector store create failed: ${response.status} - ${errorText}`,
      );
    }

    const data = await response.json();
    if (!data?.id) {
      throw new Error(
        `OpenAI vector store create missing id: ${JSON.stringify(data)}`,
      );
    }

    return data.id as string;
  }

  private async attachFileToVectorStore(
    vectorStoreId: string,
    fileId: string,
    apiKey: string,
    baseUrl: string,
  ): Promise<void> {
    const response = await fetch(
      `${baseUrl}/vector_stores/${vectorStoreId}/files`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({ file_id: fileId }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI vector store attach failed: ${response.status} - ${errorText}`,
      );
    }
  }

  async generateQuestionGuidance(
    questionText: string,
    questionType: string,
    hint?: string | null,
  ): Promise<string[]> {
    try {
      const apiKey = this.aiConfig.getApiKey();
      const model = this.aiConfig.getModel();
      const baseUrl = this.aiConfig.getBaseUrl() || 'https://api.openai.com/v1';

      const prompt = this.buildGuidancePrompt(questionText, questionType, hint);

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful guidance assistant that provides neutral, reusable guidance suggestions for answering certification questions.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `OpenAI API error for guidance: ${response.status} - ${errorText}`,
        );
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const guidanceText = data.choices?.[0]?.message?.content || '';

      return this.parseGuidanceResponse(guidanceText);
    } catch (error) {
      this.logger.error('Error generating question guidance:', error);
      return this.getFallbackGuidance(questionType);
    }
  }

  async listAvailableModels(): Promise<AiModelList> {
    try {
      const apiKey = this.aiConfig.getApiKey();
      const baseUrl = this.aiConfig.getBaseUrl() || 'https://api.openai.com/v1';

      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `OpenAI API error listing models: ${response.status} - ${errorText}`,
        );
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const allModels = (data?.data || []) as Array<{
        id: string;
        owned_by?: string;
      }>;

      const mappedModels = allModels.map((model) => ({
        name: model.id,
        displayName: model.id,
        supportedGenerationMethods: ['chat.completions'],
        description: model.owned_by ? `owned_by: ${model.owned_by}` : undefined,
      }));

      const supportedModels = mappedModels.filter((model) => {
        const name = model.name.toLowerCase();
        return (
          name.includes('gpt') || name.startsWith('o1') || name.startsWith('o3')
        );
      });

      return {
        allModels: mappedModels,
        models: supportedModels,
        freeModels: [],
      };
    } catch (error) {
      this.logger.error('Error listing available OpenAI models:', error);
      throw error;
    }
  }

  private buildGuidancePrompt(
    questionText: string,
    questionType: string,
    hint?: string | null,
  ): string {
    const hintSection = hint ? `\n\nHint/Criteria: ${hint}` : '';

    const template = this.loadPromptTemplate('question-guidance');
    if (!template) {
      throw new Error(
        'AI prompt template "question-guidance" could not be loaded',
      );
    }

    return template
      .replace('{{QUESTION_TEXT}}', questionText)
      .replace('{{QUESTION_TYPE}}', questionType)
      .replace('{{HINT_SECTION}}', hintSection);
  }

  private parseGuidanceResponse(responseText: string): string[] {
    try {
      let jsonText = responseText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(jsonText);
      const suggestions = parsed.suggestions || parsed;

      if (Array.isArray(suggestions) && suggestions.length >= 3) {
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

  async scoreAuditReview(
    auditData: AuditReviewData,
    context: {
      certificateName?: string;
      organizationName?: string;
      assessmentType?: string;
    },
  ): Promise<AuditScoreResult> {
    const apiKey = this.aiConfig.getApiKey();
    const model = this.aiConfig.getModel();
    const baseUrl = this.aiConfig.getBaseUrl() || 'https://api.openai.com/v1';

    const prompt = this.buildAuditScorePrompt(auditData, context);

    const useResponsesApi = model && model.toLowerCase().startsWith('gpt-4o');

    const fetchUrl = useResponsesApi
      ? `${baseUrl}/responses`
      : `${baseUrl}/chat/completions`;

    const bodyPayload = useResponsesApi
      ? JSON.stringify({ model, input: prompt, temperature: 0.3 })
      : JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        });

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: bodyPayload,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `OpenAI API error scoring audit review: ${response.status} - ${errorText}`,
      );
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();

    let responseText: string;
    if (useResponsesApi) {
      responseText =
        data.output
          ?.filter((item: { type: string }) => item.type === 'message')
          ?.flatMap((item: { content: { text: string }[] }) =>
            item.content?.map((c: { text: string }) => c.text),
          )
          ?.join('') || '';
    } else {
      responseText = data.choices?.[0]?.message?.content || '';
    }

    return this.parseAuditScoreResponse(responseText);
  }

  private buildAuditScorePrompt(
    auditData: AuditReviewData,
    context: {
      certificateName?: string;
      organizationName?: string;
      assessmentType?: string;
    },
  ): string {
    const template = this.loadPromptTemplate('audit-score');
    if (!template) {
      throw new Error('AI prompt template "audit-score" could not be loaded');
    }

    return template
      .replace('{{CERTIFICATE}}', context.certificateName || 'N/A')
      .replace('{{ORGANIZATION}}', context.organizationName || 'N/A')
      .replace('{{ASSESSMENT_TYPE}}', context.assessmentType || 'N/A')
      .replace('{{AUDIT_STATUS}}', auditData.auditStatus || 'Not provided')
      .replace('{{AUDIT_SUMMARY}}', auditData.auditSummary || 'Not provided')
      .replace(
        '{{AUDIT_DESCRIPTION}}',
        auditData.auditDescription || 'Not provided',
      )
      .replace('{{REVIEW_STATUS}}', auditData.reviewStatus || 'Not provided')
      .replace('{{REVIEW_SUMMARY}}', auditData.reviewSummary || 'Not provided')
      .replace(
        '{{REVIEW_DESCRIPTION}}',
        auditData.reviewDescription || 'Not provided',
      );
  }

  private parseAuditScoreResponse(responseText: string): AuditScoreResult {
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
