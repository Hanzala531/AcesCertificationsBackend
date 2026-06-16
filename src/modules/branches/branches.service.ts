import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BranchRepository } from './branches.repository';
import { BranchRecord, UpdateBranchData } from './types/branch.types';
import { CreateBranchDto, UpdateBranchDto } from './dto/create-branch.dto';
import {
  validateEmailWithPolicy,
  getEmailPolicyConfigFromEnv,
} from '../../common/utils/email-policy.util';
import { DatabaseService } from '../../database/database.service';
import {
  postcodeValidator,
  postcodeValidatorExistsForCountry,
} from 'postcode-validator';

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'united states': 'US',
  usa: 'US',
  canada: 'CA',
  'united kingdom': 'GB',
  uk: 'GB',
  germany: 'DE',
  france: 'FR',
  india: 'IN',
  australia: 'AU',
  japan: 'JP',
  pakistan: 'PK',
  'united arab emirates': 'AE',
  'saudi arabia': 'SA',
};

@Injectable()
export class BranchService {
  private readonly emailPolicyConfig = getEmailPolicyConfigFromEnv();

  constructor(
    private branchRepository: BranchRepository,
    private databaseService: DatabaseService,
  ) {}

  private validateEmailPolicy(email: string): string {
    const result = validateEmailWithPolicy(email, {
      config: this.emailPolicyConfig,
      requireOrganizational: true,
    });

    if (!result.isValid) {
      throw new BadRequestException(result.reason ?? 'Invalid email');
    }

    return result.normalizedEmail;
  }

  private validatePostalCode(postalCode: string, country?: string): void {
    if (!country) return;

    // Resolve country to ISO 2-letter code
    const countryCode =
      COUNTRY_NAME_TO_CODE[country.toLowerCase()] || country.toUpperCase();

    if (!postcodeValidatorExistsForCountry(countryCode)) return;

    if (!postcodeValidator(postalCode, countryCode)) {
      throw new BadRequestException(
        `Invalid postal code "${postalCode}" for ${country}.`,
      );
    }
  }

  private async validateEmailUniqueness(
    email: string,
    organizationId: string,
    excludeBranchId?: string,
  ): Promise<void> {
    const { taken, usedBy } = await this.branchRepository.isEmailTaken(
      email,
      organizationId,
      excludeBranchId,
    );
    if (taken) {
      const msg =
        usedBy === 'organization'
          ? 'This email is already used as the organization email'
          : 'This email is already used by another branch';
      throw new BadRequestException(msg);
    }
  }

  async createBranch(
    organizationId: string,
    dto: CreateBranchDto,
  ): Promise<BranchRecord> {
    // Validate format-level checks first (no DB needed)
    let email = dto.email === '' ? undefined : dto.email;
    if (email) {
      email = this.validateEmailPolicy(email);
    }

    const postal_code = dto.postal_code === '' ? undefined : dto.postal_code;
    if (postal_code) {
      this.validatePostalCode(postal_code, dto.country);
    }

    const contact_no = dto.contact_no === '' ? undefined : dto.contact_no;

    // Wrap all DB checks + insert in a transaction so nothing persists on failure
    return this.databaseService.transaction(async (client) => {
      const existingByName =
        await this.branchRepository.findByNameAndOrganization(
          dto.name,
          organizationId,
          client,
        );
      if (existingByName) {
        throw new BadRequestException(
          'A branch with this name already exists for this organization',
        );
      }

      if (email) {
        const { taken, usedBy } = await this.branchRepository.isEmailTaken(
          email,
          organizationId,
          undefined,
          client,
        );
        if (taken) {
          const msg =
            usedBy === 'organization'
              ? 'This email is already used as the organization email'
              : 'This email is already used by another branch';
          throw new BadRequestException(msg);
        }
      }

      const existingMainBranch =
        await this.branchRepository.findMainBranchByOrganization(
          organizationId,
          client,
        );
      const isMain = existingMainBranch ? false : (dto.is_main ?? true);

      return this.branchRepository.create(
        {
          organization_id: organizationId,
          name: dto.name,
          address: dto.address,
          city: dto.city,
          state: dto.state,
          country: dto.country,
          postal_code,
          contact_no,
          email,
          branch_size: (dto as any).branch_size || null,
          is_main: isMain,
        },
        client,
      );
    });
  }

  async getBranchById(
    branchId: string,
    organizationId: string,
  ): Promise<BranchRecord> {
    const branch = await this.branchRepository.findByIdAndOrganization(
      branchId,
      organizationId,
    );
    if (!branch) {
      throw new NotFoundException(
        'Branch not found or you do not have access to it',
      );
    }
    return branch;
  }

  async getBranchesByOrganization(
    organizationId: string,
    limit: number = 10,
    offset: number = 0,
    all: boolean = false,
  ): Promise<{
    data: BranchRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    if (all) {
      const result =
        await this.branchRepository.findAllByOrganizationId(organizationId);

      if (result.total === 0) {
        const orgBranch =
          await this.branchRepository.getOrganizationAsBranch(organizationId);
        if (orgBranch) {
          return {
            data: [orgBranch],
            total: 1,
            page: 1,
            pageSize: 1,
            totalPages: 1,
          };
        }
      }

      return {
        data: result.data,
        total: result.total,
        page: 1,
        pageSize: result.total,
        totalPages: 1,
      };
    }

    const { data, total } = await this.branchRepository.findByOrganizationId(
      organizationId,
      limit,
      offset,
    );

    if (total === 0) {
      const orgBranch =
        await this.branchRepository.getOrganizationAsBranch(organizationId);
      if (orgBranch) {
        return {
          data: [orgBranch],
          total: 1,
          page: 1,
          pageSize: limit,
          totalPages: 1,
        };
      }
    }

    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      pageSize: limit,
      totalPages,
    };
  }

  async updateBranch(
    branchId: string,
    organizationId: string,
    dto: UpdateBranchDto,
  ): Promise<BranchRecord> {
    const existingBranch = await this.branchRepository.findByIdAndOrganization(
      branchId,
      organizationId,
    );
    if (!existingBranch) {
      throw new NotFoundException(
        'Branch not found or you do not have access to it',
      );
    }

    const updateData: UpdateBranchData = {};
    if (dto.name !== undefined) {
      // If updating name, ensure it doesn't collide with another branch in the same organization
      const existingByName =
        await this.branchRepository.findByNameAndOrganization(
          dto.name,
          organizationId,
        );
      if (existingByName && existingByName.id !== branchId) {
        throw new BadRequestException(
          'A branch with this name already exists for this organization',
        );
      }

      updateData.name = dto.name;
    }
    if (dto.email !== undefined && dto.email !== '') {
      const validatedEmail = this.validateEmailPolicy(dto.email);
      dto.email = validatedEmail;
      await this.validateEmailUniqueness(dto.email, organizationId, branchId);
    }

    const effectiveCountry = dto.country ?? existingBranch.country;
    if (dto.postal_code !== undefined && dto.postal_code !== '') {
      this.validatePostalCode(dto.postal_code, effectiveCountry ?? undefined);
    }

    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.state !== undefined) updateData.state = dto.state;
    if (dto.country !== undefined) updateData.country = dto.country;
    if (dto.postal_code !== undefined) updateData.postal_code = dto.postal_code;
    if (dto.contact_no !== undefined) updateData.contact_no = dto.contact_no;
    if (dto.email !== undefined) updateData.email = dto.email;
    if ((dto as any).branch_size !== undefined)
      updateData.branch_size = (dto as any).branch_size;

    const updated = await this.branchRepository.update(branchId, updateData);
    if (!updated) {
      throw new NotFoundException('Failed to update branch');
    }
    return updated;
  }

  async deleteBranch(branchId: string, organizationId: string): Promise<void> {
    const branch = await this.branchRepository.findByIdAndOrganization(
      branchId,
      organizationId,
    );
    if (!branch) {
      throw new NotFoundException(
        'Branch not found or you do not have access to it',
      );
    }

    await this.branchRepository.delete(branchId);
  }

  async setMainBranch(
    branchId: string,
    organizationId: string,
  ): Promise<BranchRecord> {
    const branch = await this.branchRepository.findByIdAndOrganization(
      branchId,
      organizationId,
    );
    if (!branch) {
      throw new NotFoundException(
        'Branch not found or you do not have access to it',
      );
    }

    const updated = await this.branchRepository.updateMainBranch(
      branchId,
      organizationId,
    );
    if (!updated) {
      throw new NotFoundException('Failed to update main branch');
    }
    return updated;
  }
}
