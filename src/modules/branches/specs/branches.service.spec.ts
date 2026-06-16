import { Test, TestingModule } from '@nestjs/testing';
import { BranchService } from '../branches.service';
import { BranchRepository } from '../branches.repository';
import { CreateBranchDto, UpdateBranchDto } from '../dto/create-branch.dto';
import { BranchRecord } from '../types/branch.types';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';

describe('BranchService', () => {
  let service: BranchService;
  let branchRepository: jest.Mocked<BranchRepository>;

  const mockOrganizationId = '550e8400-e29b-41d4-a716-446655440000';
  const mockBranchId = '550e8400-e29b-41d4-a716-446655440001';

  const mockBranch: BranchRecord = {
    id: mockBranchId,
    organization_id: mockOrganizationId,
    name: 'Main Branch',
    address: '123 Main Street',
    city: 'New York',
    state: 'NY',
    country: 'USA',
    postal_code: '10001',
    contact_no: '+1234567890',
    email: 'branch@example.com',
    is_main: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockBranchRepository = {
      create: jest.fn(),
      findMainBranchByOrganization: jest.fn(),
      findByIdAndOrganization: jest.fn(),
      findByOrganizationId: jest.fn(),
      findAllByOrganizationId: jest.fn(),
      update: jest.fn(),
      updateMainBranch: jest.fn(),
      delete: jest.fn(),
      findByNameAndOrganization: jest.fn(),
      isEmailTaken: jest.fn().mockResolvedValue({ taken: false, usedBy: null }),
      getOrganizationAsBranch: jest.fn().mockResolvedValue(null),
    };

    const mockDatabaseService = {
      transaction: jest.fn((callback) => callback({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchService,
        { provide: BranchRepository, useValue: mockBranchRepository },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<BranchService>(BranchService);
    branchRepository = module.get(BranchRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBranch', () => {
    const createDto: CreateBranchDto = {
      name: 'New Branch',
      address: '456 Oak Avenue',
      city: 'Los Angeles',
      state: 'CA',
      country: 'USA',
      postal_code: '90210',
      contact_no: '+1987654321',
      email: 'la.branch@example.com',
      is_main: false,
    };

    it('should create branch successfully', async () => {
      branchRepository.findByNameAndOrganization.mockResolvedValue(null);
      branchRepository.findMainBranchByOrganization.mockResolvedValue(null);
      branchRepository.create.mockResolvedValue(mockBranch);

      const result = await service.createBranch(mockOrganizationId, createDto);

      expect(result).toEqual(mockBranch);
      expect(
        branchRepository.findMainBranchByOrganization,
      ).toHaveBeenCalledWith(mockOrganizationId, expect.anything());
      expect(branchRepository.create).toHaveBeenCalledWith(
        {
          organization_id: mockOrganizationId,
          name: createDto.name,
          address: createDto.address,
          city: createDto.city,
          state: createDto.state,
          country: createDto.country,
          postal_code: createDto.postal_code,
          contact_no: createDto.contact_no,
          email: createDto.email,
          branch_size: null,
          is_main: createDto.is_main,
        },
        expect.anything(),
      );
    });

    it('should not allow creating branch with duplicate name for same organization', async () => {
      branchRepository.findByNameAndOrganization.mockResolvedValue(mockBranch);

      await expect(
        service.createBranch(mockOrganizationId, createDto),
      ).rejects.toThrow();

      expect(branchRepository.create).not.toHaveBeenCalled();
    });

    it('should set is_main to true when no main branch exists', async () => {
      const createDtoWithoutMainFlag: CreateBranchDto = {
        name: 'Auto Main Branch',
        address: '789 Pine Street',
        city: 'Chicago',
      };
      branchRepository.findMainBranchByOrganization.mockResolvedValue(null);
      branchRepository.create.mockResolvedValue({
        ...mockBranch,
        name: createDtoWithoutMainFlag.name,
        is_main: true,
      });

      const result = await service.createBranch(
        mockOrganizationId,
        createDtoWithoutMainFlag,
      );

      expect(result.is_main).toBe(true);
      expect(branchRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_main: true }),
        expect.anything(),
      );
    });

    it('should set is_main to false when main branch already exists', async () => {
      branchRepository.findMainBranchByOrganization.mockResolvedValue(
        mockBranch,
      );
      branchRepository.create.mockResolvedValue({
        ...mockBranch,
        name: 'Secondary Branch',
        is_main: false,
      });

      const result = await service.createBranch(mockOrganizationId, {
        name: 'Secondary Branch',
        is_main: true, // This should be overridden
      });

      expect(result.is_main).toBe(false);
      expect(branchRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_main: false }),
        expect.anything(),
      );
    });

    it('should create branch with minimal required fields', async () => {
      const minimalDto: CreateBranchDto = { name: 'Minimal Branch' };
      branchRepository.findMainBranchByOrganization.mockResolvedValue(null);
      branchRepository.create.mockResolvedValue({
        ...mockBranch,
        name: minimalDto.name,
        address: undefined,
        city: undefined,
        state: undefined,
        country: undefined,
        postal_code: undefined,
        contact_no: undefined,
        email: undefined,
        is_main: true,
      });

      const result = await service.createBranch(mockOrganizationId, minimalDto);

      expect(result.name).toBe(minimalDto.name);
      expect(result.address).toBeUndefined();
      expect(result.is_main).toBe(true);
    });

    it('should treat empty strings for optional fields as missing', async () => {
      const dto: CreateBranchDto = {
        name: 'Empty Fields Branch',
        postal_code: '',
        contact_no: '',
        email: '',
      };

      branchRepository.findMainBranchByOrganization.mockResolvedValue(null);
      branchRepository.create.mockResolvedValue({
        ...mockBranch,
        name: dto.name,
        postal_code: undefined,
        contact_no: undefined,
        email: undefined,
        is_main: true,
      });

      const result = await service.createBranch(mockOrganizationId, dto);

      expect(result.name).toBe(dto.name);
      expect(branchRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          postal_code: undefined,
          contact_no: undefined,
          email: undefined,
        }),
        expect.anything(),
      );
    });

    it('should allow branch email with gmail domain', async () => {
      branchRepository.findByNameAndOrganization.mockResolvedValue(null);
      branchRepository.findMainBranchByOrganization.mockResolvedValue(null);
      branchRepository.create.mockResolvedValue({
        ...mockBranch,
        name: 'Gmail Branch',
        email: 'branch@gmail.com',
      });

      const result = await service.createBranch(mockOrganizationId, {
        name: 'Gmail Branch',
        email: 'branch@gmail.com',
      });

      expect(result.email).toBe('branch@gmail.com');
      expect(branchRepository.create).toHaveBeenCalled();
    });

    it('should reject branch email with free email domain (yahoo)', async () => {
      branchRepository.findByNameAndOrganization.mockResolvedValue(null);

      await expect(
        service.createBranch(mockOrganizationId, {
          name: 'Free Email Branch',
          email: 'branch@yahoo.com',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(branchRepository.create).not.toHaveBeenCalled();
    });

    it('should reject branch email with free email domain (outlook)', async () => {
      branchRepository.findByNameAndOrganization.mockResolvedValue(null);

      await expect(
        service.createBranch(mockOrganizationId, {
          name: 'Free Email Branch',
          email: 'branch@outlook.com',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(branchRepository.create).not.toHaveBeenCalled();
    });

    it('should reject invalid postal code with case-insensitive country match', async () => {
      branchRepository.findByNameAndOrganization.mockResolvedValue(null);

      await expect(
        service.createBranch(mockOrganizationId, {
          name: 'Postal Code Branch',
          country: 'pakistan',
          postal_code: '123456',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(branchRepository.create).not.toHaveBeenCalled();
    });

    it('should allow branch email with organizational domain', async () => {
      branchRepository.findByNameAndOrganization.mockResolvedValue(null);
      branchRepository.findMainBranchByOrganization.mockResolvedValue(null);
      branchRepository.create.mockResolvedValue({
        ...mockBranch,
        name: 'Org Email Branch',
        email: 'branch@acme.com',
      });

      const result = await service.createBranch(mockOrganizationId, {
        name: 'Org Email Branch',
        email: 'branch@acme.com',
      });

      expect(result.email).toBe('branch@acme.com');
      expect(branchRepository.create).toHaveBeenCalled();
    });

    it('should respect is_main flag when set to false', async () => {
      branchRepository.findMainBranchByOrganization.mockResolvedValue(
        mockBranch,
      );
      branchRepository.create.mockResolvedValue({
        ...mockBranch,
        name: 'Another Branch',
        is_main: false,
      });

      const result = await service.createBranch(mockOrganizationId, {
        name: 'Another Branch',
        is_main: false,
      });

      expect(result.is_main).toBe(false);
    });
  });

  describe('getBranchById', () => {
    it('should return branch by ID', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);

      const result = await service.getBranchById(
        mockBranchId,
        mockOrganizationId,
      );

      expect(result).toEqual(mockBranch);
      expect(branchRepository.findByIdAndOrganization).toHaveBeenCalledWith(
        mockBranchId,
        mockOrganizationId,
      );
    });

    it('should throw NotFoundException when branch not found', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(null);

      await expect(
        service.getBranchById('nonexistent-branch', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when branch belongs to different organization', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(null);

      await expect(
        service.getBranchById(mockBranchId, 'different-org-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBranchesByOrganization', () => {
    const mockBranches = [mockBranch];
    const mockTotal = 1;

    it('should return paginated branches with default parameters', async () => {
      branchRepository.findByOrganizationId.mockResolvedValue({
        data: mockBranches,
        total: mockTotal,
      });

      const result =
        await service.getBranchesByOrganization(mockOrganizationId);

      expect(result.data).toEqual(mockBranches);
      expect(result.total).toBe(mockTotal);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(branchRepository.findByOrganizationId).toHaveBeenCalledWith(
        mockOrganizationId,
        10,
        0,
      );
    });

    it('should return paginated branches with custom parameters', async () => {
      branchRepository.findByOrganizationId.mockResolvedValue({
        data: mockBranches,
        total: mockTotal,
      });

      const result = await service.getBranchesByOrganization(
        mockOrganizationId,
        5,
        10,
      );

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(5);
      expect(result.totalPages).toBe(1);
      expect(branchRepository.findByOrganizationId).toHaveBeenCalledWith(
        mockOrganizationId,
        5,
        10,
      );
    });

    it('should calculate total pages correctly', async () => {
      branchRepository.findByOrganizationId.mockResolvedValue({
        data: mockBranches,
        total: 25,
      });

      const result = await service.getBranchesByOrganization(
        mockOrganizationId,
        10,
        0,
      );

      expect(result.totalPages).toBe(3);
    });

    it('should handle empty result set', async () => {
      branchRepository.findByOrganizationId.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result =
        await service.getBranchesByOrganization(mockOrganizationId);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(0);
    });

    it('should return all branches when all=true', async () => {
      branchRepository.findAllByOrganizationId.mockResolvedValue({
        data: mockBranches,
        total: mockTotal,
      });

      const result = await service.getBranchesByOrganization(
        mockOrganizationId,
        10,
        0,
        true,
      );

      expect(branchRepository.findAllByOrganizationId).toHaveBeenCalledWith(
        mockOrganizationId,
      );
      expect(result.data).toEqual(mockBranches);
      expect(result.total).toBe(mockTotal);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(mockTotal);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('updateBranch', () => {
    const updateDto: UpdateBranchDto = {
      name: 'Updated Branch Name',
      address: '789 Updated Street',
      city: 'Updated City',
      state: 'UC',
      country: 'Canada',
      postal_code: 'K1A0B1',
      contact_no: '+1122334455',
      email: 'updated@branch.com',
    };

    it('should update branch successfully', async () => {
      const updatedBranch = { ...mockBranch, ...updateDto };
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      branchRepository.findByNameAndOrganization.mockResolvedValue(null);
      branchRepository.update.mockResolvedValue(updatedBranch);

      const result = await service.updateBranch(
        mockBranchId,
        mockOrganizationId,
        updateDto,
      );

      expect(result).toEqual(updatedBranch);
      expect(branchRepository.findByIdAndOrganization).toHaveBeenCalledWith(
        mockBranchId,
        mockOrganizationId,
      );
      expect(branchRepository.update).toHaveBeenCalledWith(
        mockBranchId,
        updateDto,
      );
    });

    it('should throw BadRequestException when updating to a name that already exists in organization', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      branchRepository.findByNameAndOrganization.mockResolvedValue({
        ...mockBranch,
        id: 'different-branch-id',
      });

      await expect(
        service.updateBranch(mockBranchId, mockOrganizationId, {
          name: 'Main Branch',
        }),
      ).rejects.toThrow();

      expect(branchRepository.update).not.toHaveBeenCalled();
    });

    it('should update single field', async () => {
      const singleUpdateDto = { name: 'Single Field Update' };
      const updatedBranch = { ...mockBranch, name: singleUpdateDto.name };
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      branchRepository.update.mockResolvedValue(updatedBranch);

      const result = await service.updateBranch(
        mockBranchId,
        mockOrganizationId,
        singleUpdateDto,
      );

      expect(result.name).toBe(singleUpdateDto.name);
      expect(branchRepository.update).toHaveBeenCalledWith(
        mockBranchId,
        singleUpdateDto,
      );
    });

    it('should handle partial update', async () => {
      const partialUpdateDto = { name: 'Partial Update', city: 'New City' };
      const updatedBranch = { ...mockBranch, ...partialUpdateDto };
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      branchRepository.update.mockResolvedValue(updatedBranch);

      const result = await service.updateBranch(
        mockBranchId,
        mockOrganizationId,
        partialUpdateDto,
      );

      expect(result.name).toBe('Partial Update');
      expect(result.city).toBe('New City');
      expect(result.state).toBe(mockBranch.state);
    });

    it('should throw NotFoundException when branch to update not found', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(null);

      await expect(
        service.updateBranch(
          'nonexistent-branch',
          mockOrganizationId,
          updateDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when update fails', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      branchRepository.update.mockResolvedValue(null);

      await expect(
        service.updateBranch(mockBranchId, mockOrganizationId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow update with gmail domain', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      branchRepository.update.mockResolvedValue({
        ...mockBranch,
        email: 'branch@gmail.com',
      });

      const result = await service.updateBranch(
        mockBranchId,
        mockOrganizationId,
        {
          email: 'branch@gmail.com',
        },
      );

      expect(result.email).toBe('branch@gmail.com');
      expect(branchRepository.update).toHaveBeenCalledWith(mockBranchId, {
        email: 'branch@gmail.com',
      });
    });

    it('should handle empty update object', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      branchRepository.update.mockResolvedValue(mockBranch);

      const result = await service.updateBranch(
        mockBranchId,
        mockOrganizationId,
        {},
      );

      expect(result).toEqual(mockBranch);
    });
  });

  describe('deleteBranch', () => {
    it('should delete branch successfully', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      branchRepository.delete.mockResolvedValue(true);

      await service.deleteBranch(mockBranchId, mockOrganizationId);

      expect(branchRepository.findByIdAndOrganization).toHaveBeenCalledWith(
        mockBranchId,
        mockOrganizationId,
      );
      expect(branchRepository.delete).toHaveBeenCalledWith(mockBranchId);
    });

    it('should throw NotFoundException when branch to delete not found', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(null);

      await expect(
        service.deleteBranch('nonexistent-branch', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setMainBranch', () => {
    it('should set branch as main successfully', async () => {
      const mainBranch = { ...mockBranch, is_main: true };
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      branchRepository.updateMainBranch.mockResolvedValue(mainBranch);

      const result = await service.setMainBranch(
        mockBranchId,
        mockOrganizationId,
      );

      expect(result).toEqual(mainBranch);
      expect(branchRepository.findByIdAndOrganization).toHaveBeenCalledWith(
        mockBranchId,
        mockOrganizationId,
      );
      expect(branchRepository.updateMainBranch).toHaveBeenCalledWith(
        mockBranchId,
        mockOrganizationId,
      );
    });

    it('should throw NotFoundException when branch to set as main not found', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(null);

      await expect(
        service.setMainBranch('nonexistent-branch', mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when setting main branch fails', async () => {
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      branchRepository.updateMainBranch.mockResolvedValue(null);

      await expect(
        service.setMainBranch(mockBranchId, mockOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete branch lifecycle', async () => {
      branchRepository.findMainBranchByOrganization.mockResolvedValue(null);
      const createDto: CreateBranchDto = {
        name: 'Lifecycle Branch',
        address: '123 Test Street',
        city: 'Test City',
        state: 'TC',
        country: 'Test Country',
        postal_code: '12345',
        contact_no: '+1122334455',
        email: 'test@branch.com',
      };

      const createdBranch = { ...mockBranch, name: createDto.name };
      branchRepository.create.mockResolvedValue(createdBranch);

      const created = await service.createBranch(mockOrganizationId, createDto);
      expect(created.name).toBe(createDto.name);

      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);

      const found = await service.getBranchById(
        mockBranchId,
        mockOrganizationId,
      );
      expect(found).toEqual(mockBranch);

      branchRepository.findByOrganizationId.mockResolvedValue({
        data: [mockBranch],
        total: 1,
      });

      const branches =
        await service.getBranchesByOrganization(mockOrganizationId);
      expect(branches.data).toHaveLength(1);

      const updateDto = { name: 'Updated Lifecycle Branch' };
      const updatedBranch = { ...mockBranch, name: updateDto.name };
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      branchRepository.update.mockResolvedValue(updatedBranch);

      const updated = await service.updateBranch(
        mockBranchId,
        mockOrganizationId,
        updateDto,
      );
      expect(updated.name).toBe(updateDto.name);

      const mainBranch = { ...updatedBranch, is_main: true };
      branchRepository.findByIdAndOrganization.mockResolvedValue(updatedBranch);
      branchRepository.updateMainBranch.mockResolvedValue(mainBranch);

      const main = await service.setMainBranch(
        mockBranchId,
        mockOrganizationId,
      );
      expect(main.is_main).toBe(true);

      branchRepository.findByIdAndOrganization.mockResolvedValue(mainBranch);
      branchRepository.delete.mockResolvedValue(true);

      await service.deleteBranch(mockBranchId, mockOrganizationId);

      expect(branchRepository.create).toHaveBeenCalled();
      expect(branchRepository.findByIdAndOrganization).toHaveBeenCalledTimes(4);
      expect(branchRepository.findByOrganizationId).toHaveBeenCalled();
      expect(branchRepository.update).toHaveBeenCalled();
      expect(branchRepository.updateMainBranch).toHaveBeenCalled();
      expect(branchRepository.delete).toHaveBeenCalled();
    });

    it('should handle main branch logic correctly', async () => {
      const firstBranch = { ...mockBranch, name: 'First Branch' };
      branchRepository.findMainBranchByOrganization.mockResolvedValueOnce(null);
      branchRepository.create.mockResolvedValueOnce(firstBranch);

      const first = await service.createBranch(mockOrganizationId, {
        name: 'First Branch',
      });
      expect(first.is_main).toBe(true);

      const secondBranch = {
        ...mockBranch,
        name: 'Second Branch',
        is_main: false,
      };
      branchRepository.findMainBranchByOrganization.mockResolvedValueOnce(
        firstBranch,
      );
      branchRepository.create.mockResolvedValueOnce(secondBranch);

      const second = await service.createBranch(mockOrganizationId, {
        name: 'Second Branch',
        is_main: true,
      });
      expect(second.is_main).toBe(false);

      const updatedSecond = { ...secondBranch, is_main: true };
      branchRepository.findByIdAndOrganization.mockResolvedValueOnce(
        secondBranch,
      );
      branchRepository.updateMainBranch.mockResolvedValueOnce(updatedSecond);

      const newMain = await service.setMainBranch(
        mockBranchId,
        mockOrganizationId,
      );
      expect(newMain.is_main).toBe(true);
    });

    it('should handle pagination edge cases', async () => {
      const manyBranches = Array.from({ length: 25 }, (_, i) => ({
        ...mockBranch,
        id: `branch-${i}`,
        name: `Branch ${i + 1}`,
      }));

      branchRepository.findByOrganizationId.mockResolvedValue({
        data: manyBranches,
        total: 25,
      });

      const page1 = await service.getBranchesByOrganization(
        mockOrganizationId,
        10,
        0,
      );
      expect(page1.page).toBe(1);
      expect(page1.totalPages).toBe(3);

      const page2 = await service.getBranchesByOrganization(
        mockOrganizationId,
        10,
        10,
      );
      expect(page2.page).toBe(2);
      expect(page2.totalPages).toBe(3);

      const page3 = await service.getBranchesByOrganization(
        mockOrganizationId,
        10,
        20,
      );
      expect(page3.page).toBe(3);
      expect(page3.totalPages).toBe(3);
    });
  });
});
