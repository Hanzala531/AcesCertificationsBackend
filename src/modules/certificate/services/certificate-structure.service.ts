import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { CertificateRepository } from '../certificate.repository';
import { CreateMainSectionsDto } from '../dto/create-main-sections.dto';
import { CreateSubsectionsDto } from '../dto/create-subsections.dto';
import {
  AddQuestionsDto,
  QuestionItemDto,
  SubQuestionItemDto,
} from '../dto/add-questions.dto';
import { BulkAddQuestionsDto } from '../dto/bulk-add-questions.dto';
import { UpdateMainSectionDto } from '../dto/update-main-section.dto';
import { UpdateSectionDto } from '../dto/update-section.dto';
import { UpdateSubsectionDto } from '../dto/update-subsection.dto';
import {
  UpdateQuestionDto,
  UpdateNestedQuestionDto,
} from '../dto/update-question.dto';
import {
  ReorderItemDto,
  ReorderItemType,
  ReorderParentType,
  ReorderOperationType,
} from '../dto/reorder-item.dto';
import {
  ConditionalTargetType,
  ParentType,
  QuestionConditionalLogic,
  SectionType,
  CreatedSection,
  CreatedQuestion,
  QuestionType,
} from '../types/certificate.types';
import { handleDatabaseError } from '../utils/database-error.util';

@Injectable()
export class CertificateStructureService {
  constructor(private readonly certificateRepo: CertificateRepository) {}

  private isBlank(value: string | null | undefined): boolean {
    return value === undefined || value === null || value.trim() === '';
  }

  private getEffectiveQuestionConfig(
    dto: Partial<QuestionItemDto | SubQuestionItemDto | UpdateQuestionDto | UpdateNestedQuestionDto>,
    existing?: {
      type?: QuestionType | string;
      ai_review_enabled?: boolean;
      ai_review_criteria?: string | null;
      ai_review_score?: number | null;
      conditional_logic_enabled?: boolean;
      conditional_logic?: QuestionConditionalLogic | null;
    },
  ) {
    const type = (dto.type ?? existing?.type) as QuestionType | undefined;
    const aiReviewEnabled =
      dto.ai_review_enabled ?? existing?.ai_review_enabled ?? false;
    const aiReviewCriteria =
      dto.ai_review_criteria ?? existing?.ai_review_criteria ?? null;
    const aiReviewScore =
      dto.ai_review_score ?? existing?.ai_review_score ?? null;
    const conditionalLogicEnabled =
      dto.conditional_logic_enabled ??
      existing?.conditional_logic_enabled ??
      false;
    const conditionalLogic =
      dto.conditional_logic ?? existing?.conditional_logic ?? null;

    return {
      type,
      aiReviewEnabled,
      aiReviewCriteria,
      aiReviewScore,
      conditionalLogicEnabled,
      conditionalLogic,
    };
  }

  private async validateConditionalTarget(
    client: PoolClient | undefined,
    certificateId: string,
    target: { target_type: ConditionalTargetType; target_id: string },
  ): Promise<void> {
    switch (target.target_type) {
      case ConditionalTargetType.MAIN_SECTION: {
        const main = await this.certificateRepo.findMainSectionById(
          target.target_id,
          client,
        );
        if (!main || main.certificate_id !== certificateId) {
          throw new BadRequestException(
            `Conditional target main_section "${target.target_id}" does not belong to this certificate`,
          );
        }
        return;
      }
      case ConditionalTargetType.SECTION: {
        const section = await this.certificateRepo.findSectionById(
          target.target_id,
          client,
        );
        if (!section || section.certificate_id !== certificateId) {
          throw new BadRequestException(
            `Conditional target section "${target.target_id}" does not belong to this certificate`,
          );
        }
        return;
      }
      case ConditionalTargetType.SUB_SECTION: {
        const subSection = await this.certificateRepo.findSubSectionById(
          target.target_id,
          client,
        );
        if (!subSection || subSection.certificate_id !== certificateId) {
          throw new BadRequestException(
            `Conditional target sub_section "${target.target_id}" does not belong to this certificate`,
          );
        }
        return;
      }
      case ConditionalTargetType.QUESTION: {
        const question = await this.certificateRepo.findQuestionById(
          target.target_id,
          client,
        );
        if (!question || question.certificate_id !== certificateId) {
          throw new BadRequestException(
            `Conditional target question "${target.target_id}" does not belong to this certificate`,
          );
        }
        return;
      }
      default:
        throw new BadRequestException('Invalid conditional target type');
    }
  }

  private async validateQuestionEnhancements(
    client: PoolClient | undefined,
    certificateId: string,
    dto: Partial<QuestionItemDto | SubQuestionItemDto | UpdateQuestionDto | UpdateNestedQuestionDto>,
    existing?: {
      type?: QuestionType | string;
      ai_review_enabled?: boolean;
      ai_review_criteria?: string | null;
      ai_review_score?: number | null;
      conditional_logic_enabled?: boolean;
      conditional_logic?: QuestionConditionalLogic | null;
    },
  ): Promise<void> {
    const config = this.getEffectiveQuestionConfig(dto, existing);

    if (!config.type) {
      return;
    }

    const isBoolean = config.type === QuestionType.BOOLEAN;

    if (!isBoolean && (dto.yes_score !== undefined || dto.no_score !== undefined)) {
      throw new BadRequestException(
        'yes_score and no_score are only allowed for boolean questions',
      );
    }

    if (!isBoolean && (dto.conditional_logic_enabled || dto.conditional_logic)) {
      throw new BadRequestException(
        'Conditional logic is only allowed for boolean questions',
      );
    }

    if (config.aiReviewEnabled) {
      if (this.isBlank(config.aiReviewCriteria)) {
        throw new BadRequestException(
          'ai_review_criteria is required when AI review is enabled',
        );
      }
      if (!isBoolean && config.aiReviewScore === null) {
        throw new BadRequestException(
          'ai_review_score is required for non-boolean questions when AI review is enabled',
        );
      }
    }

    if (config.conditionalLogicEnabled) {
      if (!isBoolean) {
        throw new BadRequestException(
          'Conditional logic is only allowed for boolean questions',
        );
      }
      if (!config.conditionalLogic) {
        throw new BadRequestException(
          'conditional_logic is required when conditional logic is enabled',
        );
      }

      const targets = [
        config.conditionalLogic.yes?.redirect_to,
        ...(config.conditionalLogic.yes?.blocked_sections || []),
        ...(config.conditionalLogic.yes?.allowed_sections || []),
        config.conditionalLogic.no?.redirect_to,
        ...(config.conditionalLogic.no?.blocked_sections || []),
        ...(config.conditionalLogic.no?.allowed_sections || []),
      ].filter(Boolean) as Array<{
        target_type: ConditionalTargetType;
        target_id: string;
      }>;

      for (const target of targets) {
        await this.validateConditionalTarget(client, certificateId, target);
      }
    }
  }

  private normalizeQuestionEnhancements<
    T extends Partial<QuestionItemDto | SubQuestionItemDto | UpdateQuestionDto | UpdateNestedQuestionDto>,
  >(dto: T): T {
    if (dto.ai_review_enabled === false) {
      dto.ai_review_criteria = null as never;
      dto.ai_review_score = null as never;
    }
    if (dto.conditional_logic_enabled === false) {
      dto.conditional_logic = null as never;
    }
    return dto;
  }

  private buildMainSectionCode(rootCode: string | null | undefined, rank: number): string | null {
    if (!rootCode) return null;
    return `${rootCode}${rank}`;
  }

  private buildSectionCode(
    mainCode: string | null | undefined,
    sectionIndex: number,
  ): string | null {
    return mainCode ? `${mainCode}.${sectionIndex}` : null;
  }

  private buildSubSectionCode(
    sectionCode: string | null | undefined,
    subSectionIndex: number,
  ): string | null {
    return sectionCode ? `${sectionCode}.${subSectionIndex}` : null;
  }

  private buildSectionQuestionCode(
    sectionCode: string | null | undefined,
    questionIndex: number | undefined,
  ): string | null {
    return sectionCode && questionIndex ? `${sectionCode}.0.${questionIndex}` : null;
  }

  private buildSubSectionQuestionCode(
    sectionCode: string | null | undefined,
    subSectionIndex: number | undefined,
    questionIndex: number | undefined,
  ): string | null {
    return sectionCode && subSectionIndex && questionIndex
      ? `${sectionCode}.${subSectionIndex}.${questionIndex}`
      : null;
  }

  async createMainSections(
    certificateId: string,
    dto: CreateMainSectionsDto,
  ): Promise<CreatedSection[]> {
    const certificate =
      await this.certificateRepo.findCertificateById(certificateId);
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    const client = await this.certificateRepo.beginTransaction();

    try {
      const created: CreatedSection[] = [];
      let currentMaxRank = await this.certificateRepo.getMaxMainSectionRank(
        client,
        certificateId,
      );

      for (const sectionDto of dto.sections) {
        const rank = sectionDto.rank || ++currentMaxRank;
        if (!sectionDto.rank) {
          currentMaxRank = rank;
        }

        const section = await this.certificateRepo.createMainSection(client, {
          certificate_id: certificateId,
          name: sectionDto.name,
          short_code: this.buildMainSectionCode(certificate.short_code, rank),
          rank,
        });

        created.push({ ...section, level: 1 });
      }

      await this.certificateRepo.commitTransaction(client);
      return created;
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      handleDatabaseError(error);
    }
  }

  async createSubsections(
    parentId: string,
    dto: CreateSubsectionsDto,
  ): Promise<CreatedSection[]> {
    const client = await this.certificateRepo.beginTransaction();

    try {
      const created: CreatedSection[] = [];

      switch (dto.parent_type) {
        case ParentType.MAIN: {
          const mainSection = await this.certificateRepo.findMainSectionById(
            parentId,
            client,
          );
          if (!mainSection) {
            throw new NotFoundException('Main section not found');
          }

          let currentMaxRank = await this.certificateRepo.getMaxSectionRank(
            client,
            parentId,
          );

          for (const sectionDto of dto.sections) {
            const rank = sectionDto.rank || ++currentMaxRank;
            if (!sectionDto.rank) {
              currentMaxRank = rank;
            }

            const section = await this.certificateRepo.createSection(client, {
              certificate_id: mainSection.certificate_id,
              main_id: parentId,
              name: sectionDto.name,
              short_code: this.buildSectionCode(mainSection.short_code, rank),
              rank,
            });

            created.push({ ...section, level: 2 });
          }
          break;
        }

        case ParentType.SECTION: {
          const section = await this.certificateRepo.findSectionById(
            parentId,
            client,
          );
          if (!section) {
            throw new NotFoundException('Section not found');
          }

          let currentMaxRank = await this.certificateRepo.getMaxSubSectionRank(
            client,
            parentId,
          );

          for (const sectionDto of dto.sections) {
            const rank = sectionDto.rank || ++currentMaxRank;
            if (!sectionDto.rank) {
              currentMaxRank = rank;
            }

            const subSection = await this.certificateRepo.createSubSection(
              client,
              {
                certificate_id: section.certificate_id,
                main_id: section.main_id,
                section_id: parentId,
                name: sectionDto.name,
                short_code: this.buildSubSectionCode(section.short_code, rank),
                rank,
              },
            );

            created.push({ ...subSection, level: 3 });
          }
          break;
        }

        default:
          throw new BadRequestException(
            'Invalid parent_type. Must be "MAIN" or "SECTION". Hierarchy is limited to: Certificate → Main Section → Section → Subsection',
          );
      }

      await this.certificateRepo.commitTransaction(client);
      return created;
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      handleDatabaseError(error);
    }
  }

  private async addQuestionsToSection(
    client: PoolClient,
    sectionId: string,
    sectionType: SectionType,
    questions: QuestionItemDto[],
    certificateIdForValidation?: string,
  ): Promise<CreatedQuestion[]> {
    const created: CreatedQuestion[] = [];

    switch (sectionType) {
      case SectionType.SECTION: {
        const section = await this.certificateRepo.findSectionById(
          sectionId,
          client,
        );
        if (!section) {
          throw new NotFoundException(
            `Section with ID "${sectionId}" not found. Make sure you're using a valid section ID and that section_type is set to "SECTION" in the request body.`,
          );
        }
        if (
          certificateIdForValidation &&
          section.certificate_id !== certificateIdForValidation
        ) {
          throw new BadRequestException(
            `Section "${sectionId}" does not belong to certificate "${certificateIdForValidation}"`,
          );
        }

        let currentMaxRank =
          await this.certificateRepo.getMaxQuestionRankForSection(
            client,
            sectionId,
          );
        let currentMaxNumber =
          await this.certificateRepo.getMaxQuestionNumberForSection(
            client,
            sectionId,
          );
        let currentMaxCertNumber =
          await this.certificateRepo.getMaxCertificateQuestionNumber(
            client,
            section.certificate_id,
          );

        for (const questionDto of questions) {
          this.normalizeQuestionEnhancements(questionDto);
          await this.validateQuestionEnhancements(
            client,
            section.certificate_id,
            questionDto,
          );

          const rank = questionDto.rank || ++currentMaxRank;
          if (!questionDto.rank) currentMaxRank = rank;

          let questionNumber: number | undefined;
          if (questionDto.question_number !== undefined) {
            await this.certificateRepo.shiftQuestionNumbersForSectionInsert(
              client,
              sectionId,
              questionDto.question_number,
            );
            questionNumber = questionDto.question_number;
          } else {
            questionNumber = ++currentMaxNumber;
          }

          let certQuestionNumber: number | undefined;
          if (questionDto.certificate_question_number !== undefined) {
            await this.certificateRepo.shiftCertificateQuestionNumbersForInsert(
              client,
              section.certificate_id,
              questionDto.certificate_question_number,
            );
            certQuestionNumber = questionDto.certificate_question_number;
          } else {
            certQuestionNumber = ++currentMaxCertNumber;
          }

          const question = await this.certificateRepo.createQuestionForSection(
            client,
            {
              certificate_id: section.certificate_id,
              main_section_id: section.main_id,
              section_id: sectionId,
              question: questionDto.question,
              short_code: this.buildSectionQuestionCode(
                section.short_code,
                questionNumber,
              ),
              hint: questionDto.hint,
              type: questionDto.type,
              criteria: questionDto.criteria,
              ai_review_enabled: questionDto.ai_review_enabled,
              ai_review_criteria: questionDto.ai_review_criteria,
              ai_review_score: questionDto.ai_review_score,
              yes_score: questionDto.yes_score,
              no_score: questionDto.no_score,
              conditional_logic_enabled: questionDto.conditional_logic_enabled,
              conditional_logic: questionDto.conditional_logic,
              rank,
              question_number: questionNumber,
              certificate_question_number: certQuestionNumber,
              score: questionDto.score,
              is_compulsory: questionDto.is_compulsory,
              options: questionDto.options,
            },
          );

          if (questionNumber && questionNumber > currentMaxNumber)
            currentMaxNumber = questionNumber;
          if (certQuestionNumber && certQuestionNumber > currentMaxCertNumber)
            currentMaxCertNumber = certQuestionNumber;

          created.push(question);

          // Recursively create nested sub-questions (supports infinite boolean nesting)
          const createSubQuestionsForSection = async (
            parentId: string,
            subDto: SubQuestionItemDto,
            triggerValue: 'yes' | 'no',
          ) => {
            this.normalizeQuestionEnhancements(subDto);
            await this.validateQuestionEnhancements(
              client,
              section.certificate_id,
              subDto,
            );

            const subRank = subDto.rank || ++currentMaxRank;
            if (!subDto.rank) currentMaxRank = subRank;
            certQuestionNumber = ++currentMaxCertNumber;

            const createdSub =
              await this.certificateRepo.createQuestionForSection(client, {
                certificate_id: section.certificate_id,
                main_section_id: section.main_id,
                section_id: sectionId,
                question: subDto.question,
                hint: subDto.hint,
                type: subDto.type,
                criteria: subDto.criteria,
                ai_review_enabled: subDto.ai_review_enabled,
                ai_review_criteria: subDto.ai_review_criteria,
                ai_review_score: subDto.ai_review_score,
                yes_score: subDto.yes_score,
                no_score: subDto.no_score,
                conditional_logic_enabled: subDto.conditional_logic_enabled,
                conditional_logic: subDto.conditional_logic,
                rank: subRank,
                certificate_question_number: certQuestionNumber,
                score: subDto.score,
                is_compulsory: subDto.is_compulsory,
                options: subDto.options,
                parent_question_id: parentId,
                parent_trigger_value: triggerValue,
              });

            for (const nested of subDto.yes_sub_questions || []) {
              await createSubQuestionsForSection(createdSub.id, nested, 'yes');
            }
            for (const nested of subDto.no_sub_questions || []) {
              await createSubQuestionsForSection(createdSub.id, nested, 'no');
            }
          };

          for (const sub of questionDto.yes_sub_questions || []) {
            await createSubQuestionsForSection(question.id, sub, 'yes');
          }
          for (const sub of questionDto.no_sub_questions || []) {
            await createSubQuestionsForSection(question.id, sub, 'no');
          }
        }
        break;
      }

      case SectionType.SUB_SECTION: {
        const subSection = await this.certificateRepo.findSubSectionById(
          sectionId,
          client,
        );
        if (!subSection) {
          throw new NotFoundException(
            `Sub-section with ID "${sectionId}" not found. Make sure you're using a valid sub-section ID and that section_type is set to "SUB_SECTION" in the request body.`,
          );
        }
        if (
          certificateIdForValidation &&
          subSection.certificate_id !== certificateIdForValidation
        ) {
          throw new BadRequestException(
            `Sub-section "${sectionId}" does not belong to certificate "${certificateIdForValidation}"`,
          );
        }
        const parentSection = await this.certificateRepo.findSectionById(
          subSection.section_id,
          client,
        );
        if (!parentSection) {
          throw new NotFoundException('Parent section not found');
        }

        let currentMaxRank =
          await this.certificateRepo.getMaxQuestionRankForSubSection(
            client,
            sectionId,
          );
        let currentMaxNumber =
          await this.certificateRepo.getMaxQuestionNumberForSubSection(
            client,
            sectionId,
          );
        let currentMaxCertNumber =
          await this.certificateRepo.getMaxCertificateQuestionNumber(
            client,
            subSection.certificate_id,
          );

        for (const questionDto of questions) {
          this.normalizeQuestionEnhancements(questionDto);
          await this.validateQuestionEnhancements(
            client,
            subSection.certificate_id,
            questionDto,
          );

          const rank = questionDto.rank || ++currentMaxRank;
          if (!questionDto.rank) currentMaxRank = rank;

          let questionNumber: number | undefined;
          if (questionDto.question_number !== undefined) {
            await this.certificateRepo.shiftQuestionNumbersForSubSectionInsert(
              client,
              sectionId,
              questionDto.question_number,
            );
            questionNumber = questionDto.question_number;
          } else {
            questionNumber = ++currentMaxNumber;
          }

          let certQuestionNumber: number | undefined;
          if (questionDto.certificate_question_number !== undefined) {
            await this.certificateRepo.shiftCertificateQuestionNumbersForInsert(
              client,
              subSection.certificate_id,
              questionDto.certificate_question_number,
            );
            certQuestionNumber = questionDto.certificate_question_number;
          } else {
            certQuestionNumber = ++currentMaxCertNumber;
          }

          const question =
            await this.certificateRepo.createQuestionForSubSection(client, {
              certificate_id: subSection.certificate_id,
              main_section_id: subSection.main_id,
              section_id: subSection.section_id,
              sub_section_id: sectionId,
              question: questionDto.question,
              short_code: this.buildSubSectionQuestionCode(
                parentSection.short_code,
                subSection.rank,
                questionNumber,
              ),
              hint: questionDto.hint,
              type: questionDto.type,
              criteria: questionDto.criteria,
              ai_review_enabled: questionDto.ai_review_enabled,
              ai_review_criteria: questionDto.ai_review_criteria,
              ai_review_score: questionDto.ai_review_score,
              yes_score: questionDto.yes_score,
              no_score: questionDto.no_score,
              conditional_logic_enabled: questionDto.conditional_logic_enabled,
              conditional_logic: questionDto.conditional_logic,
              rank,
              question_number: questionNumber,
              certificate_question_number: certQuestionNumber,
              score: questionDto.score,
              is_compulsory: questionDto.is_compulsory,
              options: questionDto.options,
            });

          if (questionNumber && questionNumber > currentMaxNumber)
            currentMaxNumber = questionNumber;
          if (certQuestionNumber && certQuestionNumber > currentMaxCertNumber)
            currentMaxCertNumber = certQuestionNumber;

          created.push(question);

          // Recursively create nested sub-questions (supports infinite boolean nesting)
          const createSubQuestionsForSubSection = async (
            parentId: string,
            subDto: SubQuestionItemDto,
            triggerValue: 'yes' | 'no',
          ) => {
            this.normalizeQuestionEnhancements(subDto);
            await this.validateQuestionEnhancements(
              client,
              subSection.certificate_id,
              subDto,
            );

            const subRank = subDto.rank || ++currentMaxRank;
            if (!subDto.rank) currentMaxRank = subRank;
            certQuestionNumber = ++currentMaxCertNumber;

            const createdSub =
              await this.certificateRepo.createQuestionForSubSection(client, {
                certificate_id: subSection.certificate_id,
                main_section_id: subSection.main_id,
                section_id: subSection.section_id,
                sub_section_id: sectionId,
                question: subDto.question,
                hint: subDto.hint,
                type: subDto.type,
                criteria: subDto.criteria,
                ai_review_enabled: subDto.ai_review_enabled,
                ai_review_criteria: subDto.ai_review_criteria,
                ai_review_score: subDto.ai_review_score,
                yes_score: subDto.yes_score,
                no_score: subDto.no_score,
                conditional_logic_enabled: subDto.conditional_logic_enabled,
                conditional_logic: subDto.conditional_logic,
                rank: subRank,
                certificate_question_number: certQuestionNumber,
                score: subDto.score,
                is_compulsory: subDto.is_compulsory,
                options: subDto.options,
                parent_question_id: parentId,
                parent_trigger_value: triggerValue,
              });

            for (const nested of subDto.yes_sub_questions || []) {
              await createSubQuestionsForSubSection(
                createdSub.id,
                nested,
                'yes',
              );
            }
            for (const nested of subDto.no_sub_questions || []) {
              await createSubQuestionsForSubSection(
                createdSub.id,
                nested,
                'no',
              );
            }
          };

          for (const sub of questionDto.yes_sub_questions || []) {
            await createSubQuestionsForSubSection(question.id, sub, 'yes');
          }
          for (const sub of questionDto.no_sub_questions || []) {
            await createSubQuestionsForSubSection(question.id, sub, 'no');
          }
        }
        break;
      }

      default:
        throw new BadRequestException(
          `Invalid section_type. Must be "section" or "sub_section".`,
        );
    }

    return created;
  }

  async addQuestions(
    sectionId: string,
    dto: AddQuestionsDto,
  ): Promise<CreatedQuestion[]> {
    const client = await this.certificateRepo.beginTransaction();

    try {
      const created = await this.addQuestionsToSection(
        client,
        sectionId,
        dto.section_type,
        dto.questions,
      );

      await this.certificateRepo.commitTransaction(client);
      return created;
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      handleDatabaseError(error);
    }
  }

  async bulkAddQuestions(
    certificateId: string,
    dto: BulkAddQuestionsDto,
  ): Promise<
    {
      section_id: string;
      section_type: string;
      questions_added: number;
      questions: CreatedQuestion[];
    }[]
  > {
    const cert = await this.certificateRepo.findCertificateById(certificateId);
    if (!cert) {
      throw new NotFoundException(
        `Certificate with ID "${certificateId}" not found`,
      );
    }

    const client = await this.certificateRepo.beginTransaction();
    try {
      const results: {
        section_id: string;
        section_type: string;
        questions_added: number;
        questions: CreatedQuestion[];
      }[] = [];

      for (const entry of dto.entries) {
        const entryQuestions = await this.addQuestionsToSection(
          client,
          entry.section_id,
          entry.section_type,
          entry.questions,
          certificateId,
        );

        results.push({
          section_id: entry.section_id,
          section_type: entry.section_type,
          questions_added: entryQuestions.length,
          questions: entryQuestions,
        });
      }

      await this.certificateRepo.commitTransaction(client);
      return results;
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      handleDatabaseError(error);
    }
  }

  async updateMainSection(
    mainSectionId: string,
    dto: UpdateMainSectionDto,
  ): Promise<{ id: string; name: string; rank: number }> {
    const mainSection =
      await this.certificateRepo.findMainSectionById(mainSectionId);
    if (!mainSection) {
      throw new NotFoundException('Main section not found');
    }

    const updated = await this.certificateRepo.updateMainSection(
      mainSectionId,
      {
        name: dto.name,
        rank: dto.rank,
      },
    );
    return { id: updated!.id, name: updated!.name, rank: updated!.rank };
  }

  async updateSection(
    sectionId: string,
    dto: UpdateSectionDto,
  ): Promise<{ id: string; name: string; rank: number }> {
    const section = await this.certificateRepo.findSectionById(sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const updated = await this.certificateRepo.updateSection(sectionId, {
      name: dto.name,
      rank: dto.rank,
    });
    return { id: updated!.id, name: updated!.name, rank: updated!.rank };
  }

  async updateSubSection(
    subSectionId: string,
    dto: UpdateSubsectionDto,
  ): Promise<{ id: string; name: string; rank: number }> {
    const subSection =
      await this.certificateRepo.findSubSectionById(subSectionId);
    if (!subSection) {
      throw new NotFoundException('Subsection not found');
    }

    const updated = await this.certificateRepo.updateSubSection(subSectionId, {
      name: dto.name,
      rank: dto.rank,
    });
    return { id: updated!.id, name: updated!.name, rank: updated!.rank };
  }

  async updateQuestion(
    questionId: string,
    dto: UpdateQuestionDto,
  ): Promise<{ id: string; question: string; rank: number }> {
    const question = await this.certificateRepo.findQuestionById(questionId);
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // Block changes that would retroactively alter scoring/structure once applicants
    // have answered this question — that would silently change already-computed (and
    // future in-progress) results. Wording, hints and criteria can still be edited.
    const changesScoringOrStructure =
      dto.score !== undefined ||
      dto.yes_score !== undefined ||
      dto.no_score !== undefined ||
      dto.type !== undefined ||
      dto.options !== undefined ||
      dto.ai_review_enabled !== undefined ||
      dto.ai_review_score !== undefined ||
      dto.conditional_logic_enabled !== undefined ||
      dto.conditional_logic !== undefined;
    if (changesScoringOrStructure) {
      const answerCount =
        await this.certificateRepo.countAnswersForQuestionTree(questionId);
      if (answerCount > 0) {
        throw new BadRequestException(
          'This question has already been answered by applicants, so its scoring, type, options or conditional logic can no longer be changed. You may still edit its wording, hint or criteria.',
        );
      }
    }

    const hasNestedUpdates =
      dto.yes_sub_questions !== undefined || dto.no_sub_questions !== undefined;

    if (!hasNestedUpdates) {
      this.normalizeQuestionEnhancements(dto);
      await this.validateQuestionEnhancements(
        undefined,
        question.certificate_id,
        dto,
        question,
      );

      const updated = await this.certificateRepo.updateQuestion(questionId, {
        question: dto.question,
        hint: dto.hint,
        type: dto.type,
        criteria: dto.criteria,
        ai_review_enabled: dto.ai_review_enabled,
        ai_review_criteria: dto.ai_review_criteria,
        ai_review_score: dto.ai_review_score,
        yes_score: dto.yes_score,
        no_score: dto.no_score,
        conditional_logic_enabled: dto.conditional_logic_enabled,
        conditional_logic: dto.conditional_logic,
        rank: dto.rank,
        question_number: dto.question_number,
        certificate_question_number: dto.certificate_question_number,
        score: dto.score,
        is_compulsory: dto.is_compulsory,
        options: dto.options,
      });
      return {
        id: updated!.id,
        question: updated!.question,
        rank: updated!.rank,
      };
    }

    const client = await this.certificateRepo.beginTransaction();
    try {
      this.normalizeQuestionEnhancements(dto);
      await this.validateQuestionEnhancements(
        client,
        question.certificate_id,
        dto,
        question,
      );

      const updatedRoot = await this.certificateRepo.updateQuestion(
        questionId,
        {
          question: dto.question,
          hint: dto.hint,
          type: dto.type,
          criteria: dto.criteria,
          ai_review_enabled: dto.ai_review_enabled,
          ai_review_criteria: dto.ai_review_criteria,
          ai_review_score: dto.ai_review_score,
          yes_score: dto.yes_score,
          no_score: dto.no_score,
          conditional_logic_enabled: dto.conditional_logic_enabled,
          conditional_logic: dto.conditional_logic,
          rank: dto.rank,
          question_number: dto.question_number,
          certificate_question_number: dto.certificate_question_number,
          score: dto.score,
          is_compulsory: dto.is_compulsory,
          options: dto.options,
        },
        client,
      );

      const context = {
        certificate_id: question.certificate_id,
        main_section_id: question.main_section_id,
        section_id: question.section_id,
        sub_section_id: question.sub_section_id,
        is_third_level: question.is_third_level,
      };

      let currentMaxRank =
        question.is_third_level && question.sub_section_id
          ? await this.certificateRepo.getMaxQuestionRankForSubSection(
              client,
              question.sub_section_id,
            )
          : await this.certificateRepo.getMaxQuestionRankForSection(
              client,
              question.section_id,
            );
      let currentMaxCertificateQuestionNumber =
        await this.certificateRepo.getMaxCertificateQuestionNumber(
          client,
          question.certificate_id,
        );

      if (dto.rank !== undefined && dto.rank > currentMaxRank) {
        currentMaxRank = dto.rank;
      }
      if (
        dto.certificate_question_number !== undefined &&
        dto.certificate_question_number > currentMaxCertificateQuestionNumber
      ) {
        currentMaxCertificateQuestionNumber = dto.certificate_question_number;
      }

      const syncNestedBranch = async (
        parentQuestionId: string,
        triggerValue: 'yes' | 'no',
        children: UpdateNestedQuestionDto[],
      ): Promise<void> => {
        const existingChildren =
          await this.certificateRepo.getQuestionChildrenByTrigger(
            parentQuestionId,
            triggerValue,
            client,
          );

        const existingById = new Map(
          existingChildren.map((child) => [child.id, child]),
        );
        const retainedIds = new Set<string>();

        for (const childDto of children) {
          this.normalizeQuestionEnhancements(childDto);

          if (childDto.id) {
            const existingChild = existingById.get(childDto.id);
            if (!existingChild) {
              throw new BadRequestException(
                `Nested question "${childDto.id}" is not a direct ${triggerValue} sub-question of "${parentQuestionId}"`,
              );
            }

            await this.validateQuestionEnhancements(
              client,
              context.certificate_id,
              childDto,
              existingChild,
            );

            await this.certificateRepo.updateQuestion(
              existingChild.id,
              {
                question: childDto.question,
                hint: childDto.hint,
                type: childDto.type,
                criteria: childDto.criteria,
                ai_review_enabled: childDto.ai_review_enabled,
                ai_review_criteria: childDto.ai_review_criteria,
                ai_review_score: childDto.ai_review_score,
                yes_score: childDto.yes_score,
                no_score: childDto.no_score,
                conditional_logic_enabled: childDto.conditional_logic_enabled,
                conditional_logic: childDto.conditional_logic,
                rank: childDto.rank,
                score: childDto.score,
                is_compulsory: childDto.is_compulsory,
                options: childDto.options,
              },
              client,
            );

            retainedIds.add(existingChild.id);

            if (childDto.yes_sub_questions !== undefined) {
              await syncNestedBranch(
                existingChild.id,
                'yes',
                childDto.yes_sub_questions,
              );
            }
            if (childDto.no_sub_questions !== undefined) {
              await syncNestedBranch(
                existingChild.id,
                'no',
                childDto.no_sub_questions,
              );
            }
            continue;
          }

          if (!childDto.question || !childDto.type) {
            throw new BadRequestException(
              'Each new nested sub-question must include both "question" and "type"',
            );
          }

          await this.validateQuestionEnhancements(
            client,
            context.certificate_id,
            childDto,
          );

          const rank = childDto.rank ?? ++currentMaxRank;
          if (rank > currentMaxRank) {
            currentMaxRank = rank;
          }

          const certificateQuestionNumber =
            ++currentMaxCertificateQuestionNumber;

          const createdChild =
            context.is_third_level && context.sub_section_id
              ? await this.certificateRepo.createQuestionForSubSection(client, {
                  certificate_id: context.certificate_id,
                  main_section_id: context.main_section_id,
                  section_id: context.section_id,
                  sub_section_id: context.sub_section_id,
                  question: childDto.question,
                  hint: childDto.hint,
                  type: childDto.type,
                  criteria: childDto.criteria,
                  ai_review_enabled: childDto.ai_review_enabled,
                  ai_review_criteria: childDto.ai_review_criteria,
                  ai_review_score: childDto.ai_review_score,
                  yes_score: childDto.yes_score,
                  no_score: childDto.no_score,
                  conditional_logic_enabled:
                    childDto.conditional_logic_enabled,
                  conditional_logic: childDto.conditional_logic,
                  rank,
                  certificate_question_number: certificateQuestionNumber,
                  score: childDto.score,
                  is_compulsory: childDto.is_compulsory,
                  options: childDto.options,
                  parent_question_id: parentQuestionId,
                  parent_trigger_value: triggerValue,
                })
              : await this.certificateRepo.createQuestionForSection(client, {
                  certificate_id: context.certificate_id,
                  main_section_id: context.main_section_id,
                  section_id: context.section_id,
                  question: childDto.question,
                  hint: childDto.hint,
                  type: childDto.type,
                  criteria: childDto.criteria,
                  ai_review_enabled: childDto.ai_review_enabled,
                  ai_review_criteria: childDto.ai_review_criteria,
                  ai_review_score: childDto.ai_review_score,
                  yes_score: childDto.yes_score,
                  no_score: childDto.no_score,
                  conditional_logic_enabled:
                    childDto.conditional_logic_enabled,
                  conditional_logic: childDto.conditional_logic,
                  rank,
                  certificate_question_number: certificateQuestionNumber,
                  score: childDto.score,
                  is_compulsory: childDto.is_compulsory,
                  options: childDto.options,
                  parent_question_id: parentQuestionId,
                  parent_trigger_value: triggerValue,
                });

          retainedIds.add(createdChild.id);

          if (childDto.yes_sub_questions !== undefined) {
            await syncNestedBranch(
              createdChild.id,
              'yes',
              childDto.yes_sub_questions,
            );
          }
          if (childDto.no_sub_questions !== undefined) {
            await syncNestedBranch(
              createdChild.id,
              'no',
              childDto.no_sub_questions,
            );
          }
        }

        for (const existingChild of existingChildren) {
          if (!retainedIds.has(existingChild.id)) {
            const childAnswers =
              await this.certificateRepo.countAnswersForQuestionTree(
                existingChild.id,
                client,
              );
            if (childAnswers > 0) {
              throw new BadRequestException(
                'A nested sub-question that applicants have already answered cannot be removed. Deleting it would destroy assessment history.',
              );
            }
            await this.certificateRepo.deleteQuestion(existingChild.id, client);
          }
        }
      };

      if (dto.yes_sub_questions !== undefined) {
        await syncNestedBranch(questionId, 'yes', dto.yes_sub_questions);
      }
      if (dto.no_sub_questions !== undefined) {
        await syncNestedBranch(questionId, 'no', dto.no_sub_questions);
      }

      await this.certificateRepo.commitTransaction(client);
      return {
        id: updatedRoot!.id,
        question: updatedRoot!.question,
        rank: updatedRoot!.rank,
      };
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      if (error instanceof BadRequestException) {
        throw error;
      }
      handleDatabaseError(error);
    }
  }

  async deleteMainSection(mainSectionId: string): Promise<{ message: string }> {
    const mainSection =
      await this.certificateRepo.findMainSectionById(mainSectionId);
    if (!mainSection) {
      throw new NotFoundException('Main section not found');
    }

    const answerCount = await this.certificateRepo.countAnswersByStructural(
      'main_section_id',
      mainSectionId,
    );
    if (answerCount > 0) {
      throw new BadRequestException(
        'This section cannot be deleted because it contains questions that applicants have already answered. Deleting it would destroy assessment history.',
      );
    }

    const client = await this.certificateRepo.beginTransaction();
    try {
      await this.certificateRepo.deleteQuestionsByMainSection(
        mainSectionId,
        client,
      );
      await this.certificateRepo.deleteSubSectionsByMainSection(
        mainSectionId,
        client,
      );
      await this.certificateRepo.deleteSectionsByMainSection(
        mainSectionId,
        client,
      );
      await this.certificateRepo.deleteMainSection(mainSectionId, client);
      await this.certificateRepo.commitTransaction(client);
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      throw error;
    }

    return {
      message: 'Main section and all its children deleted successfully',
    };
  }

  async deleteSection(sectionId: string): Promise<{ message: string }> {
    const section = await this.certificateRepo.findSectionById(sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const answerCount = await this.certificateRepo.countAnswersByStructural(
      'section_id',
      sectionId,
    );
    if (answerCount > 0) {
      throw new BadRequestException(
        'This section cannot be deleted because it contains questions that applicants have already answered. Deleting it would destroy assessment history.',
      );
    }

    const client = await this.certificateRepo.beginTransaction();
    try {
      await this.certificateRepo.deleteQuestionsBySection(sectionId, client);
      await this.certificateRepo.deleteSubSectionsBySection(sectionId, client);
      await this.certificateRepo.deleteSection(sectionId, client);
      await this.certificateRepo.commitTransaction(client);
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      throw error;
    }

    return { message: 'Section and its children deleted successfully' };
  }

  async deleteSubSection(subSectionId: string): Promise<{ message: string }> {
    const subSection =
      await this.certificateRepo.findSubSectionById(subSectionId);
    if (!subSection) {
      throw new NotFoundException('Sub-section not found');
    }

    const answerCount = await this.certificateRepo.countAnswersByStructural(
      'sub_section_id',
      subSectionId,
    );
    if (answerCount > 0) {
      throw new BadRequestException(
        'This subsection cannot be deleted because it contains questions that applicants have already answered. Deleting it would destroy assessment history.',
      );
    }

    const client = await this.certificateRepo.beginTransaction();
    try {
      await this.certificateRepo.deleteQuestionsBySubSection(
        subSectionId,
        client,
      );
      await this.certificateRepo.deleteSubSection(subSectionId, client);
      await this.certificateRepo.commitTransaction(client);
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      throw error;
    }

    return { message: 'Subsection and its questions deleted successfully' };
  }

  async deleteQuestion(questionId: string): Promise<{ message: string }> {
    const question = await this.certificateRepo.findQuestionById(questionId);
    if (!question) {
      throw new NotFoundException('Question not found');
    }

    const answerCount =
      await this.certificateRepo.countAnswersForQuestionTree(questionId);
    if (answerCount > 0) {
      throw new BadRequestException(
        'This question cannot be deleted because applicants have already answered it. Deleting it would destroy assessment history.',
      );
    }

    await this.certificateRepo.deleteQuestion(questionId);
    return { message: 'Question deleted successfully' };
  }

  // ── Drag-and-drop reorder ────────────────────────────────────────────────

  // ── Drag-and-drop reorder (with promote/demote) ─────────────────────────

  async reorderItem(certificateId: string, dto: ReorderItemDto): Promise<void> {
    const certificate =
      await this.certificateRepo.findCertificateById(certificateId);
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    const client = await this.certificateRepo.beginTransaction();

    try {
      const operation = dto.operation ?? ReorderOperationType.MOVE;

      if (operation === ReorderOperationType.CHANGE_RANK) {
        this.validateChangeRankPayload(dto);
        await this.handleChangeRankOperation(client, certificateId, dto);
      } else {
        const effectiveNewType = dto.new_item_type || dto.item_type;
        const isPromoteDemote = effectiveNewType !== dto.item_type;

        if (isPromoteDemote) {
          await this.handlePromoteDemote(
            client,
            certificateId,
            dto,
            effectiveNewType,
          );
        } else {
          switch (dto.item_type) {
            case ReorderItemType.MAIN_SECTION:
              await this.reorderMainSection(client, certificateId, dto);
              break;
            case ReorderItemType.SECTION:
              await this.reorderSection(client, certificateId, dto);
              break;
            case ReorderItemType.SUB_SECTION:
              await this.reorderSubSection(client, certificateId, dto);
              break;
            case ReorderItemType.QUESTION:
              await this.reorderQuestion(client, certificateId, dto);
              break;
            default:
              throw new BadRequestException('Invalid item_type');
          }
        }
      }

      await this.certificateRepo.recalculateCertificateQuestionNumbers(
        client,
        certificateId,
      );
      await this.certificateRepo.recalculateHierarchicalShortCodes(
        client,
        certificateId,
      );
      await this.certificateRepo.commitTransaction(client);
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw error;
    }
  }

  private validateChangeRankPayload(dto: ReorderItemDto): void {
    if (dto.new_rank === undefined) {
      throw new BadRequestException(
        'new_rank is required when operation is "change_rank"',
      );
    }

    if (
      dto.new_parent_id !== undefined ||
      dto.new_parent_type !== undefined ||
      dto.new_item_type !== undefined
    ) {
      throw new BadRequestException(
        'operation "change_rank" only supports item_type, item_id, and new_rank',
      );
    }
  }

  private async handleChangeRankOperation(
    client: PoolClient,
    certificateId: string,
    dto: ReorderItemDto,
  ): Promise<void> {
    switch (dto.item_type) {
      case ReorderItemType.MAIN_SECTION:
        await this.reorderMainSection(client, certificateId, dto);
        break;
      case ReorderItemType.SECTION:
        await this.reorderSection(client, certificateId, dto);
        break;
      case ReorderItemType.SUB_SECTION:
        await this.reorderSubSection(client, certificateId, dto);
        break;
      case ReorderItemType.QUESTION:
        await this.reorderQuestion(client, certificateId, dto);
        break;
      default:
        throw new BadRequestException('Invalid item_type');
    }
  }

  // ── Simple reorder (same level) ────────────────────────────────────────

  private async reorderMainSection(
    client: PoolClient,
    certificateId: string,
    dto: ReorderItemDto,
  ): Promise<void> {
    const mainSection = await this.certificateRepo.findMainSectionById(
      dto.item_id,
      client,
    );
    if (!mainSection) throw new NotFoundException('Main section not found');
    if (mainSection.certificate_id !== certificateId) {
      throw new BadRequestException(
        'Main section does not belong to this certificate',
      );
    }

    const newRank =
      dto.new_rank ??
      (await this.certificateRepo.getMaxMainSectionRank(
        client,
        certificateId,
      )) + 1;
    const oldRank = mainSection.rank;

    if (oldRank < newRank) {
      await client.query(
        `UPDATE main_section SET rank = rank - 1
         WHERE certificate_id = $1 AND rank > $2 AND rank <= $3 AND id != $4`,
        [certificateId, oldRank, newRank, dto.item_id],
      );
    } else if (oldRank > newRank) {
      await client.query(
        `UPDATE main_section SET rank = rank + 1
         WHERE certificate_id = $1 AND rank >= $2 AND rank < $3 AND id != $4`,
        [certificateId, newRank, oldRank, dto.item_id],
      );
    }

    await client.query(
      `UPDATE main_section SET rank = $1, updated_at = NOW() WHERE id = $2`,
      [newRank, dto.item_id],
    );
  }

  private async reorderSection(
    client: PoolClient,
    certificateId: string,
    dto: ReorderItemDto,
  ): Promise<void> {
    const section = await this.certificateRepo.findSectionById(
      dto.item_id,
      client,
    );
    if (!section) throw new NotFoundException('Section not found');
    if (section.certificate_id !== certificateId) {
      throw new BadRequestException(
        'Section does not belong to this certificate',
      );
    }

    const oldMainId = section.main_id;
    const oldRank = section.rank;
    const newMainId = dto.new_parent_id ?? section.main_id;

    if (dto.new_parent_id !== undefined) {
      const newMainSection = await this.certificateRepo.findMainSectionById(
        newMainId,
        client,
      );
      if (!newMainSection) {
        throw new NotFoundException('Main section (new parent) not found');
      }
      if (newMainSection.certificate_id !== certificateId) {
        throw new BadRequestException(
          'New parent main section does not belong to this certificate',
        );
      }
    }

    const newRank =
      dto.new_rank ??
      (await this.certificateRepo.getMaxSectionRankForMainSection(
        client,
        newMainId,
      )) + 1;

    if (oldMainId === newMainId) {
      if (oldRank < newRank) {
        await client.query(
          `UPDATE sections SET rank = rank - 1
           WHERE main_id = $1 AND rank > $2 AND rank <= $3 AND id != $4`,
          [oldMainId, oldRank, newRank, dto.item_id],
        );
      } else if (oldRank > newRank) {
        await client.query(
          `UPDATE sections SET rank = rank + 1
           WHERE main_id = $1 AND rank >= $2 AND rank < $3 AND id != $4`,
          [oldMainId, newRank, oldRank, dto.item_id],
        );
      }
    } else {
      await this.certificateRepo.shiftSectionRanksForDelete(
        client,
        oldMainId,
        oldRank,
        dto.item_id,
      );
      await this.certificateRepo.shiftSectionRanksForInsert(
        client,
        newMainId,
        newRank,
        dto.item_id,
      );
    }

    await this.certificateRepo.updateSectionParentAndRank(
      client,
      dto.item_id,
      newMainId,
      newRank,
    );

    // Cascade children when parent main_section changed
    if (oldMainId !== newMainId) {
      await this.certificateRepo.cascadeSectionChildren(
        client,
        dto.item_id,
        newMainId,
      );
    }
  }

  private async reorderSubSection(
    client: PoolClient,
    certificateId: string,
    dto: ReorderItemDto,
  ): Promise<void> {
    const subSection = await this.certificateRepo.findSubSectionById(
      dto.item_id,
      client,
    );
    if (!subSection) throw new NotFoundException('Sub-section not found');
    if (subSection.certificate_id !== certificateId) {
      throw new BadRequestException(
        'Sub-section does not belong to this certificate',
      );
    }

    const oldSectionId = subSection.section_id;
    const oldRank = subSection.rank;
    const newSectionId = dto.new_parent_id ?? subSection.section_id;
    let newMainId = subSection.main_id;

    if (dto.new_parent_id !== undefined) {
      const newSection = await this.certificateRepo.findSectionById(
        newSectionId,
        client,
      );
      if (!newSection) {
        throw new NotFoundException('Section (new parent) not found');
      }
      if (newSection.certificate_id !== certificateId) {
        throw new BadRequestException(
          'New parent section does not belong to this certificate',
        );
      }
      newMainId = newSection.main_id;
    }

    const newRank =
      dto.new_rank ??
      (await this.certificateRepo.getMaxSubSectionRankForSection(
        client,
        newSectionId,
      )) + 1;

    if (oldSectionId === newSectionId) {
      if (oldRank < newRank) {
        await client.query(
          `UPDATE sub_section SET rank = rank - 1
           WHERE section_id = $1 AND rank > $2 AND rank <= $3 AND id != $4`,
          [oldSectionId, oldRank, newRank, dto.item_id],
        );
      } else if (oldRank > newRank) {
        await client.query(
          `UPDATE sub_section SET rank = rank + 1
           WHERE section_id = $1 AND rank >= $2 AND rank < $3 AND id != $4`,
          [oldSectionId, newRank, oldRank, dto.item_id],
        );
      }
    } else {
      await this.certificateRepo.shiftSubSectionRanksForDelete(
        client,
        oldSectionId,
        oldRank,
        dto.item_id,
      );
      await this.certificateRepo.shiftSubSectionRanksForInsert(
        client,
        newSectionId,
        newRank,
        dto.item_id,
      );
    }

    await this.certificateRepo.updateSubSectionParentAndRank(
      client,
      dto.item_id,
      newSectionId,
      newMainId,
      newRank,
    );

    // Cascade children when parent section changed
    if (oldSectionId !== newSectionId) {
      await this.certificateRepo.cascadeSubSectionChildren(
        client,
        dto.item_id,
        newMainId,
        newSectionId,
      );
    }
  }

  private async reorderQuestion(
    client: PoolClient,
    certificateId: string,
    dto: ReorderItemDto,
  ): Promise<void> {
    const question = await this.certificateRepo.findQuestionById(dto.item_id);
    if (!question) throw new NotFoundException('Question not found');
    if (question.certificate_id !== certificateId) {
      throw new BadRequestException(
        'Question does not belong to this certificate',
      );
    }

    const oldParentId = question.is_third_level
      ? question.sub_section_id!
      : question.section_id;
    const oldIsThirdLevel = question.is_third_level;
    const targetParentId = dto.new_parent_id ?? oldParentId;

    if (!targetParentId) {
      throw new BadRequestException(
        'Target parent could not be resolved for question reordering',
      );
    }

    let resolvedParentType = dto.new_parent_type;
    let inferredSubSection: Awaited<
      ReturnType<CertificateRepository['findSubSectionById']>
    > | null = null;
    let inferredSection: Awaited<
      ReturnType<CertificateRepository['findSectionById']>
    > | null = null;

    if (!resolvedParentType) {
      if (!dto.new_parent_id) {
        resolvedParentType = oldIsThirdLevel
          ? ReorderParentType.SUB_SECTION
          : ReorderParentType.SECTION;
      } else {
        inferredSubSection = await this.certificateRepo.findSubSectionById(
          targetParentId,
          client,
        );
        inferredSection = await this.certificateRepo.findSectionById(
          targetParentId,
          client,
        );

        if (inferredSubSection?.certificate_id === certificateId) {
          resolvedParentType = ReorderParentType.SUB_SECTION;
        } else if (inferredSection?.certificate_id === certificateId) {
          resolvedParentType = ReorderParentType.SECTION;
        } else if (inferredSubSection || inferredSection) {
          throw new BadRequestException(
            'New parent does not belong to this certificate',
          );
        } else {
          throw new NotFoundException(
            'Target parent section or sub-section not found',
          );
        }
      }
    }

    const isNewParentSubSection =
      resolvedParentType === ReorderParentType.SUB_SECTION;
    let newMainSectionId: string;
    let newSectionId: string;
    let newSubSectionId: string | null = null;
    let newIsThirdLevel: boolean;

    if (!dto.new_parent_id && !dto.new_parent_type) {
      // Pure in-place reorder: reuse current parent coordinates directly.
      newMainSectionId = question.main_section_id;
      newSectionId = question.section_id;
      newSubSectionId = oldIsThirdLevel
        ? (question.sub_section_id ?? null)
        : null;
      newIsThirdLevel = oldIsThirdLevel;
    } else if (isNewParentSubSection) {
      const subSection =
        inferredSubSection ||
        (await this.certificateRepo.findSubSectionById(targetParentId, client));
      if (!subSection)
        throw new NotFoundException('Sub-section (new parent) not found');
      if (subSection.certificate_id !== certificateId) {
        throw new BadRequestException(
          'New parent sub-section does not belong to this certificate',
        );
      }
      newMainSectionId = subSection.main_id;
      newSectionId = subSection.section_id;
      newSubSectionId = subSection.id;
      newIsThirdLevel = true;
    } else {
      const section =
        inferredSection ||
        (await this.certificateRepo.findSectionById(targetParentId, client));
      if (!section)
        throw new NotFoundException('Section (new parent) not found');
      if (section.certificate_id !== certificateId) {
        throw new BadRequestException(
          'New parent section does not belong to this certificate',
        );
      }
      newMainSectionId = section.main_id;
      newSectionId = section.id;
      newSubSectionId = null;
      newIsThirdLevel = false;
    }

    const oldRank = question.rank;
    const newRank =
      dto.new_rank ??
      (isNewParentSubSection
        ? await this.certificateRepo.getMaxQuestionRankForSubSection(
            client,
            targetParentId,
          )
        : await this.certificateRepo.getMaxQuestionRankForSection(
            client,
            targetParentId,
          )) + 1;

    const isSameParent =
      oldParentId === targetParentId && oldIsThirdLevel === newIsThirdLevel;

    // Clear local numbers in affected parent scopes before rank shifts/move.
    // This avoids transient duplicate-key conflicts on (parent_id, question_number)
    // while the move transaction is still in-flight.
    await this.certificateRepo.nullifyLocalQuestionNumbers(
      client,
      oldParentId,
      oldIsThirdLevel,
    );
    if (!isSameParent) {
      await this.certificateRepo.nullifyLocalQuestionNumbers(
        client,
        targetParentId,
        newIsThirdLevel,
      );
    }

    if (isSameParent) {
      const rankShiftOffset = 1000000;
      const parentCol = oldIsThirdLevel ? 'sub_section_id' : 'section_id';

      // Park the moving question at a unique low rank to free its original slot.
      const parkedRankResult = await client.query<{ parked_rank: string }>(
        `SELECT (COALESCE(MIN(rank), 0) - 1)::text AS parked_rank
         FROM questions
         WHERE ${parentCol} = $1 AND is_third_level = $2`,
        [oldParentId, oldIsThirdLevel],
      );
      const parkedRank = parseInt(parkedRankResult.rows[0].parked_rank, 10);

      await client.query(`UPDATE questions SET rank = $1 WHERE id = $2`, [
        parkedRank,
        dto.item_id,
      ]);

      if (oldRank < newRank) {
        // Shift (oldRank, newRank] down by one using two-phase updates.
        await client.query(
          `UPDATE questions SET rank = rank + ${rankShiftOffset}
           WHERE ${parentCol} = $1
             AND is_third_level = $2 AND rank > $3 AND rank <= $4 AND id != $5`,
          [oldParentId, oldIsThirdLevel, oldRank, newRank, dto.item_id],
        );

        await client.query(
          `UPDATE questions SET rank = rank - ${rankShiftOffset + 1}
           WHERE ${parentCol} = $1
             AND is_third_level = $2 AND rank > $3 AND rank <= $4 AND id != $5`,
          [
            oldParentId,
            oldIsThirdLevel,
            oldRank + rankShiftOffset,
            newRank + rankShiftOffset,
            dto.item_id,
          ],
        );
      } else if (oldRank > newRank) {
        // Shift [newRank, oldRank) up by one using two-phase updates.
        await client.query(
          `UPDATE questions SET rank = rank + ${rankShiftOffset}
           WHERE ${parentCol} = $1
             AND is_third_level = $2 AND rank >= $3 AND rank < $4 AND id != $5`,
          [oldParentId, oldIsThirdLevel, newRank, oldRank, dto.item_id],
        );

        await client.query(
          `UPDATE questions SET rank = rank - ${rankShiftOffset - 1}
           WHERE ${parentCol} = $1
             AND is_third_level = $2 AND rank >= $3 AND rank < $4 AND id != $5`,
          [
            oldParentId,
            oldIsThirdLevel,
            newRank + rankShiftOffset,
            oldRank + rankShiftOffset,
            dto.item_id,
          ],
        );
      }
    } else {
      // Open target slot first; close old-parent gap after item is moved out.
      await this.certificateRepo.shiftQuestionRanksForInsert(
        client,
        targetParentId,
        newIsThirdLevel,
        newRank,
        dto.item_id,
      );
    }

    await this.certificateRepo.updateQuestionParentAndRank(
      client,
      dto.item_id,
      {
        main_section_id: newMainSectionId,
        section_id: newSectionId,
        sub_section_id: newSubSectionId,
        is_third_level: newIsThirdLevel,
        rank: newRank,
        // Defer local numbering to the renumber pass to avoid transient unique-index collisions.
        question_number: null,
      },
    );

    if (!isSameParent) {
      await this.certificateRepo.shiftQuestionRanksForDelete(
        client,
        oldParentId,
        oldIsThirdLevel,
        oldRank,
        dto.item_id,
      );
      await this.certificateRepo.renumberLocalQuestionNumbers(
        client,
        oldParentId,
        oldIsThirdLevel,
      );
    }
    await this.certificateRepo.renumberLocalQuestionNumbers(
      client,
      targetParentId,
      newIsThirdLevel,
    );
  }

  // ── Promote / Demote ──────────────────────────────────────────────────

  private async handlePromoteDemote(
    client: PoolClient,
    certificateId: string,
    dto: ReorderItemDto,
    newType: ReorderItemType,
  ): Promise<void> {
    const key = `${dto.item_type}->${newType}`;

    switch (key) {
      case 'section->main_section':
        await this.promoteSectionToMainSection(client, certificateId, dto);
        break;
      case 'main_section->section':
        await this.demoteMainSectionToSection(client, certificateId, dto);
        break;
      case 'sub_section->section':
        await this.promoteSubSectionToSection(client, certificateId, dto);
        break;
      case 'section->sub_section':
        await this.demoteSectionToSubSection(client, certificateId, dto);
        break;
      default:
        throw new BadRequestException(
          `Cannot convert ${dto.item_type} to ${newType}`,
        );
    }
  }

  private async promoteSectionToMainSection(
    client: PoolClient,
    certificateId: string,
    dto: ReorderItemDto,
  ): Promise<void> {
    const section = await this.certificateRepo.findSectionById(
      dto.item_id,
      client,
    );
    if (!section) throw new NotFoundException('Section not found');
    if (section.certificate_id !== certificateId) {
      throw new BadRequestException(
        'Section does not belong to this certificate',
      );
    }

    const newRank =
      dto.new_rank ??
      (await this.certificateRepo.getMaxMainSectionRank(
        client,
        certificateId,
      )) + 1;

    // Create new main_section with the section's name
    const newMain = await this.certificateRepo.createMainSectionFromName(
      client,
      certificateId,
      section.name,
      newRank,
    );

    // Reassign all children (sub_sections + questions) to point at the new main_section
    await this.certificateRepo.reassignSectionChildrenToNewMain(
      client,
      dto.item_id,
      newMain.id,
    );

    // Close rank gap in old parent
    await this.certificateRepo.shiftSectionRanksForDelete(
      client,
      section.main_id,
      section.rank,
      dto.item_id,
    );

    // Delete old section
    await this.certificateRepo.deleteSection(dto.item_id, client);
  }

  private async demoteMainSectionToSection(
    client: PoolClient,
    certificateId: string,
    dto: ReorderItemDto,
  ): Promise<void> {
    const mainSection = await this.certificateRepo.findMainSectionById(
      dto.item_id,
      client,
    );
    if (!mainSection) throw new NotFoundException('Main section not found');
    if (mainSection.certificate_id !== certificateId) {
      throw new BadRequestException(
        'Main section does not belong to this certificate',
      );
    }

    const targetMainId = dto.new_parent_id;
    if (!targetMainId) {
      throw new BadRequestException(
        'new_parent_id is required when converting main_section to section',
      );
    }

    // Target parent is another main_section
    const targetMain = await this.certificateRepo.findMainSectionById(
      targetMainId,
      client,
    );
    if (!targetMain)
      throw new NotFoundException('Target main section not found');
    if (targetMain.certificate_id !== certificateId) {
      throw new BadRequestException(
        'Target main section does not belong to this certificate',
      );
    }

    const newRank =
      dto.new_rank ??
      (await this.certificateRepo.getMaxSectionRankForMainSection(
        client,
        targetMainId,
      )) + 1;

    // Create new section under target main
    await this.certificateRepo.createSectionFromName(
      client,
      certificateId,
      targetMainId,
      mainSection.name,
      newRank,
    );

    // Reassign: move all sections under old main to become sub-sections? No — move children.
    // The old main_section's sections become children of the new section (sub_sections).
    // Actually, the old main's sections should keep their identity — we need to re-parent them.
    // Move old main's sections to target main
    await client.query(`UPDATE sections SET main_id = $1 WHERE main_id = $2`, [
      targetMainId,
      dto.item_id,
    ]);
    // Move old main's sub_sections to target main
    await client.query(
      `UPDATE sub_section SET main_id = $1 WHERE main_id = $2`,
      [targetMainId, dto.item_id],
    );
    // Move old main's questions to target main
    await client.query(
      `UPDATE questions SET main_section_id = $1 WHERE main_section_id = $2`,
      [targetMainId, dto.item_id],
    );

    // Close rank gap
    await client.query(
      `UPDATE main_section SET rank = rank - 1
       WHERE certificate_id = $1 AND rank > $2 AND id != $3`,
      [certificateId, mainSection.rank, dto.item_id],
    );

    // Delete old main_section
    await this.certificateRepo.deleteMainSection(dto.item_id, client);
  }

  private async promoteSubSectionToSection(
    client: PoolClient,
    certificateId: string,
    dto: ReorderItemDto,
  ): Promise<void> {
    const subSection = await this.certificateRepo.findSubSectionById(
      dto.item_id,
      client,
    );
    if (!subSection) throw new NotFoundException('Sub-section not found');
    if (subSection.certificate_id !== certificateId) {
      throw new BadRequestException(
        'Sub-section does not belong to this certificate',
      );
    }

    const targetMainId = dto.new_parent_id;
    if (!targetMainId) {
      throw new BadRequestException(
        'new_parent_id is required when converting sub_section to section',
      );
    }

    // Target parent is a main_section
    const targetMain = await this.certificateRepo.findMainSectionById(
      targetMainId,
      client,
    );
    if (!targetMain)
      throw new NotFoundException('Target main section not found');
    if (targetMain.certificate_id !== certificateId) {
      throw new BadRequestException(
        'Target main section does not belong to this certificate',
      );
    }

    const newRank =
      dto.new_rank ??
      (await this.certificateRepo.getMaxSectionRankForMainSection(
        client,
        targetMainId,
      )) + 1;

    // Create new section
    const newSection = await this.certificateRepo.createSectionFromName(
      client,
      certificateId,
      targetMainId,
      subSection.name,
      newRank,
    );

    // Reassign questions: flip from third_level to section-level
    await this.certificateRepo.reassignSubSectionQuestionsToSection(
      client,
      dto.item_id,
      newSection.id,
      targetMainId,
    );

    // Close rank gap in old parent section
    await this.certificateRepo.shiftSubSectionRanksForDelete(
      client,
      subSection.section_id,
      subSection.rank,
      dto.item_id,
    );

    // Delete old sub_section
    await this.certificateRepo.deleteSubSection(dto.item_id, client);
  }

  private async demoteSectionToSubSection(
    client: PoolClient,
    certificateId: string,
    dto: ReorderItemDto,
  ): Promise<void> {
    const section = await this.certificateRepo.findSectionById(
      dto.item_id,
      client,
    );
    if (!section) throw new NotFoundException('Section not found');
    if (section.certificate_id !== certificateId) {
      throw new BadRequestException(
        'Section does not belong to this certificate',
      );
    }

    const targetSectionId = dto.new_parent_id;
    if (!targetSectionId) {
      throw new BadRequestException(
        'new_parent_id is required when converting section to sub_section',
      );
    }

    // Target parent is a section
    const targetSection = await this.certificateRepo.findSectionById(
      targetSectionId,
      client,
    );
    if (!targetSection) throw new NotFoundException('Target section not found');
    if (targetSection.certificate_id !== certificateId) {
      throw new BadRequestException(
        'Target section does not belong to this certificate',
      );
    }

    const newRank =
      dto.new_rank ??
      (await this.certificateRepo.getMaxSubSectionRankForSection(
        client,
        targetSectionId,
      )) + 1;

    // Create new sub_section under target section
    const newSubSection = await this.certificateRepo.createSubSectionFromName(
      client,
      certificateId,
      targetSection.main_id,
      targetSectionId,
      section.name,
      newRank,
    );

    // Reassign questions: flip from section-level to third_level
    await this.certificateRepo.reassignSectionQuestionsToSubSection(
      client,
      dto.item_id,
      newSubSection.id,
    );

    // Close rank gap in old parent
    await this.certificateRepo.shiftSectionRanksForDelete(
      client,
      section.main_id,
      section.rank,
      dto.item_id,
    );

    // Delete old section (sub_sections under it will be orphaned — move them first)
    // Move existing sub_sections under this section to the target section
    await client.query(
      `UPDATE sub_section SET section_id = $1, main_id = $2 WHERE section_id = $3`,
      [targetSectionId, targetSection.main_id, dto.item_id],
    );

    await this.certificateRepo.deleteSection(dto.item_id, client);
  }
}
