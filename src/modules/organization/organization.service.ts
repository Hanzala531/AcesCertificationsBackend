import { Injectable, ConflictException } from '@nestjs/common';
import {
  OrganizationRepository,
  OrganizationRecord,
  IssuedCertificateRow,
} from './organization.repository';

@Injectable()
export class OrganizationService {
  constructor(private organizationRepository: OrganizationRepository) {}

  async create(
    userId: string,
    data: {
      name: string;
      industry_ids: string[];
      business_id: string;
      legal_country: string;
      legal_state: string;
      legal_city?: string;
      description: string;
      contact_no?: string;
      email?: string;
      website?: string;
    },
  ): Promise<OrganizationRecord> {
    // Check for duplicate email
    if (data.email) {
      const existingOrgWithEmail =
        await this.organizationRepository.findByEmail(data.email);
      if (existingOrgWithEmail) {
        throw new ConflictException(
          'An organization with this email already exists',
        );
      }
    }

    // Check for duplicate contact number
    if (data.contact_no) {
      const existingOrgWithContactNo =
        await this.organizationRepository.findByContactNo(data.contact_no);
      if (existingOrgWithContactNo) {
        throw new ConflictException(
          'An organization with this phone number already exists',
        );
      }
    }

    return this.organizationRepository.create(userId, data);
  }

  async findByUserId(userId: string): Promise<OrganizationRecord | null> {
    return this.organizationRepository.findByUserId(userId);
  }

  async findByBusinessId(
    businessId: string,
  ): Promise<OrganizationRecord | null> {
    return this.organizationRepository.findByBusinessId(businessId);
  }

  async findById(id: string): Promise<OrganizationRecord | null> {
    return this.organizationRepository.findById(id);
  }

  async findByEmail(email: string): Promise<OrganizationRecord | null> {
    return this.organizationRepository.findByEmail(email);
  }

  async findByContactNo(contactNo: string): Promise<OrganizationRecord | null> {
    return this.organizationRepository.findByContactNo(contactNo);
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      contact_no: string;
      email: string;
      website: string;
      logo: string;
      industry_id: string;
      description: string;
      legal_country: string;
      legal_state: string;
      legal_city: string;
      organization_type: string;
      total_branches: number;
      legal_document_url: string;
      company_size: string;
      industry_ids: string[];
    }>,
  ): Promise<OrganizationRecord> {
    // Check for duplicate email
    if (data.email) {
      const existingOrgWithEmail =
        await this.organizationRepository.findByEmail(data.email);
      if (existingOrgWithEmail && existingOrgWithEmail.id !== id) {
        throw new ConflictException(
          'An organization with this email already exists',
        );
      }
    }

    // Check for duplicate contact number
    if (data.contact_no) {
      const existingOrgWithContactNo =
        await this.organizationRepository.findByContactNo(data.contact_no);
      if (existingOrgWithContactNo && existingOrgWithContactNo.id !== id) {
        throw new ConflictException(
          'An organization with this phone number already exists',
        );
      }
    }

    return this.organizationRepository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return this.organizationRepository.delete(id);
  }

  async getIssuedCertificates(
    organizationId: string,
    limit: number,
    offset: number,
  ): Promise<{ data: IssuedCertificateRow[]; total: number }> {
    return this.organizationRepository.getIssuedCertificates(
      organizationId,
      limit,
      offset,
    );
  }
}
