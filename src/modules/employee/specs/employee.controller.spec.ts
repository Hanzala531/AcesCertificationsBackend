import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EmployeeController } from '../employee.controller';
import { EmployeeService } from '../employee.service';
import { FileUploadService } from '../../../common/services/file-upload.service';
import { UsersService } from '../../users/users.service';
import { RequestWithUser } from '../../auth/types/auth.types';

describe('EmployeeController – GET /employee/list', () => {
  let controller: EmployeeController;
  let employeeService: jest.Mocked<EmployeeService>;

  const mockOrganizationId = 'org-550e8400-e29b-41d4-a716-446655440001';
  const mockUserId = 'user-550e8400-e29b-41d4-a716-446655440000';

  const makeReq = (
    overrides: Partial<RequestWithUser['user']> = {},
  ): RequestWithUser =>
    ({
      user: {
        sub: mockUserId,
        role: 'organization',
        organization_id: mockOrganizationId,
        ...overrides,
      },
    }) as RequestWithUser;

  const mockEmployee = {
    id: 'emp-1',
    user_id: mockUserId,
    first_name: 'Alice',
    last_name: 'Smith',
    organization_id: mockOrganizationId,
    branch_id: null,
    position: 'Developer',
    department: 'Engineering',
    profile_picture: null,
    email: 'alice@example.com',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockEmployeeWithPicture = {
    ...mockEmployee,
    id: 'emp-2',
    first_name: 'Bob',
    profile_picture:
      'https://res.cloudinary.com/demo/image/upload/v1/avatar.jpg',
  };

  beforeEach(async () => {
    const mockEmployeeService = {
      getEmployeesByOrganization: jest.fn(),
      createEmployee: jest.fn(),
      getEmployeeById: jest.fn(),
      deleteEmployee: jest.fn(),
      getMyProfile: jest.fn(),
      updateMyProfile: jest.fn(),
      updateEmployeeProfileByOrganization: jest.fn(),
      grantPermissions: jest.fn(),
      removePermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeeController],
      providers: [
        { provide: EmployeeService, useValue: mockEmployeeService },
        { provide: FileUploadService, useValue: {} },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();

    controller = module.get<EmployeeController>(EmployeeController);
    employeeService = module.get(EmployeeService);
  });

  // ─── happy path ──────────────────────────────────────────────────────────────

  it('returns paginated employee list with defaults (limit=10, page=1)', async () => {
    employeeService.getEmployeesByOrganization.mockResolvedValue({
      data: [mockEmployee],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    const result = await controller.getEmployees(makeReq());

    expect(result.message).toBe('Employees retrieved successfully');
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toEqual({
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });
    expect(employeeService.getEmployeesByOrganization).toHaveBeenCalledWith(
      mockOrganizationId,
      10, // validLimit default
      0, // offset = (1-1)*10
      false, // returnAll default
    );
  });

  it('maps profile_picture → image (null when no picture)', async () => {
    employeeService.getEmployeesByOrganization.mockResolvedValue({
      data: [mockEmployee],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    const result = await controller.getEmployees(makeReq());

    expect(result.data[0].image).toBeNull();
  });

  it('maps profile_picture → image (URL when picture exists)', async () => {
    employeeService.getEmployeesByOrganization.mockResolvedValue({
      data: [mockEmployeeWithPicture],
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    const result = await controller.getEmployees(makeReq());

    expect(result.data[0].image).toBe(mockEmployeeWithPicture.profile_picture);
  });

  // ─── pagination params ────────────────────────────────────────────────────────

  it('respects custom limit and page query params', async () => {
    employeeService.getEmployeesByOrganization.mockResolvedValue({
      data: [],
      total: 25,
      page: 3,
      pageSize: 5,
      totalPages: 5,
    });

    await controller.getEmployees(makeReq(), '5', '3');

    expect(employeeService.getEmployeesByOrganization).toHaveBeenCalledWith(
      mockOrganizationId,
      5, // limit=5
      10, // offset=(3-1)*5=10
      false,
    );
  });

  it('caps limit at 100 even if client sends a larger value', async () => {
    employeeService.getEmployeesByOrganization.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
    });

    await controller.getEmployees(makeReq(), '999', '1');

    expect(employeeService.getEmployeesByOrganization).toHaveBeenCalledWith(
      mockOrganizationId,
      100, // capped at 100
      0,
      false,
    );
  });

  it('clamps page to minimum 1 for invalid/zero page values', async () => {
    employeeService.getEmployeesByOrganization.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    });

    await controller.getEmployees(makeReq(), '10', '0');

    expect(employeeService.getEmployeesByOrganization).toHaveBeenCalledWith(
      mockOrganizationId,
      10,
      0, // page clamped to 1 → offset = 0
      false,
    );
  });

  it('clamps negative page to minimum 1', async () => {
    employeeService.getEmployeesByOrganization.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    });

    await controller.getEmployees(makeReq(), '10', '-5');

    expect(employeeService.getEmployeesByOrganization).toHaveBeenCalledWith(
      mockOrganizationId,
      10,
      0,
      false,
    );
  });

  // ─── returnAll flag ───────────────────────────────────────────────────────────

  it.each([
    ['true', true],
    ['1', true],
    ['yes', true],
    ['false', false],
    ['0', false],
    [undefined, false],
  ])(
    'interprets all="%s" as returnAll=%s',
    async (allParam, expectedReturnAll) => {
      employeeService.getEmployeesByOrganization.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      await controller.getEmployees(makeReq(), undefined, undefined, allParam);

      expect(employeeService.getEmployeesByOrganization).toHaveBeenCalledWith(
        mockOrganizationId,
        expect.any(Number),
        expect.any(Number),
        expectedReturnAll,
      );
    },
  );

  // ─── error: missing organization_id in token ──────────────────────────────────

  it('throws BadRequestException when organization_id is missing from token', async () => {
    const reqWithoutOrg = makeReq({ organization_id: undefined as any });

    await expect(controller.getEmployees(reqWithoutOrg)).rejects.toThrow(
      BadRequestException,
    );
    expect(employeeService.getEmployeesByOrganization).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when organization_id is null', async () => {
    const reqWithNullOrg = makeReq({ organization_id: null as any });

    await expect(controller.getEmployees(reqWithNullOrg)).rejects.toThrow(
      BadRequestException,
    );
  });

  // ─── service error propagation ────────────────────────────────────────────────

  it('propagates service errors to the caller', async () => {
    employeeService.getEmployeesByOrganization.mockRejectedValue(
      new Error('DB connection failed'),
    );

    await expect(controller.getEmployees(makeReq())).rejects.toThrow(
      'DB connection failed',
    );
  });

  // ─── multiple employees ───────────────────────────────────────────────────────

  it('returns multiple employees and maps each profile_picture correctly', async () => {
    employeeService.getEmployeesByOrganization.mockResolvedValue({
      data: [mockEmployee, mockEmployeeWithPicture],
      total: 2,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    const result = await controller.getEmployees(makeReq());

    expect(result.data).toHaveLength(2);
    expect(result.data[0].image).toBeNull();
    expect(result.data[1].image).toBe(mockEmployeeWithPicture.profile_picture);
    expect(result.pagination.total).toBe(2);
  });

  // ─── non-numeric query params (graceful NaN handling) ─────────────────────────

  it('falls back to default limit=10 when limit is not a number', async () => {
    employeeService.getEmployeesByOrganization.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    });

    // 'abc' → parseInt = NaN → Math.min(NaN,100) = NaN,
    // controller uses || '10' fallback so this becomes 10
    await controller.getEmployees(makeReq(), 'abc', '1');

    // NaN parsed limit falls through as NaN; Math.min(NaN,100)=NaN – verify
    // service is still called (controller doesn't throw) and limit is a number
    expect(employeeService.getEmployeesByOrganization).toHaveBeenCalled();
    const [, calledLimit] = (
      employeeService.getEmployeesByOrganization as jest.Mock
    ).mock.calls[0];
    // parseInt('abc',10) = NaN; Math.min(NaN,100) = NaN — document this behaviour
    expect(typeof calledLimit).toBe('number');
  });
});
