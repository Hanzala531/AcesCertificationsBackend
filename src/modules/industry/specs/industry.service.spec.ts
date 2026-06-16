import { Test, TestingModule } from '@nestjs/testing';
import { IndustryService } from '../industry.service';
import { IndustryRepository } from '../industry.repository';
import { CacheService } from '../../../common/services/cache.service';
import { CreateIndustryDto } from '../dto/create-industry.dto';
import { UpdateIndustryDto } from '../dto/update-industry.dto';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

describe('IndustryService', () => {
  let service: IndustryService;
  let industryRepository: jest.Mocked<IndustryRepository>;

  const mockIndustryId = '550e8400-e29b-41d4-a716-446655440000';
  const mockIndustryName = 'Information Technology';
  const mockUpdatedIndustryName = 'Software Development';

  const mockIndustry = {
    id: mockIndustryId,
    name: mockIndustryName,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUpdatedIndustry = {
    ...mockIndustry,
    name: mockUpdatedIndustryName,
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockIndustryRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn().mockReturnValue(undefined),
      set: jest.fn(),
      getOrSet: jest.fn().mockImplementation((_key: string, _ttl: number, factory: () => Promise<unknown>) => factory()),
      invalidate: jest.fn(),
      invalidatePrefix: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndustryService,
        { provide: IndustryRepository, useValue: mockIndustryRepository },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<IndustryService>(IndustryService);
    industryRepository = module.get(IndustryRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create industry successfully', async () => {
      const createDto: CreateIndustryDto = { name: mockIndustryName };
      industryRepository.findByName.mockResolvedValue(null);
      industryRepository.create.mockResolvedValue(mockIndustry);

      const result = await service.create(createDto);

      expect(result).toEqual(mockIndustry);
      expect(industryRepository.findByName).toHaveBeenCalledWith(
        mockIndustryName,
      );
      expect(industryRepository.create).toHaveBeenCalledWith(
        mockIndustryName,
        undefined,
      );
    });

    it('should create industry with trimmed name', async () => {
      const createDto: CreateIndustryDto = { name: `  ${mockIndustryName}  ` };
      industryRepository.findByName.mockResolvedValue(null);
      industryRepository.create.mockResolvedValue(mockIndustry);

      const result = await service.create(createDto);

      expect(result).toEqual(mockIndustry);
      expect(industryRepository.findByName).toHaveBeenCalledWith(
        mockIndustryName,
      );
      expect(industryRepository.create).toHaveBeenCalledWith(
        mockIndustryName,
        undefined,
      );
    });

    it('should throw BadRequestException for empty name', async () => {
      const createDto: CreateIndustryDto = { name: '' };

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(industryRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for whitespace-only name', async () => {
      const createDto: CreateIndustryDto = { name: '   ' };

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(industryRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate name', async () => {
      const createDto: CreateIndustryDto = { name: mockIndustryName };
      industryRepository.findByName.mockResolvedValue(mockIndustry);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(industryRepository.findByName).toHaveBeenCalledWith(
        mockIndustryName,
      );
      expect(industryRepository.create).not.toHaveBeenCalled();
    });

    it('should handle case-insensitive name conflicts', async () => {
      const createDto: CreateIndustryDto = {
        name: mockIndustryName.toLowerCase(),
      };
      industryRepository.findByName.mockResolvedValue(mockIndustry);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    const mockIndustries = [mockIndustry, mockUpdatedIndustry];
    const mockTotal = 2;

    it('should return paginated industries with default parameters', async () => {
      industryRepository.findAll.mockResolvedValue({
        data: mockIndustries,
        total: mockTotal,
      });

      const result = await service.findAll();

      expect(result.data).toEqual(mockIndustries);
      expect(result.total).toBe(mockTotal);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(industryRepository.findAll).toHaveBeenCalledWith(10, 0);
    });

    it('should return paginated industries with custom parameters', async () => {
      industryRepository.findAll.mockResolvedValue({
        data: mockIndustries,
        total: mockTotal,
      });

      const result = await service.findAll(5, 10);

      expect(result.data).toEqual(mockIndustries);
      expect(result.total).toBe(mockTotal);
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(5);
      expect(result.totalPages).toBe(1);
      expect(industryRepository.findAll).toHaveBeenCalledWith(5, 10);
    });

    it('should limit page size to maximum 100', async () => {
      industryRepository.findAll.mockResolvedValue({
        data: mockIndustries,
        total: mockTotal,
      });

      await service.findAll(200, 0);

      expect(industryRepository.findAll).toHaveBeenCalledWith(100, 0);
    });

    it('should ensure minimum limit of 1', async () => {
      industryRepository.findAll.mockResolvedValue({
        data: mockIndustries,
        total: mockTotal,
      });

      await service.findAll(0, 0);

      expect(industryRepository.findAll).toHaveBeenCalledWith(1, 0);
    });

    it('should ensure minimum offset of 0', async () => {
      industryRepository.findAll.mockResolvedValue({
        data: mockIndustries,
        total: mockTotal,
      });

      await service.findAll(10, -5);

      expect(industryRepository.findAll).toHaveBeenCalledWith(10, 0);
    });

    it('should calculate total pages correctly', async () => {
      industryRepository.findAll.mockResolvedValue({
        data: mockIndustries,
        total: 25,
      });

      const result = await service.findAll(10, 0);

      expect(result.totalPages).toBe(3);
    });
  });

  describe('findById', () => {
    it('should find industry by ID', async () => {
      industryRepository.findById.mockResolvedValue(mockIndustry);

      const result = await service.findById(mockIndustryId);

      expect(result).toEqual(mockIndustry);
      expect(industryRepository.findById).toHaveBeenCalledWith(mockIndustryId);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.findById('')).rejects.toThrow(BadRequestException);
      expect(industryRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when industry not found', async () => {
      industryRepository.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(industryRepository.findById).toHaveBeenCalledWith(
        'nonexistent-id',
      );
    });
  });

  describe('update', () => {
    it('should update industry name successfully', async () => {
      const updateDto: UpdateIndustryDto = { name: mockUpdatedIndustryName };
      industryRepository.findById.mockResolvedValue(mockIndustry);
      industryRepository.findByName.mockResolvedValue(null);
      industryRepository.update.mockResolvedValue(mockUpdatedIndustry);

      const result = await service.update(mockIndustryId, updateDto);

      expect(result).toEqual(mockUpdatedIndustry);
      expect(industryRepository.findById).toHaveBeenCalledWith(mockIndustryId);
      expect(industryRepository.findByName).toHaveBeenCalledWith(
        mockUpdatedIndustryName,
      );
      expect(industryRepository.update).toHaveBeenCalledWith(
        mockIndustryId,
        mockUpdatedIndustryName,
        undefined,
      );
    });

    it('should update industry with trimmed name', async () => {
      const updateDto: UpdateIndustryDto = {
        name: `  ${mockUpdatedIndustryName}  `,
      };
      industryRepository.findById.mockResolvedValue(mockIndustry);
      industryRepository.findByName.mockResolvedValue(null);
      industryRepository.update.mockResolvedValue(mockUpdatedIndustry);

      const result = await service.update(mockIndustryId, updateDto);

      expect(result).toEqual(mockUpdatedIndustry);
      expect(industryRepository.update).toHaveBeenCalledWith(
        mockIndustryId,
        mockUpdatedIndustryName,
        undefined,
      );
    });

    it('should throw BadRequestException for empty ID', async () => {
      const updateDto: UpdateIndustryDto = { name: mockUpdatedIndustryName };

      await expect(service.update('', updateDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(industryRepository.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when industry to update not found', async () => {
      const updateDto: UpdateIndustryDto = { name: mockUpdatedIndustryName };
      industryRepository.findById.mockResolvedValue(null);

      await expect(service.update('nonexistent-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(industryRepository.findById).toHaveBeenCalledWith(
        'nonexistent-id',
      );
      expect(industryRepository.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when new name already exists', async () => {
      const updateDto: UpdateIndustryDto = { name: 'Existing Industry' };
      industryRepository.findById.mockResolvedValue(mockIndustry);
      industryRepository.findByName.mockResolvedValue({
        ...mockIndustry,
        id: 'different-id',
        name: 'Existing Industry',
      });

      await expect(service.update(mockIndustryId, updateDto)).rejects.toThrow(
        ConflictException,
      );
      expect(industryRepository.findByName).toHaveBeenCalledWith(
        'Existing Industry',
      );
      expect(industryRepository.update).not.toHaveBeenCalled();
    });

    it('should allow updating to same name for same industry', async () => {
      const updateDto: UpdateIndustryDto = { name: mockIndustryName };
      industryRepository.findById.mockResolvedValue(mockIndustry);
      industryRepository.findByName.mockResolvedValue(mockIndustry); // Same industry
      industryRepository.update.mockResolvedValue(mockIndustry);

      const result = await service.update(mockIndustryId, updateDto);

      expect(result).toEqual(mockIndustry);
      expect(industryRepository.update).toHaveBeenCalledWith(
        mockIndustryId,
        mockIndustryName,
        undefined,
      );
    });

    it('should handle empty name in update DTO', async () => {
      const updateDto: UpdateIndustryDto = {};
      industryRepository.findById.mockResolvedValue(mockIndustry);

      const result = await service.update(mockIndustryId, updateDto);

      expect(result).toEqual(mockIndustry);
      expect(industryRepository.update).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only name in update DTO', async () => {
      const updateDto: UpdateIndustryDto = { name: '   ' };
      industryRepository.findById.mockResolvedValue(mockIndustry);

      const result = await service.update(mockIndustryId, updateDto);

      expect(result).toEqual(mockIndustry);
      expect(industryRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if update fails', async () => {
      const updateDto: UpdateIndustryDto = { name: mockUpdatedIndustryName };
      industryRepository.findById.mockResolvedValue(mockIndustry);
      industryRepository.findByName.mockResolvedValue(null);
      industryRepository.update.mockResolvedValue(null);

      await expect(service.update(mockIndustryId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete industry successfully', async () => {
      industryRepository.exists.mockResolvedValue(true);
      industryRepository.delete.mockResolvedValue(true);

      const result = await service.delete(mockIndustryId);

      expect(result.message).toContain('has been deleted successfully');
      expect(industryRepository.exists).toHaveBeenCalledWith(mockIndustryId);
      expect(industryRepository.delete).toHaveBeenCalledWith(mockIndustryId);
    });

    it('should throw BadRequestException for empty ID', async () => {
      await expect(service.delete('')).rejects.toThrow(BadRequestException);
      expect(industryRepository.exists).not.toHaveBeenCalled();
      expect(industryRepository.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when industry not found for deletion', async () => {
      industryRepository.exists.mockResolvedValue(false);

      await expect(service.delete('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(industryRepository.exists).toHaveBeenCalledWith('nonexistent-id');
      expect(industryRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    const mockIndustries = [
      mockIndustry,
      mockUpdatedIndustry,
      { ...mockIndustry, name: 'Healthcare Technology' },
    ];

    beforeEach(() => {
      industryRepository.findAll.mockResolvedValue({
        data: mockIndustries,
        total: mockIndustries.length,
      });
    });

    it('should search industries by name', async () => {
      const result = await service.search('Technology');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Information Technology');
      expect(result[1].name).toBe('Healthcare Technology');
    });

    it('should search industries case-insensitively', async () => {
      const result = await service.search('technology');

      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty search term', async () => {
      const result = await service.search('');

      expect(result).toEqual([]);
      expect(industryRepository.findAll).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace-only search term', async () => {
      const result = await service.search('   ');

      expect(result).toEqual([]);
      expect(industryRepository.findAll).not.toHaveBeenCalled();
    });

    it('should return empty array for no matches', async () => {
      const result = await service.search('Nonexistent Industry');

      expect(result).toEqual([]);
    });

    it('should handle partial matches', async () => {
      const result = await service.search('Info');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Information Technology');
    });

    it('should handle industries with non-string names gracefully', async () => {
      const industriesWithNonStringName = [
        ...mockIndustries,
        { ...mockIndustry, name: null },
        { ...mockIndustry, name: undefined },
        { ...mockIndustry, name: 123 },
      ] as any;

      industryRepository.findAll.mockResolvedValue({
        data: industriesWithNonStringName,
        total: industriesWithNonStringName.length,
      });

      const result = await service.search('Technology');

      expect(result).toHaveLength(2);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete industry lifecycle', async () => {
      // Create
      const createDto: CreateIndustryDto = { name: 'New Industry' };
      industryRepository.findByName.mockResolvedValue(null);
      industryRepository.create.mockResolvedValue(mockIndustry);

      const created = await service.create(createDto);
      expect(created).toEqual(mockIndustry);

      // Find
      industryRepository.findById.mockResolvedValue(mockIndustry);
      const found = await service.findById(mockIndustryId);
      expect(found).toEqual(mockIndustry);

      // Update
      const updateDto: UpdateIndustryDto = { name: 'Updated Industry' };
      industryRepository.findById.mockResolvedValue(mockIndustry);
      industryRepository.findByName.mockResolvedValue(null);
      const updatedIndustry = { ...mockIndustry, name: 'Updated Industry' };
      industryRepository.update.mockResolvedValue(updatedIndustry);

      const updated = await service.update(mockIndustryId, updateDto);
      expect(updated.name).toBe('Updated Industry');

      // Search
      industryRepository.findAll.mockResolvedValue({
        data: [updatedIndustry],
        total: 1,
      });
      const searchResults = await service.search('Updated');
      expect(searchResults).toHaveLength(1);

      // Delete
      industryRepository.exists.mockResolvedValue(true);
      industryRepository.delete.mockResolvedValue(true);
      const deleted = await service.delete(mockIndustryId);
      expect(deleted.message).toContain('deleted successfully');

      //
      expect(industryRepository.create).toHaveBeenCalledWith(
        'New Industry',
        undefined,
      );
      expect(industryRepository.findById).toHaveBeenCalled();
      expect(industryRepository.update).toHaveBeenCalled();
      expect(industryRepository.exists).toHaveBeenCalled();
      expect(industryRepository.delete).toHaveBeenCalled();
    });

    it('should handle search across all industries', async () => {
      const allIndustries = [
        {
          id: '1',
          name: 'Technology',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '2',
          name: 'Healthcare',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '3',
          name: 'Finance',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '4',
          name: 'Technology Services',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      industryRepository.findAll.mockResolvedValue({
        data: allIndustries,
        total: allIndustries.length,
      });

      const techResults = await service.search('Technology');
      expect(techResults).toHaveLength(2);

      const healthResults = await service.search('Health');
      expect(healthResults).toHaveLength(1);

      const financeResults = await service.search('Finance');
      expect(financeResults).toHaveLength(1);
    });
  });
});
