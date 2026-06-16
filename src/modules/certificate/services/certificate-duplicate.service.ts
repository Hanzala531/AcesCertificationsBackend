import { Injectable, NotFoundException } from '@nestjs/common';
import { CertificateRepository } from '../certificate.repository';
import { handleDatabaseError } from '../utils/database-error.util';

@Injectable()
export class CertificateDuplicateService {
  constructor(private readonly certificateRepo: CertificateRepository) {}

  async duplicateCertificate(
    certificateId: string,
    userId?: string,
  ): Promise<{ id: string; certificate_id: string; name: string }> {
    const sourceCertificate =
      await this.certificateRepo.findCertificateWithDetails(certificateId);
    if (!sourceCertificate) {
      throw new NotFoundException('Certificate not found');
    }

    const newCertificateProductId = await this.generateVersionedCertificateId(
      sourceCertificate.certificate_id,
    );
    const versionMatch = newCertificateProductId.match(/-v(\d+)$/i);
    const versionNumber = versionMatch ? Number(versionMatch[1]) : 2;
    const newCertificateName = this.generateVersionedCertificateName(
      sourceCertificate.name,
      versionNumber,
    );
    const newShortCode = this.generateVersionedShortCode(
      sourceCertificate.short_code,
      versionNumber,
      newCertificateProductId,
    );

    const client = await this.certificateRepo.beginTransaction();
    try {
      const createdCertificate = await this.certificateRepo.createCertificate(
        client,
        {
          certificate_id: newCertificateProductId,
          short_code: newShortCode,
          name: newCertificateName,
          industry_ids: sourceCertificate.industry_ids || [],
          disclosure_price: sourceCertificate.disclosure_price,
          assured_price: sourceCertificate.assured_price,
          validity_days: sourceCertificate.validity_days,
          validity_months: sourceCertificate.validity_months,
          validity_years: sourceCertificate.validity_years,
          compulsory_docs: sourceCertificate.compulsory_docs,
          description: sourceCertificate.description,
          // Duplicates always start unpublished so admins can review/adjust before releasing.
          is_published: false,
          created_by: userId,
        },
      );

      // Duplicate badges + colors
      if (sourceCertificate.badges && sourceCertificate.badges.length > 0) {
        for (const badge of sourceCertificate.badges) {
          const createdBadge = await this.certificateRepo.createBadge(client, {
            certificate_id: createdCertificate.id,
            slot: badge.slot,
            name: badge.name,
          });

          const colors = Array.isArray((badge as any).colors)
            ? ((badge as any).colors as Array<{
                color: string;
                min_score: number;
                max_score: number;
              }>)
            : [];

          if (colors.length > 0) {
            await this.certificateRepo.createBadgeColors(
              client,
              createdBadge.id,
              colors,
            );
          }
        }
      }

      // Duplicate hierarchy: main_section -> section -> sub_section + questions
      if (
        sourceCertificate.main_sections &&
        sourceCertificate.main_sections.length > 0
      ) {
        for (const sourceMainSection of sourceCertificate.main_sections) {
          const createdMainSection =
            await this.certificateRepo.createMainSection(client, {
              certificate_id: createdCertificate.id,
              name: sourceMainSection.name,
              rank: sourceMainSection.rank,
            });

          for (const sourceSection of sourceMainSection.sections || []) {
            const createdSection = await this.certificateRepo.createSection(
              client,
              {
                certificate_id: createdCertificate.id,
                main_id: createdMainSection.id,
                name: sourceSection.name,
                rank: sourceSection.rank,
              },
            );

            for (const sourceQuestion of sourceSection.questions || []) {
              await this.certificateRepo.createQuestionForSection(client, {
                certificate_id: createdCertificate.id,
                main_section_id: createdMainSection.id,
                section_id: createdSection.id,
                question: sourceQuestion.question,
                hint: sourceQuestion.hint,
                type: sourceQuestion.type,
                criteria: sourceQuestion.criteria,
                ai_review_enabled: sourceQuestion.ai_review_enabled,
                ai_review_criteria: sourceQuestion.ai_review_criteria,
                ai_review_score: sourceQuestion.ai_review_score,
                yes_score: sourceQuestion.yes_score,
                no_score: sourceQuestion.no_score,
                conditional_logic_enabled:
                  sourceQuestion.conditional_logic_enabled,
                conditional_logic: sourceQuestion.conditional_logic,
                rank: sourceQuestion.rank,
                question_number: sourceQuestion.question_number,
                certificate_question_number:
                  sourceQuestion.certificate_question_number,
                is_compulsory: sourceQuestion.is_compulsory,
                options: sourceQuestion.options || undefined,
              });
            }

            for (const sourceSubSection of sourceSection.sub_sections || []) {
              const createdSubSection =
                await this.certificateRepo.createSubSection(client, {
                  certificate_id: createdCertificate.id,
                  main_id: createdMainSection.id,
                  section_id: createdSection.id,
                  name: sourceSubSection.name,
                  rank: sourceSubSection.rank,
                });

              for (const sourceQuestion of sourceSubSection.questions || []) {
                await this.certificateRepo.createQuestionForSubSection(client, {
                  certificate_id: createdCertificate.id,
                  main_section_id: createdMainSection.id,
                  section_id: createdSection.id,
                  sub_section_id: createdSubSection.id,
                  question: sourceQuestion.question,
                  hint: sourceQuestion.hint,
                  type: sourceQuestion.type,
                  criteria: sourceQuestion.criteria,
                  ai_review_enabled: sourceQuestion.ai_review_enabled,
                  ai_review_criteria: sourceQuestion.ai_review_criteria,
                  ai_review_score: sourceQuestion.ai_review_score,
                  yes_score: sourceQuestion.yes_score,
                  no_score: sourceQuestion.no_score,
                  conditional_logic_enabled:
                    sourceQuestion.conditional_logic_enabled,
                  conditional_logic: sourceQuestion.conditional_logic,
                  rank: sourceQuestion.rank,
                  question_number: sourceQuestion.question_number,
                  certificate_question_number:
                    sourceQuestion.certificate_question_number,
                  is_compulsory: sourceQuestion.is_compulsory,
                  options: sourceQuestion.options || undefined,
                });
              }
            }
          }
        }
      }

      await this.certificateRepo.recalculateHierarchicalShortCodes(
        client,
        createdCertificate.id,
      );
      await this.certificateRepo.commitTransaction(client);

      return {
        id: createdCertificate.id,
        certificate_id: newCertificateProductId,
        name: newCertificateName,
      };
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      handleDatabaseError(error);
    }
  }

  private async generateVersionedCertificateId(
    sourceCertificateId: string,
  ): Promise<string> {
    const baseId = sourceCertificateId.replace(/-v\d+$/i, '');
    const maxVersion = await this.certificateRepo.findMaxVersionByCertificateIdBase(baseId);
    return `${baseId}-v${maxVersion + 1}`;
  }

  private generateVersionedCertificateName(
    sourceCertificateName: string,
    version: number,
  ): string {
    const cleaned = sourceCertificateName.replace(/\s+\(Version\s+\d+\)$/i, '');
    return `${cleaned} (Version ${version})`;
  }

  private generateVersionedShortCode(
    sourceShortCode: string | null | undefined,
    version: number,
    fallback: string,
  ): string {
    const root = sourceShortCode?.replace(/-V\d+$/i, '') || fallback;
    return `${root}-V${version}`;
  }
}
