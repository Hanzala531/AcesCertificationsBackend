import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { UsersRepository } from '../users.repository';

const mockUsersRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  setRefreshToken: jest.fn(),
  clearRefreshToken: jest.fn(),
  setLastLogin: jest.fn(),
  insertLoginLog: jest.fn(),
  setOtp: jest.fn(),
  clearOtp: jest.fn(),
  verifyUser: jest.fn(),
  incrementLoginAttempts: jest.fn(),
  resetLoginAttempts: jest.fn(),
  verifyOtp: jest.fn(),
  incrementOtpAttempts: jest.fn(),
  markOtpAsUsed: jest.fn(),
  updateEmail: jest.fn(),
  updatePassword: jest.fn(),
  markAsDeleted: jest.fn(),
  getOrganizationByUserId: jest.fn(),
  getEmployeeByUserId: jest.fn(),
  getAuditorByUserId: jest.fn(),
  getReviewerByUserId: jest.fn(),
  getLoginLogs: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockUsersRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repo = module.get(UsersRepository);

    jest.clearAllMocks();
  });

  describe('getLoginLogs', () => {
    const mockLogs = [
      {
        id: 'log-1',
        user_id: 'user-1',
        email: 'test@example.com',
        device: 'Chrome on Windows',
        location: '192.168.1.1',
        created_at: new Date('2026-04-01T10:00:00Z'),
      },
      {
        id: 'log-2',
        user_id: 'user-1',
        email: 'test@example.com',
        device: 'Safari on macOS',
        location: '10.0.0.1',
        created_at: new Date('2026-03-31T08:00:00Z'),
      },
    ];

    it('should return paginated login logs', async () => {
      repo.getLoginLogs.mockResolvedValue({ items: mockLogs, total: 2 });

      const result = await service.getLoginLogs('user-1', 1, 20);

      expect(repo.getLoginLogs).toHaveBeenCalledWith('user-1', 1, 20);
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should calculate totalPages correctly', async () => {
      repo.getLoginLogs.mockResolvedValue({ items: mockLogs, total: 45 });

      const result = await service.getLoginLogs('user-1', 1, 10);

      expect(result.totalPages).toBe(5);
    });

    it('should return empty results for user with no logs', async () => {
      repo.getLoginLogs.mockResolvedValue({ items: [], total: 0 });

      const result = await service.getLoginLogs('user-1', 1, 20);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should forward page and limit to repository', async () => {
      repo.getLoginLogs.mockResolvedValue({ items: [], total: 0 });

      await service.getLoginLogs('user-1', 3, 15);

      expect(repo.getLoginLogs).toHaveBeenCalledWith('user-1', 3, 15);
    });
  });

  describe('insertLoginLog', () => {
    it('should insert login log with provided email', async () => {
      repo.insertLoginLog.mockResolvedValue(undefined);

      await service.insertLoginLog('user-1', 'test@example.com', 'Chrome', '192.168.1.1');

      expect(repo.insertLoginLog).toHaveBeenCalledWith(
        'user-1',
        'test@example.com',
        'Chrome',
        '192.168.1.1',
      );
    });

    it('should look up email from user when not provided', async () => {
      repo.findById.mockResolvedValue({ id: 'user-1', email: 'fallback@example.com' } as any);
      repo.insertLoginLog.mockResolvedValue(undefined);

      await service.insertLoginLog('user-1', null, 'Firefox', '10.0.0.1');

      expect(repo.findById).toHaveBeenCalledWith('user-1');
      expect(repo.insertLoginLog).toHaveBeenCalledWith(
        'user-1',
        'fallback@example.com',
        'Firefox',
        '10.0.0.1',
      );
    });

    it('should skip gracefully when user has no email', async () => {
      repo.findById.mockResolvedValue(null);

      await service.insertLoginLog('user-1', null, 'Chrome', '192.168.1.1');

      expect(repo.insertLoginLog).not.toHaveBeenCalled();
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return user when found', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' } as any;
      repo.findById.mockResolvedValue(mockUser);

      const result = await service.findByIdOrThrow('user-1');

      expect(result).toEqual(mockUser);
    });

    it('should throw BadRequestException when user not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findByIdOrThrow('bad-id')).rejects.toThrow(BadRequestException);
    });
  });
});
