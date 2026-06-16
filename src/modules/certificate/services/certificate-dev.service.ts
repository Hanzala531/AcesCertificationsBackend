import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CertificateRepository } from '../certificate.repository';
import {
  DevCreateCertificateDto,
  DevBulkQuestionsDto,
} from '../dto/dev-create-certificate.dto';
import { CreatedQuestion } from '../types/certificate.types';
import { handleDatabaseError } from '../utils/database-error.util';

@Injectable()
export class CertificateDevService {
  constructor(private readonly certificateRepo: CertificateRepository) {}

  async devCreateCompleteStructure(
    dto: DevCreateCertificateDto,
    userId?: string,
  ) {
    const client = await this.certificateRepo.beginTransaction();

    try {
      // 1. Create certificate
      const certificate = await this.certificateRepo.createCertificate(client, {
        certificate_id: dto.certificate_id,
        short_code: dto.short_code,
        name: dto.name,
        industry_ids: dto.industry_ids,
        disclosure_price: dto.disclosure_price,
        assured_price: dto.assured_price,
        validity_days: dto.validity_days,
        validity_months: dto.validity_months,
        validity_years: dto.validity_years,
        compulsory_docs: dto.compulsory_docs,
        description: dto.description,
        is_published: dto.is_published,
        created_by: userId,
      });

      // 2. Create badges + colors
      for (const badgeDto of dto.badges) {
        const badge = await this.certificateRepo.createBadge(client, {
          certificate_id: certificate.id,
          slot: badgeDto.slot,
          name: badgeDto.name,
        });
        await this.certificateRepo.createBadgeColors(
          client,
          badge.id,
          badgeDto.colors,
        );
      }

      // 3. Create main_sections -> sections -> sub_sections
      const structure: Array<{
        id: string;
        name: string;
        rank: number;
        sections: Array<{
          id: string;
          name: string;
          rank: number;
          sub_sections: Array<{ id: string; name: string; rank: number }>;
        }>;
      }> = [];

      let mainRank = 0;
      for (const mainDto of dto.main_sections) {
        mainRank++;
        const mainSection = await this.certificateRepo.createMainSection(
          client,
          {
            certificate_id: certificate.id,
            name: mainDto.name,
            rank: mainRank,
          },
        );

        const sectionsResult: Array<{
          id: string;
          name: string;
          rank: number;
          sub_sections: Array<{ id: string; name: string; rank: number }>;
        }> = [];

        let sectionRank = 0;
        for (const sectionDto of mainDto.sections) {
          sectionRank++;
          const section = await this.certificateRepo.createSection(client, {
            certificate_id: certificate.id,
            main_id: mainSection.id,
            name: sectionDto.name,
            rank: sectionRank,
          });

          const subSectionsResult: Array<{
            id: string;
            name: string;
            rank: number;
          }> = [];

          if (sectionDto.sub_sections) {
            let subRank = 0;
            for (const subDto of sectionDto.sub_sections) {
              subRank++;
              const subSection = await this.certificateRepo.createSubSection(
                client,
                {
                  certificate_id: certificate.id,
                  main_id: mainSection.id,
                  section_id: section.id,
                  name: subDto.name,
                  rank: subRank,
                },
              );
              subSectionsResult.push({
                id: subSection.id,
                name: subDto.name,
                rank: subRank,
              });
            }
          }

          sectionsResult.push({
            id: section.id,
            name: sectionDto.name,
            rank: sectionRank,
            sub_sections: subSectionsResult,
          });
        }

        structure.push({
          id: mainSection.id,
          name: mainDto.name,
          rank: mainRank,
          sections: sectionsResult,
        });
      }

      await this.certificateRepo.recalculateHierarchicalShortCodes(
        client,
        certificate.id,
      );
      await this.certificateRepo.commitTransaction(client);

      return {
        id: certificate.id,
        certificate_id: dto.certificate_id,
        name: dto.name,
        main_sections: structure,
      };
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      handleDatabaseError(error);
    }
  }

  async devBulkAddQuestions(certificateId: string, dto: DevBulkQuestionsDto) {
    const cert = await this.certificateRepo.findCertificateById(certificateId);
    if (!cert) {
      throw new NotFoundException(
        `Certificate with ID "${certificateId}" not found`,
      );
    }

    const client = await this.certificateRepo.beginTransaction();
    try {
      const results: Array<{
        section_id: string;
        section_type: string;
        questions_added: number;
        questions: CreatedQuestion[];
      }> = [];

      let currentMaxCertNumber =
        await this.certificateRepo.getMaxCertificateQuestionNumber(
          client,
          certificateId,
        );

      for (const entry of dto.entries) {
        const entryQuestions: CreatedQuestion[] = [];

        // Auto-detect: try sub_section first, then section
        const subSection = await this.certificateRepo.findSubSectionById(
          entry.section_id,
          client,
        );

        if (subSection) {
          // It's a sub_section
          if (subSection.certificate_id !== certificateId) {
            throw new BadRequestException(
              `Sub-section "${entry.section_id}" does not belong to certificate "${certificateId}"`,
            );
          }

          let currentMaxRank =
            await this.certificateRepo.getMaxQuestionRankForSubSection(
              client,
              entry.section_id,
            );
          let currentMaxNumber =
            await this.certificateRepo.getMaxQuestionNumberForSubSection(
              client,
              entry.section_id,
            );

          for (const q of entry.questions) {
            const rank = ++currentMaxRank;
            const questionNumber = ++currentMaxNumber;
            const certQuestionNumber = ++currentMaxCertNumber;

            const question =
              await this.certificateRepo.createQuestionForSubSection(client, {
                certificate_id: certificateId,
                main_section_id: subSection.main_id,
                section_id: subSection.section_id,
                sub_section_id: entry.section_id,
                question: q.question,
                hint: q.hint,
                type: q.type,
                criteria: q.criteria,
                rank,
                question_number: questionNumber,
                certificate_question_number: certQuestionNumber,
                options: q.options,
              });

            entryQuestions.push(question);
          }

          results.push({
            section_id: entry.section_id,
            section_type: 'sub_section',
            questions_added: entryQuestions.length,
            questions: entryQuestions,
          });
        } else {
          // Try as a section
          const section = await this.certificateRepo.findSectionById(
            entry.section_id,
            client,
          );
          if (!section) {
            throw new NotFoundException(
              `No section or sub-section found with ID "${entry.section_id}"`,
            );
          }
          if (section.certificate_id !== certificateId) {
            throw new BadRequestException(
              `Section "${entry.section_id}" does not belong to certificate "${certificateId}"`,
            );
          }

          let currentMaxRank =
            await this.certificateRepo.getMaxQuestionRankForSection(
              client,
              entry.section_id,
            );
          let currentMaxNumber =
            await this.certificateRepo.getMaxQuestionNumberForSection(
              client,
              entry.section_id,
            );

          for (const q of entry.questions) {
            const rank = ++currentMaxRank;
            const questionNumber = ++currentMaxNumber;
            const certQuestionNumber = ++currentMaxCertNumber;

            const question =
              await this.certificateRepo.createQuestionForSection(client, {
                certificate_id: certificateId,
                main_section_id: section.main_id,
                section_id: entry.section_id,
                question: q.question,
                hint: q.hint,
                type: q.type,
                criteria: q.criteria,
                rank,
                question_number: questionNumber,
                certificate_question_number: certQuestionNumber,
                options: q.options,
              });

            entryQuestions.push(question);
          }

          results.push({
            section_id: entry.section_id,
            section_type: 'section',
            questions_added: entryQuestions.length,
            questions: entryQuestions,
          });
        }
      }

      await this.certificateRepo.recalculateHierarchicalShortCodes(
        client,
        certificateId,
      );
      await this.certificateRepo.commitTransaction(client);
      return results;
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
}
