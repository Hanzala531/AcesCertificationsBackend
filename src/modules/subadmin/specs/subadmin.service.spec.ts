import { Test, TestingModule } from '@nestjs/testing';
import { SubadminService } from '../subadmin.service';
import { SubadminRepository } from '../subadmin.repository';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SubadminService', () => {
  let service: SubadminService;
  let subadminRepo: jest.Mocked<SubadminRepository>;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockSubadminId = '550e8400-e29b-41d4-a716-446655440001';

  const mockSubadmin = {
    id: mockSubadminId,
    user_id: mockUserId,
    first_name: 'John',
    last_name: 'Smith',
    profile_picture: 'https://example.com/avatar.jpg',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockSubadminRepository = {
      create: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubadminService,
        { provide: SubadminRepository, useValue: mockSubadminRepository },
      ],
    }).compile();

    service = module.get<SubadminService>(SubadminService);
    subadminRepo = module.get(SubadminRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create subadmin successfully with all fields', async () => {
      subadminRepo.create.mockResolvedValue(mockSubadmin);

      const result = await service.create(
        mockUserId,
        'John',
        'Smith',
        'https://example.com/avatar.jpg',
      );

      expect(result).toEqual(mockSubadmin);
      expect(subadminRepo.create).toHaveBeenCalledWith(
        mockUserId,
        'John',
        'Smith',
        'https://example.com/avatar.jpg',
      );
    });

    it('should create subadmin successfully with minimal required fields', async () => {
      const minimalSubadmin = {
        ...mockSubadmin,
        profile_picture: null,
      };
      subadminRepo.create.mockResolvedValue(minimalSubadmin);

      const result = await service.create(mockUserId, 'Jane', 'Doe');

      expect(result).toEqual(minimalSubadmin);
      expect(subadminRepo.create).toHaveBeenCalledWith(
        mockUserId,
        'Jane',
        'Doe',
        undefined,
      );
    });

    it('should throw BadRequestException for empty user ID', async () => {
      await expect(service.create('', 'John', 'Smith')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty first name', async () => {
      await expect(service.create(mockUserId, '', 'Smith')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for empty last name', async () => {
      await expect(service.create(mockUserId, 'John', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByUserId', () => {
    it('should find subadmin by user ID', async () => {
      subadminRepo.findByUserId.mockResolvedValue(mockSubadmin);

      const result = await service.findByUserId(mockUserId);

      expect(result).toEqual(mockSubadmin);
      expect(subadminRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
    });

    it('should return null when subadmin not found by user ID', async () => {
      subadminRepo.findByUserId.mockResolvedValue(null);

      const result = await service.findByUserId('nonexistent-user-id');

      expect(result).toBeNull();
      expect(subadminRepo.findByUserId).toHaveBeenCalledWith(
        'nonexistent-user-id',
      );
    });
  });

  describe('findById', () => {
    it('should find subadmin by ID', async () => {
      subadminRepo.findById.mockResolvedValue(mockSubadmin);

      const result = await service.findById(mockSubadminId);

      expect(result).toEqual(mockSubadmin);
      expect(subadminRepo.findById).toHaveBeenCalledWith(mockSubadminId);
    });

    it('should throw NotFoundException when subadmin not found by ID', async () => {
      subadminRepo.findById.mockResolvedValue(null);

      await expect(service.findById('nonexistent-subadmin-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all subadmins', async () => {
      const mockSubadmins = [mockSubadmin];
      subadminRepo.findAll.mockResolvedValue({
        subadmins: mockSubadmins,
        total: 1,
      });

      const result = await service.findAll();

      expect(result).toEqual({ subadmins: mockSubadmins, total: 1 });
      expect(subadminRepo.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no subadmins exist', async () => {
      subadminRepo.findAll.mockResolvedValue({ subadmins: [], total: 0 });

      const result = await service.findAll();

      expect(result).toEqual({ subadmins: [], total: 0 });
    });
  });

  describe('update', () => {
    it('should update subadmin successfully', async () => {
      const updateFields = {
        first_name: 'Updated John',
        last_name: 'Updated Smith',
        profile_picture: 'https://updated-avatar.jpg',
      };
      const updatedSubadmin = { ...mockSubadmin, ...updateFields };
      subadminRepo.findById.mockResolvedValue(mockSubadmin);
      subadminRepo.update.mockResolvedValue(updatedSubadmin);

      const result = await service.update(mockSubadminId, updateFields);

      expect(result).toEqual(updatedSubadmin);
      expect(subadminRepo.findById).toHaveBeenCalledWith(mockSubadminId);
      expect(subadminRepo.update).toHaveBeenCalledWith(
        mockSubadminId,
        updateFields,
      );
    });

    it('should update single field', async () => {
      const updateFields = { first_name: 'New Name' };
      const updatedSubadmin = { ...mockSubadmin, first_name: 'New Name' };
      subadminRepo.findById.mockResolvedValue(mockSubadmin);
      subadminRepo.update.mockResolvedValue(updatedSubadmin);

      const result = await service.update(mockSubadminId, updateFields);

      expect(result?.first_name).toBe('New Name');
      expect(subadminRepo.update).toHaveBeenCalledWith(
        mockSubadminId,
        updateFields,
      );
    });

    it('should update status field', async () => {
      const updateFields = { status: 'inactive' };
      const updatedSubadmin = { ...mockSubadmin, status: 'inactive' };
      subadminRepo.findById.mockResolvedValue(mockSubadmin);
      subadminRepo.update.mockResolvedValue(updatedSubadmin);

      const result = await service.update(mockSubadminId, updateFields);

      expect(result?.status).toBe('inactive');
    });

    it('should return original subadmin when no valid fields provided', async () => {
      subadminRepo.findById.mockResolvedValue(mockSubadmin);
      subadminRepo.update.mockResolvedValue(mockSubadmin);

      const result = await service.update(mockSubadminId, {
        invalid_field: 'value',
      } as any);

      expect(result).toEqual(mockSubadmin);
    });

    it('should throw NotFoundException when subadmin to update not found', async () => {
      subadminRepo.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent-subadmin', { first_name: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty update object', async () => {
      subadminRepo.findById.mockResolvedValue(mockSubadmin);
      subadminRepo.update.mockResolvedValue(mockSubadmin);

      const result = await service.update(mockSubadminId, {});

      expect(result).toEqual(mockSubadmin);
    });
  });

  describe('delete', () => {
    it('should delete subadmin successfully', async () => {
      subadminRepo.findById.mockResolvedValue(mockSubadmin);
      subadminRepo.delete.mockResolvedValue(true);

      const result = await service.delete(mockSubadminId);

      expect(result).toBe(true);
      expect(subadminRepo.findById).toHaveBeenCalledWith(mockSubadminId);
      expect(subadminRepo.delete).toHaveBeenCalledWith(mockSubadminId);
    });

    it('should throw NotFoundException when subadmin to delete not found', async () => {
      subadminRepo.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent-subadmin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete subadmin lifecycle', async () => {
      subadminRepo.create.mockResolvedValue(mockSubadmin);
      const created = await service.create(
        mockUserId,
        'John',
        'Smith',
        'avatar.jpg',
      );
      expect(created).toEqual(mockSubadmin);

      subadminRepo.findById.mockResolvedValue(mockSubadmin);
      const found = await service.findById(mockSubadminId);
      expect(found).toEqual(mockSubadmin);

      subadminRepo.findByUserId.mockResolvedValue(mockSubadmin);
      const findByUser = await service.findByUserId(mockUserId);
      expect(findByUser).toEqual(mockSubadmin);

      subadminRepo.findAll.mockResolvedValue({
        subadmins: [mockSubadmin],
        total: 1,
      });
      const all = await service.findAll();
      expect(all.subadmins).toHaveLength(1);

      const updateFields = { first_name: 'Updated John' };
      const updatedSubadmin = { ...mockSubadmin, first_name: 'Updated John' };
      subadminRepo.findById.mockResolvedValue(mockSubadmin);
      subadminRepo.update.mockResolvedValue(updatedSubadmin);
      const updated = await service.update(mockSubadminId, updateFields);
      expect(updated?.first_name).toBe('Updated John');

      subadminRepo.findById.mockResolvedValue(updatedSubadmin);
      subadminRepo.delete.mockResolvedValue(true);
      const deleted = await service.delete(mockSubadminId);
      expect(deleted).toBe(true);

      expect(subadminRepo.create).toHaveBeenCalledWith(
        mockUserId,
        'John',
        'Smith',
        'avatar.jpg',
      );
      expect(subadminRepo.findById).toHaveBeenCalledTimes(3);
      expect(subadminRepo.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(subadminRepo.findAll).toHaveBeenCalled();
      expect(subadminRepo.update).toHaveBeenCalled();
      expect(subadminRepo.delete).toHaveBeenCalled();
    });

    it('should handle multiple subadmins operations', async () => {
      const subadmin1 = {
        ...mockSubadmin,
        id: 'sub-1',
        user_id: 'user-1',
        first_name: 'Alice',
      };
      const subadmin2 = {
        ...mockSubadmin,
        id: 'sub-2',
        user_id: 'user-2',
        first_name: 'Bob',
      };
      const allSubadmins = [subadmin1, subadmin2];

      subadminRepo.create
        .mockResolvedValueOnce(subadmin1)
        .mockResolvedValueOnce(subadmin2);

      const created1 = await service.create('user-1', 'Alice', 'Johnson');
      const created2 = await service.create('user-2', 'Bob', 'Smith');

      expect(created1.first_name).toBe('Alice');
      expect(created2.first_name).toBe('Bob');

      subadminRepo.findAll.mockResolvedValue({
        subadmins: allSubadmins,
        total: 2,
      });
      const foundAll = await service.findAll();
      expect(foundAll.subadmins).toHaveLength(2);

      subadminRepo.findById
        .mockResolvedValueOnce(subadmin1)
        .mockResolvedValueOnce(subadmin2);

      const found1 = await service.findById('sub-1');
      const found2 = await service.findById('sub-2');

      expect(found1.first_name).toBe('Alice');
      expect(found2.first_name).toBe('Bob');
    });

    it('should handle validation errors gracefully', async () => {
      await expect(service.create('', 'John', 'Smith')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(mockUserId, '', 'Smith')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(mockUserId, 'John', '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.delete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update('nonexistent', {})).rejects.toThrow(
        NotFoundException,
      );

      expect(subadminRepo.create).not.toHaveBeenCalled();
      expect(subadminRepo.delete).not.toHaveBeenCalled();
    });

    it('should handle profile picture updates', async () => {
      // Create with profile picture
      const subadminWithPicture = {
        ...mockSubadmin,
        profile_picture: 'https://new-pic.jpg',
      };
      subadminRepo.findById.mockResolvedValue(mockSubadmin);
      subadminRepo.update.mockResolvedValue(subadminWithPicture);

      const result = await service.update(mockSubadminId, {
        profile_picture: 'https://new-pic.jpg',
      });

      expect(result?.profile_picture).toBe('https://new-pic.jpg');
    });

    it('should handle status changes', async () => {
      // Test different status updates
      const statuses = ['active', 'inactive', 'suspended'];

      for (const status of statuses) {
        const subadminWithStatus = { ...mockSubadmin, status };
        subadminRepo.findById.mockResolvedValue(mockSubadmin);
        subadminRepo.update.mockResolvedValue(subadminWithStatus);

        const result = await service.update(mockSubadminId, { status });

        expect(result?.status).toBe(status);
      }
    });
  });
});
