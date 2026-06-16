import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from '../organization.service';
import {
  OrganizationRepository,
  OrganizationRecord,
} from '../organization.repository';
import { NotFoundException } from '@nestjs/common';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let organizationRepository: jest.Mocked<OrganizationRepository>;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockOrgId = '550e8400-e29b-41d4-a716-446655440001';
  const mockBusinessId = 'BIZ-123456';
  const mockIndustryId = '550e8400-e29b-41d4-a716-446655440002';

  const mockOrganization: OrganizationRecord = {
    id: mockOrgId,
    name: 'Test Organization',
    user_id: mockUserId,
    email: 'test@org.com',
    contact_no: '+1234567890',
    company_size: 'medium',
    website: 'https://testorg.com',
    logo: 'https://testorg.com/logo.png',
    industry_ids: [mockIndustryId],
    total_branches: 3,
    organization_type: 'corporation',
    business_id: mockBusinessId,
    legal_city: 'New York',
    legal_state: 'NY',
    legal_country: 'USA',
    description: 'A test organization',
    legal_document_url: 'https://testorg.com/legal.pdf',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockOrganizationRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findByBusinessId: jest.fn(),
      findById: jest.fn(),
      findByContactNo: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: OrganizationRepository,
          useValue: mockOrganizationRepository,
        },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    organizationRepository = module.get(OrganizationRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create organization successfully', async () => {
      const createData = {
        name: 'New Organization',
        industry_ids: [mockIndustryId],
        business_id: mockBusinessId,
        legal_country: 'USA',
        legal_state: 'CA',
        legal_city: 'San Francisco',
        description: 'A new organization',
        contact_no: '+9876543210',
        website: 'https://neworg.com',
      };

      organizationRepository.create.mockResolvedValue(mockOrganization);

      const result = await service.create(mockUserId, createData);

      expect(result).toEqual(mockOrganization);
      expect(organizationRepository.create).toHaveBeenCalledWith(
        mockUserId,
        createData,
      );
    });

    it('should create organization with minimal required fields', async () => {
      const createData = {
        name: 'Minimal Organization',
        industry_ids: [mockIndustryId],
        business_id: mockBusinessId,
        legal_country: 'Canada',
        legal_state: 'Ontario',
        description: 'Minimal organization description',
      };

      organizationRepository.create.mockResolvedValue({
        ...mockOrganization,
        name: createData.name,
        business_id: createData.business_id,
        legal_country: createData.legal_country,
        legal_state: createData.legal_state,
        description: createData.description,
        contact_no: undefined,
        website: undefined,
        legal_city: undefined,
      });

      const result = await service.create(mockUserId, createData);

      expect(result.name).toBe(createData.name);
      expect(organizationRepository.create).toHaveBeenCalledWith(
        mockUserId,
        createData,
      );
    });

    it('should create organization with multiple industry IDs', async () => {
      const createData = {
        name: 'Multi-Industry Organization',
        industry_ids: [mockIndustryId, 'industry-2', 'industry-3'],
        business_id: mockBusinessId,
        legal_country: 'UK',
        legal_state: 'London',
        description: 'Multi-industry organization',
      };

      organizationRepository.create.mockResolvedValue({
        ...mockOrganization,
        name: createData.name,
        industry_ids: createData.industry_ids,
        legal_country: createData.legal_country,
        legal_state: createData.legal_state,
        description: createData.description,
      });

      const result = await service.create(mockUserId, createData);

      expect(result.industry_ids).toEqual(createData.industry_ids);
      expect(organizationRepository.create).toHaveBeenCalledWith(
        mockUserId,
        createData,
      );
    });
  });

  describe('findByUserId', () => {
    it('should find organization by user ID', async () => {
      organizationRepository.findByUserId.mockResolvedValue(mockOrganization);

      const result = await service.findByUserId(mockUserId);

      expect(result).toEqual(mockOrganization);
      expect(organizationRepository.findByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
    });

    it('should return null when organization not found by user ID', async () => {
      organizationRepository.findByUserId.mockResolvedValue(null);

      const result = await service.findByUserId('nonexistent-user-id');

      expect(result).toBeNull();
      expect(organizationRepository.findByUserId).toHaveBeenCalledWith(
        'nonexistent-user-id',
      );
    });
  });

  describe('findByBusinessId', () => {
    it('should find organization by business ID', async () => {
      organizationRepository.findByBusinessId.mockResolvedValue(
        mockOrganization,
      );

      const result = await service.findByBusinessId(mockBusinessId);

      expect(result).toEqual(mockOrganization);
      expect(organizationRepository.findByBusinessId).toHaveBeenCalledWith(
        mockBusinessId,
      );
    });

    it('should return null when organization not found by business ID', async () => {
      organizationRepository.findByBusinessId.mockResolvedValue(null);

      const result = await service.findByBusinessId('NONEXISTENT-BIZ-ID');

      expect(result).toBeNull();
      expect(organizationRepository.findByBusinessId).toHaveBeenCalledWith(
        'NONEXISTENT-BIZ-ID',
      );
    });
  });

  describe('findById', () => {
    it('should find organization by ID', async () => {
      organizationRepository.findById.mockResolvedValue(mockOrganization);

      const result = await service.findById(mockOrgId);

      expect(result).toEqual(mockOrganization);
      expect(organizationRepository.findById).toHaveBeenCalledWith(mockOrgId);
    });

    it('should return null when organization not found by ID', async () => {
      organizationRepository.findById.mockResolvedValue(null);

      const result = await service.findById('nonexistent-org-id');

      expect(result).toBeNull();
      expect(organizationRepository.findById).toHaveBeenCalledWith(
        'nonexistent-org-id',
      );
    });
  });

  describe('update', () => {
    it('should update organization name', async () => {
      const updateData = { name: 'Updated Organization Name' };
      const updatedOrganization = {
        ...mockOrganization,
        name: updateData.name,
      };

      organizationRepository.update.mockResolvedValue(updatedOrganization);

      const result = await service.update(mockOrgId, updateData);

      expect(result.name).toBe(updateData.name);
      expect(organizationRepository.update).toHaveBeenCalledWith(
        mockOrgId,
        updateData,
      );
    });

    it('should update organization contact information', async () => {
      const updateData = {
        contact_no: '+15551234567',
        website: 'https://updated-website.com',
        email: 'updated@org.com',
      };
      const updatedOrganization = { ...mockOrganization, ...updateData };

      organizationRepository.update.mockResolvedValue(updatedOrganization);

      const result = await service.update(mockOrgId, updateData);

      expect(result.contact_no).toBe(updateData.contact_no);
      expect(result.website).toBe(updateData.website);
      expect(organizationRepository.update).toHaveBeenCalledWith(
        mockOrgId,
        updateData,
      );
    });

    it('should update organization legal information', async () => {
      const updateData = {
        legal_country: 'Germany',
        legal_state: 'Bavaria',
        legal_city: 'Munich',
        organization_type: 'GmbH',
      };
      const updatedOrganization = { ...mockOrganization, ...updateData };

      organizationRepository.update.mockResolvedValue(updatedOrganization);

      const result = await service.update(mockOrgId, updateData);

      expect(result.legal_country).toBe(updateData.legal_country);
      expect(result.legal_state).toBe(updateData.legal_state);
      expect(result.legal_city).toBe(updateData.legal_city);
      expect(result.organization_type).toBe(updateData.organization_type);
      expect(organizationRepository.update).toHaveBeenCalledWith(
        mockOrgId,
        updateData,
      );
    });

    it('should update organization profile information', async () => {
      const updateData = {
        description: 'Updated organization description',
        logo: 'https://updated-logo.png',
        total_branches: 5,
        legal_document_url: 'https://updated-legal.pdf',
      };
      const updatedOrganization = { ...mockOrganization, ...updateData };

      organizationRepository.update.mockResolvedValue(updatedOrganization);

      const result = await service.update(mockOrgId, updateData);

      expect(result.description).toBe(updateData.description);
      expect(result.logo).toBe(updateData.logo);
      expect(result.total_branches).toBe(updateData.total_branches);
      expect(result.legal_document_url).toBe(updateData.legal_document_url);
      expect(organizationRepository.update).toHaveBeenCalledWith(
        mockOrgId,
        updateData,
      );
    });

    it('should update multiple fields at once', async () => {
      const updateData = {
        name: 'Completely Updated Organization',
        contact_no: '+19998887777',
        website: 'https://completely-new.com',
        legal_country: 'France',
        legal_state: 'Île-de-France',
        legal_city: 'Paris',
        description: 'Completely updated description',
        total_branches: 10,
        organization_type: 'SA',
      };
      const updatedOrganization = { ...mockOrganization, ...updateData };

      organizationRepository.update.mockResolvedValue(updatedOrganization);

      const result = await service.update(mockOrgId, updateData);

      expect(result).toEqual(updatedOrganization);
      expect(organizationRepository.update).toHaveBeenCalledWith(
        mockOrgId,
        updateData,
      );
    });

    it('should handle empty update data', async () => {
      const updateData = {};

      organizationRepository.update.mockResolvedValue(mockOrganization);

      const result = await service.update(mockOrgId, updateData);

      expect(result).toEqual(mockOrganization);
      expect(organizationRepository.update).toHaveBeenCalledWith(
        mockOrgId,
        updateData,
      );
    });

    it('should update partial organization information', async () => {
      const updateData = { description: 'New description only' };
      const updatedOrganization = {
        ...mockOrganization,
        description: updateData.description,
      };

      organizationRepository.update.mockResolvedValue(updatedOrganization);

      const result = await service.update(mockOrgId, updateData);

      expect(result.description).toBe(updateData.description);
      expect(result.name).toBe(mockOrganization.name); // Other fields should remain unchanged
      expect(organizationRepository.update).toHaveBeenCalledWith(
        mockOrgId,
        updateData,
      );
    });
  });

  describe('delete', () => {
    it('should delete organization successfully', async () => {
      organizationRepository.delete.mockResolvedValue(true);

      const result = await service.delete(mockOrgId);

      expect(result).toBe(true);
      expect(organizationRepository.delete).toHaveBeenCalledWith(mockOrgId);
    });

    it('should return false when organization not found for deletion', async () => {
      organizationRepository.delete.mockResolvedValue(false);

      const result = await service.delete('nonexistent-org-id');

      expect(result).toBe(false);
      expect(organizationRepository.delete).toHaveBeenCalledWith(
        'nonexistent-org-id',
      );
    });

    it('should handle organization deletion with proper error handling', async () => {
      organizationRepository.delete.mockResolvedValue(true);

      await expect(service.delete(mockOrgId)).resolves.toBe(true);
      expect(organizationRepository.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete organization lifecycle', async () => {
      // Create
      const createData = {
        name: 'Lifecycle Organization',
        industry_ids: [mockIndustryId],
        business_id: mockBusinessId,
        legal_country: 'USA',
        legal_state: 'CA',
        description: 'Organization for lifecycle testing',
      };
      organizationRepository.create.mockResolvedValue(mockOrganization);

      const createdOrg = await service.create(mockUserId, createData);
      expect(createdOrg).toEqual(mockOrganization);

      // Find by ID
      organizationRepository.findById.mockResolvedValue(mockOrganization);
      const foundOrg = await service.findById(mockOrgId);
      expect(foundOrg).toEqual(mockOrganization);

      // Update
      const updateData = { name: 'Updated Lifecycle Organization' };
      const updatedOrg = { ...mockOrganization, name: updateData.name };
      organizationRepository.update.mockResolvedValue(updatedOrg);

      const result = await service.update(mockOrgId, updateData);
      expect(result.name).toBe(updateData.name);

      // Delete
      organizationRepository.delete.mockResolvedValue(true);
      const deleted = await service.delete(mockOrgId);
      expect(deleted).toBe(true);

      // Verify all method calls
      expect(organizationRepository.create).toHaveBeenCalledWith(
        mockUserId,
        createData,
      );
      expect(organizationRepository.findById).toHaveBeenCalledWith(mockOrgId);
      expect(organizationRepository.update).toHaveBeenCalledWith(
        mockOrgId,
        updateData,
      );
      expect(organizationRepository.delete).toHaveBeenCalledWith(mockOrgId);
    });

    it('should handle multiple find operations efficiently', async () => {
      organizationRepository.findByUserId.mockResolvedValue(mockOrganization);
      organizationRepository.findByBusinessId.mockResolvedValue(
        mockOrganization,
      );
      organizationRepository.findById.mockResolvedValue(mockOrganization);

      const [findByUser, findByBusiness, findById] = await Promise.all([
        service.findByUserId(mockUserId),
        service.findByBusinessId(mockBusinessId),
        service.findById(mockOrgId),
      ]);

      expect(findByUser).toEqual(mockOrganization);
      expect(findByBusiness).toEqual(mockOrganization);
      expect(findById).toEqual(mockOrganization);

      expect(organizationRepository.findByUserId).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(organizationRepository.findByBusinessId).toHaveBeenCalledWith(
        mockBusinessId,
      );
      expect(organizationRepository.findById).toHaveBeenCalledWith(mockOrgId);
    });
  });
});
