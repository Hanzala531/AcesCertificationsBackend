import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';

const mockUsersService = {
  getLoginLogs: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);

    jest.clearAllMocks();
  });

  describe('getLoginLogs', () => {
    const mockReq = { user: { sub: 'user-1', email: 'test@example.com', role: 'organization' } } as any;

    const mockServiceResult = {
      items: [
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
      ],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    it('should return mapped login logs with camelCase fields', async () => {
      usersService.getLoginLogs.mockResolvedValue(mockServiceResult);

      const result = await controller.getLoginLogs(mockReq);

      expect(usersService.getLoginLogs).toHaveBeenCalledWith('user-1', 1, 20);
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.data.total).toBe(2);
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.totalPages).toBe(1);

      // Verify items are mapped to clean format
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0]).toEqual({
        id: 'log-1',
        email: 'test@example.com',
        device: 'Chrome on Windows',
        location: '192.168.1.1',
        loginAt: new Date('2026-04-01T10:00:00Z'),
      });
      // user_id should NOT be in the response
      expect(result.data.items[0]).not.toHaveProperty('user_id');
      expect(result.data.items[0]).not.toHaveProperty('created_at');
    });

    it('should pass custom pagination parameters', async () => {
      usersService.getLoginLogs.mockResolvedValue({
        ...mockServiceResult,
        page: 2,
        limit: 10,
      });

      await controller.getLoginLogs(mockReq, '2', '10');

      expect(usersService.getLoginLogs).toHaveBeenCalledWith('user-1', 2, 10);
    });

    it('should clamp page to minimum of 1', async () => {
      usersService.getLoginLogs.mockResolvedValue(mockServiceResult);

      await controller.getLoginLogs(mockReq, '0');

      expect(usersService.getLoginLogs).toHaveBeenCalledWith('user-1', 1, 20);
    });

    it('should clamp limit to maximum of 100', async () => {
      usersService.getLoginLogs.mockResolvedValue(mockServiceResult);

      await controller.getLoginLogs(mockReq, '1', '500');

      expect(usersService.getLoginLogs).toHaveBeenCalledWith('user-1', 1, 100);
    });

    it('should handle invalid pagination strings gracefully', async () => {
      usersService.getLoginLogs.mockResolvedValue(mockServiceResult);

      await controller.getLoginLogs(mockReq, 'abc', 'xyz');

      expect(usersService.getLoginLogs).toHaveBeenCalledWith('user-1', 1, 20);
    });

    it('should return empty items when user has no login logs', async () => {
      usersService.getLoginLogs.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const result = await controller.getLoginLogs(mockReq);

      expect(result.data.items).toHaveLength(0);
      expect(result.data.total).toBe(0);
      expect(result.data.totalPages).toBe(0);
    });

    it('should handle null device and location gracefully', async () => {
      usersService.getLoginLogs.mockResolvedValue({
        items: [
          {
            id: 'log-3',
            user_id: 'user-1',
            email: 'test@example.com',
            device: null,
            location: null,
            created_at: new Date('2026-04-01T12:00:00Z'),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await controller.getLoginLogs(mockReq);

      expect(result.data.items[0].device).toBeNull();
      expect(result.data.items[0].location).toBeNull();
    });

    it('should include timestamp in response', async () => {
      usersService.getLoginLogs.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const result = await controller.getLoginLogs(mockReq);

      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
    });
  });
});
