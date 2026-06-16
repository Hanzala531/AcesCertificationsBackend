import { Test, TestingModule } from '@nestjs/testing';
import { EmployeeService } from '../employee.service';
import { EmployeeRepository } from '../employee.repository';
import { UsersService } from '../../users/users.service';
import { OrganizationService } from '../../organization/organization.service';
import { BranchRepository } from '../../branches/branches.repository';
import { EmailService } from '../../../common/services/email.service';
import { EmployeeGateway } from '../employee.gateway';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { EmployeeRecord } from '../types/employee.types';
import { UserRole, UserEntity } from '../../../common/types/database.types';
import { CreatedUser } from '../../users/users.repository';
import { BranchRecord } from '../../branches/types/branch.types';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

describe('EmployeeService', () => {
  let service: EmployeeService;
  let employeeRepository: jest.Mocked<EmployeeRepository>;
  let usersService: jest.Mocked<UsersService>;
  let organizationService: jest.Mocked<OrganizationService>;
  let branchRepository: jest.Mocked<BranchRepository>;
  let emailService: jest.Mocked<EmailService>;
  let employeeGateway: jest.Mocked<EmployeeGateway>;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockOrganizationId = '550e8400-e29b-41d4-a716-446655440001';
  const mockBranchId = '550e8400-e29b-41d4-a716-446655440002';
  const mockEmployeeId = '550e8400-e29b-41d4-a716-446655440003';

  const mockOrganization = {
    id: mockOrganizationId,
    user_id: mockUserId,
    name: 'Test Organization',
    total_branches: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockEmployee: EmployeeRecord = {
    id: mockEmployeeId,
    user_id: mockUserId,
    first_name: 'John',
    last_name: 'Doe',
    organization_id: mockOrganizationId,
    branch_id: mockBranchId,
    position: 'Software Engineer',
    department: 'Engineering',
    profile_picture: null,
    email: 'john.doe@example.com',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUser: CreatedUser = {
    id: mockUserId,
    email: 'john.doe@example.com',
    role: 'organization_member' as UserRole,
    created_at: new Date(),
  };

  const mockBranch: BranchRecord = {
    id: mockBranchId,
    organization_id: mockOrganizationId,
    name: 'Main Branch',
    address: '123 Main St',
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
    const mockEmployeeRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findByOrganizationId: jest.fn(),
      findAllByOrganizationId: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      exists: jest.fn(),
      existsByUserIdAndOrganization: jest.fn(),
      updatePermissionsAdd: jest.fn(),
      updatePermissionsRemove: jest.fn(),
    };

    const mockUsersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      markAsVerified: jest.fn(),
    };

    const mockOrganizationService = {
      findById: jest.fn(),
    };

    const mockBranchRepository = {
      findByIdAndOrganization: jest.fn(),
    };

    const mockEmailService = {
      sendCredentialsEmail: jest.fn().mockResolvedValue(undefined),
    };

    const mockEmployeeGateway = {
      emitEmployeeStatusChanged: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeService,
        { provide: EmployeeRepository, useValue: mockEmployeeRepository },
        { provide: UsersService, useValue: mockUsersService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: BranchRepository, useValue: mockBranchRepository },
        { provide: EmailService, useValue: mockEmailService },
        { provide: EmployeeGateway, useValue: mockEmployeeGateway },
      ],
    }).compile();

    service = module.get<EmployeeService>(EmployeeService);
    employeeRepository = module.get(EmployeeRepository);
    usersService = module.get(UsersService);
    organizationService = module.get(OrganizationService);
    branchRepository = module.get(BranchRepository);
    emailService = module.get(EmailService);
    employeeGateway = module.get(EmployeeGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createEmployee', () => {
    const createDto: CreateEmployeeDto = {
      email: 'new.employee@example.com',
      first_name: 'Jane',
      last_name: 'Smith',
      position: 'Product Manager',
      department: 'Product',
      branch_id: mockBranchId,
    };

    it('should create employee successfully', async () => {
      organizationService.findById.mockResolvedValue(mockOrganization);
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      usersService.markAsVerified.mockResolvedValue(undefined);
      employeeRepository.create.mockResolvedValue(mockEmployee);
      emailService.sendCredentialsEmail.mockResolvedValue(false);

      const result = await service.createEmployee(
        mockOrganizationId,
        mockUserId,
        createDto,
      );

      expect(result).toEqual(mockEmployee);
      expect(organizationService.findById).toHaveBeenCalledWith(
        mockOrganizationId,
      );
      expect(branchRepository.findByIdAndOrganization).toHaveBeenCalledWith(
        mockBranchId,
        mockOrganizationId,
      );
      expect(usersService.findByEmail).toHaveBeenCalledWith(createDto.email);
      expect(usersService.create).toHaveBeenCalledWith({
        email: createDto.email,
        password: expect.any(String),
        role: 'organization_member',
      });
      expect(usersService.markAsVerified).toHaveBeenCalledWith(mockUser.id);
      expect(employeeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUser.id,
          first_name: createDto.first_name,
          last_name: createDto.last_name,
          organization_id: mockOrganizationId,
          branch_id: createDto.branch_id,
          position: createDto.position,
          department: createDto.department,
        }),
      );
    });

    it('should create employee without branch', async () => {
      const createDtoWithoutBranch = { ...createDto, branch_id: undefined };
      const employeeWithoutBranch = { ...mockEmployee, branch_id: null };

      organizationService.findById.mockResolvedValue(mockOrganization);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      usersService.markAsVerified.mockResolvedValue(undefined);
      employeeRepository.create.mockResolvedValue(employeeWithoutBranch);

      const result = await service.createEmployee(
        mockOrganizationId,
        mockUserId,
        createDtoWithoutBranch,
      );

      expect(result.branch_id).toBeNull();
      expect(employeeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ branch_id: null }),
      );
    });

    it('should throw NotFoundException when organization not found', async () => {
      organizationService.findById.mockResolvedValue(null);

      await expect(
        service.createEmployee('nonexistent-org', mockUserId, createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not organization owner', async () => {
      const wrongOrganization = {
        ...mockOrganization,
        user_id: 'different-user-id',
      };
      organizationService.findById.mockResolvedValue(wrongOrganization);

      await expect(
        service.createEmployee(mockOrganizationId, mockUserId, createDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when branch does not belong to organization', async () => {
      organizationService.findById.mockResolvedValue(mockOrganization);
      branchRepository.findByIdAndOrganization.mockResolvedValue(null);

      await expect(
        service.createEmployee(mockOrganizationId, mockUserId, createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when user with email already exists', async () => {
      organizationService.findById.mockResolvedValue(mockOrganization);
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      usersService.findByEmail.mockResolvedValue(mockUser as UserEntity);

      await expect(
        service.createEmployee(mockOrganizationId, mockUserId, createDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should create employee with minimal required fields', async () => {
      const minimalDto: CreateEmployeeDto = {
        email: 'minimal@example.com',
        first_name: 'Min',
        last_name: 'User',
      };

      organizationService.findById.mockResolvedValue(mockOrganization);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      usersService.markAsVerified.mockResolvedValue(undefined);
      employeeRepository.create.mockResolvedValue({
        ...mockEmployee,
        first_name: minimalDto.first_name,
        last_name: minimalDto.last_name,
        position: null,
        department: null,
        branch_id: null,
      });

      const result = await service.createEmployee(
        mockOrganizationId,
        mockUserId,
        minimalDto,
      );

      expect(result.first_name).toBe(minimalDto.first_name);
      expect(result.last_name).toBe(minimalDto.last_name);
      expect(result.position).toBeNull();
      expect(result.department).toBeNull();
      expect(result.branch_id).toBeNull();
    });
  });

  describe('getEmployeesByOrganization', () => {
    const mockEmployees = [mockEmployee];
    const mockTotal = 1;

    it('should return paginated employees successfully', async () => {
      organizationService.findById.mockResolvedValue(mockOrganization);
      employeeRepository.findByOrganizationId.mockResolvedValue({
        data: mockEmployees,
        total: mockTotal,
      });

      const result =
        await service.getEmployeesByOrganization(mockOrganizationId);

      expect(result.data).toEqual(mockEmployees);
      expect(result.total).toBe(mockTotal);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(organizationService.findById).toHaveBeenCalledWith(
        mockOrganizationId,
      );
      expect(employeeRepository.findByOrganizationId).toHaveBeenCalledWith(
        mockOrganizationId,
        10,
        0,
      );
    });

    it('should return paginated employees with custom parameters', async () => {
      organizationService.findById.mockResolvedValue(mockOrganization);
      employeeRepository.findByOrganizationId.mockResolvedValue({
        data: mockEmployees,
        total: mockTotal,
      });

      const result = await service.getEmployeesByOrganization(
        mockOrganizationId,
        5,
        10,
      );

      expect(result.page).toBe(3); // Math.floor(10 / 5) + 1
      expect(result.pageSize).toBe(5);
      expect(employeeRepository.findByOrganizationId).toHaveBeenCalledWith(
        mockOrganizationId,
        5,
        10,
      );
    });

    it('should throw NotFoundException when organization not found', async () => {
      organizationService.findById.mockResolvedValue(null);

      await expect(
        service.getEmployeesByOrganization('nonexistent-org'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow listing even if requester is not the organization owner', async () => {
      const wrongOrganization = {
        ...mockOrganization,
        user_id: 'different-user-id',
      };
      organizationService.findById.mockResolvedValue(wrongOrganization);
      employeeRepository.findByOrganizationId.mockResolvedValue({
        data: mockEmployees,
        total: mockTotal,
      });

      const result =
        await service.getEmployeesByOrganization(mockOrganizationId);

      expect(result.data).toEqual(mockEmployees);
      expect(result.total).toBe(mockTotal);
    });

    it('should limit page size to maximum 100', async () => {
      organizationService.findById.mockResolvedValue(mockOrganization);
      employeeRepository.findByOrganizationId.mockResolvedValue({
        data: mockEmployees,
        total: mockTotal,
      });

      await service.getEmployeesByOrganization(mockOrganizationId, 200, 0);

      expect(employeeRepository.findByOrganizationId).toHaveBeenCalledWith(
        mockOrganizationId,
        100,
        0,
      );
    });

    it('should ensure minimum limit of 1', async () => {
      organizationService.findById.mockResolvedValue(mockOrganization);
      employeeRepository.findByOrganizationId.mockResolvedValue({
        data: mockEmployees,
        total: mockTotal,
      });

      await service.getEmployeesByOrganization(mockOrganizationId, 0, 0);

      expect(employeeRepository.findByOrganizationId).toHaveBeenCalledWith(
        mockOrganizationId,
        1,
        0,
      );
    });

    it('should ensure minimum offset of 0', async () => {
      organizationService.findById.mockResolvedValue(mockOrganization);
      employeeRepository.findByOrganizationId.mockResolvedValue({
        data: mockEmployees,
        total: mockTotal,
      });

      await service.getEmployeesByOrganization(mockOrganizationId, 10, -5);

      expect(employeeRepository.findByOrganizationId).toHaveBeenCalledWith(
        mockOrganizationId,
        10,
        0,
      );
    });

    it('should return all employees when requested with all=true', async () => {
      organizationService.findById.mockResolvedValue(mockOrganization);
      employeeRepository.findAllByOrganizationId.mockResolvedValue({
        data: mockEmployees,
        total: mockTotal,
      });

      const result = await service.getEmployeesByOrganization(
        mockOrganizationId,
        10,
        0,
        true,
      );

      expect(employeeRepository.findAllByOrganizationId).toHaveBeenCalledWith(
        mockOrganizationId,
      );
      expect(result.data).toEqual(mockEmployees);
      expect(result.total).toBe(mockTotal);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(mockTotal);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('getEmployeeById', () => {
    it('should return employee by ID successfully', async () => {
      employeeRepository.findById.mockResolvedValue(mockEmployee);
      organizationService.findById.mockResolvedValue(mockOrganization);

      const result = await service.getEmployeeById(mockEmployeeId, mockUserId);

      expect(result).toEqual(mockEmployee);
      expect(employeeRepository.findById).toHaveBeenCalledWith(mockEmployeeId);
      expect(organizationService.findById).toHaveBeenCalledWith(
        mockOrganizationId,
      );
    });

    it('should throw NotFoundException when employee not found', async () => {
      employeeRepository.findById.mockResolvedValue(null);

      await expect(
        service.getEmployeeById('nonexistent-employee', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when organization not found', async () => {
      employeeRepository.findById.mockResolvedValue(mockEmployee);
      organizationService.findById.mockResolvedValue(null);

      await expect(
        service.getEmployeeById(mockEmployeeId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not organization owner', async () => {
      const wrongOrganization = {
        ...mockOrganization,
        user_id: 'different-user-id',
      };
      employeeRepository.findById.mockResolvedValue(mockEmployee);
      organizationService.findById.mockResolvedValue(wrongOrganization);

      await expect(
        service.getEmployeeById(mockEmployeeId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteEmployee', () => {
    it('should delete employee successfully', async () => {
      employeeRepository.findById.mockResolvedValue(mockEmployee);
      organizationService.findById.mockResolvedValue(mockOrganization);
      employeeRepository.delete.mockResolvedValue(undefined);

      await service.deleteEmployee(mockEmployeeId, mockUserId);

      expect(employeeRepository.findById).toHaveBeenCalledWith(mockEmployeeId);
      expect(organizationService.findById).toHaveBeenCalledWith(
        mockOrganizationId,
      );
      expect(employeeRepository.delete).toHaveBeenCalledWith(mockEmployeeId);
    });

    it('should throw NotFoundException when employee to delete not found', async () => {
      employeeRepository.findById.mockResolvedValue(null);

      await expect(
        service.deleteEmployee('nonexistent-employee', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when organization not found', async () => {
      employeeRepository.findById.mockResolvedValue(mockEmployee);
      organizationService.findById.mockResolvedValue(null);

      await expect(
        service.deleteEmployee(mockEmployeeId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not organization owner', async () => {
      const wrongOrganization = {
        ...mockOrganization,
        user_id: 'different-user-id',
      };
      employeeRepository.findById.mockResolvedValue(mockEmployee);
      organizationService.findById.mockResolvedValue(wrongOrganization);

      await expect(
        service.deleteEmployee(mockEmployeeId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
      expect(employeeRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('getMyProfile', () => {
    it('should return employee profile successfully', async () => {
      employeeRepository.findByUserId.mockResolvedValue(mockEmployee);

      const result = await service.getMyProfile(mockUserId);

      expect(result).toEqual(mockEmployee);
      expect(employeeRepository.findByUserId).toHaveBeenCalledWith(mockUserId);
    });

    it('should throw NotFoundException when employee profile not found', async () => {
      employeeRepository.findByUserId.mockResolvedValue(null);

      await expect(service.getMyProfile('nonexistent-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('temporary password generation', () => {
    it('should generate temporary password', async () => {
      organizationService.findById.mockResolvedValue(mockOrganization);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      usersService.markAsVerified.mockResolvedValue(undefined);
      employeeRepository.create.mockResolvedValue(mockEmployee);
      emailService.sendCredentialsEmail.mockResolvedValue(false);

      const createDto: CreateEmployeeDto = {
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
      };

      await service.createEmployee(mockOrganizationId, mockUserId, createDto);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: createDto.email,
          password: expect.any(String),
          role: 'organization_member',
        }),
      );

      const callArgs = (usersService.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.password).toBeTruthy();
      expect(typeof callArgs.password).toBe('string');
      expect(callArgs.password.length).toBeGreaterThan(0);
    });
  });

  describe('activatePendingStatusOnFirstLogin', () => {
    it('should activate pending employee and emit WebSocket event', async () => {
      const pendingEmployee = { ...mockEmployee, status: 'pending' as const };
      employeeRepository.findByUserId.mockResolvedValue(pendingEmployee);
      employeeRepository.update.mockResolvedValue({
        ...pendingEmployee,
        status: 'active',
      });

      await service.activatePendingStatusOnFirstLogin(mockUserId);

      expect(employeeRepository.update).toHaveBeenCalledWith(mockEmployeeId, {
        status: 'active',
      });
      expect(employeeGateway.emitEmployeeStatusChanged).toHaveBeenCalledWith(
        mockOrganizationId,
        {
          employeeId: mockEmployeeId,
          userId: mockUserId,
          firstName: 'John',
          lastName: 'Doe',
          status: 'active',
        },
      );
    });

    it('should not activate if employee not found', async () => {
      employeeRepository.findByUserId.mockResolvedValue(null);

      await service.activatePendingStatusOnFirstLogin('nonexistent-user');

      expect(employeeRepository.update).not.toHaveBeenCalled();
      expect(employeeGateway.emitEmployeeStatusChanged).not.toHaveBeenCalled();
    });

    it('should not activate if employee status is already active', async () => {
      const activeEmployee = { ...mockEmployee, status: 'active' as const };
      employeeRepository.findByUserId.mockResolvedValue(activeEmployee);

      await service.activatePendingStatusOnFirstLogin(mockUserId);

      expect(employeeRepository.update).not.toHaveBeenCalled();
      expect(employeeGateway.emitEmployeeStatusChanged).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete employee lifecycle', async () => {
      const createDto: CreateEmployeeDto = {
        email: 'lifecycle@example.com',
        first_name: 'Life',
        last_name: 'Cycle',
        position: 'Tester',
        department: 'QA',
        branch_id: mockBranchId,
      };

      // Create employee
      organizationService.findById.mockResolvedValue(mockOrganization);
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      usersService.markAsVerified.mockResolvedValue(undefined);
      employeeRepository.create.mockResolvedValue(mockEmployee);

      const created = await service.createEmployee(
        mockOrganizationId,
        mockUserId,
        createDto,
      );
      expect(created).toEqual(mockEmployee);

      employeeRepository.findByOrganizationId.mockResolvedValue({
        data: [mockEmployee],
        total: 1,
      });

      const employees =
        await service.getEmployeesByOrganization(mockOrganizationId);
      expect(employees.data).toHaveLength(1);

      employeeRepository.findById.mockResolvedValue(mockEmployee);
      const found = await service.getEmployeeById(mockEmployeeId, mockUserId);
      expect(found).toEqual(mockEmployee);

      employeeRepository.findByUserId.mockResolvedValue(mockEmployee);
      const profile = await service.getMyProfile(mockUserId);
      expect(profile).toEqual(mockEmployee);

      await service.deleteEmployee(mockEmployeeId, mockUserId);
      expect(employeeRepository.delete).toHaveBeenCalledWith(mockEmployeeId);

      expect(employeeRepository.create).toHaveBeenCalled();
      expect(employeeRepository.findByOrganizationId).toHaveBeenCalled();
      expect(employeeRepository.findById).toHaveBeenCalledTimes(2);
      expect(employeeRepository.findByUserId).toHaveBeenCalled();
      expect(employeeRepository.delete).toHaveBeenCalled();
    });

    it('should handle branch assignment correctly', async () => {
      const createDto: CreateEmployeeDto = {
        email: 'branch.user@example.com',
        first_name: 'Branch',
        last_name: 'User',
        branch_id: mockBranchId,
      };

      organizationService.findById.mockResolvedValue(mockOrganization);
      branchRepository.findByIdAndOrganization.mockResolvedValue(mockBranch);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      usersService.markAsVerified.mockResolvedValue(undefined);
      employeeRepository.create.mockResolvedValue(mockEmployee);

      const result = await service.createEmployee(
        mockOrganizationId,
        mockUserId,
        createDto,
      );

      expect(result.branch_id).toBe(mockBranchId);
      expect(branchRepository.findByIdAndOrganization).toHaveBeenCalledWith(
        mockBranchId,
        mockOrganizationId,
      );
    });
  });
});
