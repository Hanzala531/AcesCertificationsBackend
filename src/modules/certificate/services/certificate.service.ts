import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CertificateRepository } from '../certificate.repository';
import { OrganizationRepository } from '../../organization/organization.repository';
import { EmployeeRepository } from '../../employee/employee.repository';
import { CreateCertificateDto } from '../dto/create-certificate.dto';
import { UpdateCertificateDto } from '../dto/update-certificate.dto';
import {
  Certificate,
  Badge,
  MainSection,
  Section,
  SubSection,
  Question,
} from '../types/certificate.types';
import { handleDatabaseError } from '../utils/database-error.util';

type SubSectionWithQuestions = SubSection & { questions: Question[] };
type SectionWithDetails = Section & {
  questions: Question[];
  sub_sections: SubSectionWithQuestions[];
};
type MainSectionWithSections = MainSection & { sections: SectionWithDetails[] };
type CertificateDetails = Certificate & {
  badges: Badge[];
  main_sections: MainSectionWithSections[];
};

@Injectable()
export class CertificateService {
  constructor(
    private readonly certificateRepo: CertificateRepository,
    private readonly organizationRepo: OrganizationRepository,
    private readonly employeeRepo: EmployeeRepository,
  ) {}

  async createCertificate(
    dto: CreateCertificateDto,
    userId?: string,
  ): Promise<{ id: string; certificate_id: string }> {
    const client = await this.certificateRepo.beginTransaction();

    try {
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

      await this.certificateRepo.commitTransaction(client);

      return {
        id: certificate.id,
        certificate_id: dto.certificate_id,
      };
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      handleDatabaseError(error);
    }
  }

  async updateCertificate(
    certificateId: string,
    dto: UpdateCertificateDto,
    userId?: string,
  ): Promise<{ id: string; certificate_id: string }> {
    const certificate =
      await this.certificateRepo.findCertificateById(certificateId);
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    const client = await this.certificateRepo.beginTransaction();

    try {
      await this.certificateRepo.updateCertificate(client, certificateId, {
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
        updated_by: userId,
      });

      if (dto.short_code !== undefined) {
        await this.certificateRepo.recalculateHierarchicalShortCodes(
          client,
          certificateId,
        );
      }

      if (dto.badges !== undefined) {
        await this.certificateRepo.deleteBadgesByCertificateId(
          client,
          certificateId,
        );

        for (const badgeDto of dto.badges) {
          const badge = await this.certificateRepo.createBadge(client, {
            certificate_id: certificateId,
            slot: badgeDto.slot,
            name: badgeDto.name,
          });

          await this.certificateRepo.createBadgeColors(
            client,
            badge.id,
            badgeDto.colors,
          );
        }
      }

      await this.certificateRepo.commitTransaction(client);

      const updated =
        await this.certificateRepo.findCertificateById(certificateId);

      return {
        id: updated!.id,
        certificate_id: updated!.certificate_id,
      };
    } catch (error) {
      await this.certificateRepo.rollbackTransaction(client);
      handleDatabaseError(error);
    }
  }

  async deleteCertificate(certificateId: string): Promise<{ message: string }> {
    const certificate =
      await this.certificateRepo.findCertificateById(certificateId);
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    await this.certificateRepo.deleteCertificate(certificateId);
    return { message: 'Certificate deleted successfully' };
  }

  async publishCertificate(
    certificateId: string,
  ): Promise<{ message: string }> {
    const certificate =
      await this.certificateRepo.findCertificateById(certificateId);
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    if (certificate.is_published) {
      throw new BadRequestException('Certificate is already published');
    }

    await this.certificateRepo.publishCertificate(certificateId);
    return { message: 'Certificate published successfully' };
  }

  async unpublishCertificate(
    certificateId: string,
  ): Promise<{ message: string }> {
    const certificate =
      await this.certificateRepo.findCertificateById(certificateId);
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    if (!certificate.is_published) {
      throw new BadRequestException('Certificate is already unpublished');
    }

    await this.certificateRepo.unpublishCertificate(certificateId);
    return { message: 'Certificate unpublished successfully' };
  }

  async getCertificates(params: {
    userId: string;
    userRole: string;
    page: number;
    limit: number;
    industryId?: string;
    minPrice?: number;
    maxPrice?: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: Array<
      Omit<Certificate, 'created_by'> & {
        created_by?: {
          id: string | null;
          role: string | null;
          name: string | null;
        };
        industry_name?: string;
        badges_count?: number;
        sections_count?: number;
        questions_count?: number;
        total_assessments_done?: number;
        total_people_received?: number;
      }
    >;
    total: number;
    page: number;
    limit: number;
  }> {
    const { userId, userRole, ...queryParams } = params;

    if (userRole === 'organization' || userRole === 'organization_member') {
      const recommendedIndustryIds = await this.getIndustryIdsForUser(
        userId,
        userRole,
      );
      const result = await this.certificateRepo.findCertificates({
        ...queryParams,
        onlyPublished: true,
        prioritizeIndustryIds: recommendedIndustryIds,
      });
      return {
        ...result,
        data: result.data.map((certificate) => {
          const { created_by_id, created_by_role, created_by_name, ...rest } =
            certificate;
          return {
            ...rest,
            created_by: {
              id: created_by_id ?? certificate.created_by ?? null,
              role: created_by_role ?? null,
              name: created_by_name ?? null,
            },
          };
        }),
      };
    }

    const result = await this.certificateRepo.findCertificates(queryParams);
    return {
      ...result,
      data: result.data.map((certificate) => {
        const { created_by_id, created_by_role, created_by_name, ...rest } =
          certificate;
        return {
          ...rest,
          created_by: {
            id: created_by_id ?? certificate.created_by ?? null,
            role: created_by_role ?? null,
            name: created_by_name ?? null,
          },
        };
      }),
    };
  }

  async getCertificatesLite(params: { page: number; limit: number }): Promise<{
    data: Array<{ id: string; name: string; product_id: string }>;
    total: number;
    page: number;
    limit: number;
  }> {
    return this.certificateRepo.findCertificatesLite(params);
  }

  async getCertificateById(certificateId: string): Promise<CertificateDetails> {
    const certificate =
      await this.certificateRepo.findCertificateWithDetails(certificateId);
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }
    return certificate;
  }

  private async getIndustryIdsForUser(
    userId: string,
    userRole: string,
  ): Promise<string[]> {
    if (userRole === 'organization') {
      const org = await this.organizationRepo.findByUserId(userId);
      return org?.industry_ids || [];
    }

    if (userRole === 'organization_member') {
      const employee = await this.employeeRepo.findByUserId(userId);
      if (!employee) {
        return [];
      }
      const org = await this.organizationRepo.findById(
        employee.organization_id,
      );
      return org?.industry_ids || [];
    }

    return [];
  }
}
