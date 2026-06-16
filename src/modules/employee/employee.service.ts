import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EmployeeRepository } from './employee.repository';
import { UsersService } from '../users/users.service';
import { OrganizationService } from '../organization/organization.service';
import { BranchRepository } from '../branches/branches.repository';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmailService } from '../../common/services/email.service';
import { EmployeeGateway } from './employee.gateway';
import { EmployeeRecord } from './types/employee.types';
import { Logger } from '@nestjs/common';

@Injectable()
export class EmployeeService {
  private readonly logger = new Logger(EmployeeService.name);
  constructor(
    private employeeRepository: EmployeeRepository,
    private usersService: UsersService,
    private organizationService: OrganizationService,
    private branchRepository: BranchRepository,
    private emailService: EmailService,
    private employeeGateway: EmployeeGateway,
  ) {}

  private async verifyOrganizationAccess(
    organizationId: string,
    callerUserId: string,
  ): Promise<void> {
    const organization =
      await this.organizationService.findById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.user_id === callerUserId) {
      return;
    }

    const callerEmployee =
      await this.employeeRepository.findByUserId(callerUserId);
    if (callerEmployee && callerEmployee.organization_id === organizationId) {
      return;
    }

    throw new ForbiddenException(
      'You do not have permission to manage members of this organization',
    );
  }

  async createEmployee(
    organizationId: string,
    organizerUserId: string,
    dto: CreateEmployeeDto,
  ): Promise<EmployeeRecord> {
    await this.verifyOrganizationAccess(organizationId, organizerUserId);

    const organization =
      await this.organizationService.findById(organizationId);

    if (dto.branch_id) {
      const branch = await this.branchRepository.findByIdAndOrganization(
        dto.branch_id,
        organizationId,
      );
      if (!branch) {
        throw new BadRequestException(
          'Branch not found or does not belong to this organization',
        );
      }
    }

    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const temporaryPassword = this.generateTemporaryPassword();

    const user = await this.usersService.create({
      email: dto.email,
      password: temporaryPassword,
      role: 'organization_member',
    });

    await this.usersService.markAsVerified(user.id);

    const employee = await this.employeeRepository.create({
      user_id: user.id,
      first_name: dto.first_name,
      last_name: dto.last_name,
      organization_id: organizationId,
      branch_id: dto.branch_id || null,
      position: dto.position || null,
      department: dto.department || null,
      profile_picture: dto.profile_picture_url || null,
      phone_number: dto.phone_number || null,
      permissions: (dto as any).permissions || [],
    });

    try {
      await this.emailService.sendCredentialsEmail(
        dto.email,
        temporaryPassword,
        user.role === 'organization_member'
          ? 'Organization Member'
          : 'Employee',
        {
          createdBy: 'organization',
          organizationName: organization!.name,
        },
      );
    } catch (error) {
      const errorMsg =
        error instanceof Error && error.stack
          ? `${String(error)}\n${error.stack}`
          : String(error);
      this.logger.error(
        `Failed to send credentials email to ${dto.email}: ${errorMsg}`,
      );
    }

    return employee;
  }

  async getEmployeesByOrganization(
    organizationId: string,
    limit: number = 10,
    offset: number = 0,
    all: boolean = false,
  ): Promise<{
    data: EmployeeRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const organization =
      await this.organizationService.findById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (all) {
      const result =
        await this.employeeRepository.findAllByOrganizationId(organizationId);

      this.logger.debug(
        `Listing ALL employees for org ${organizationId} - found ${result.total}`,
      );

      return {
        data: result.data,
        total: result.total,
        page: 1,
        pageSize: result.total,
        totalPages: 1,
      };
    }

    const validLimit = Math.max(1, Math.min(limit, 100));
    const validOffset = Math.max(0, offset);

    const result = await this.employeeRepository.findByOrganizationId(
      organizationId,
      validLimit,
      validOffset,
    );

    this.logger.debug(
      `Listing employees for org ${organizationId} - page ${Math.floor(validOffset / validLimit) + 1}, pageSize ${validLimit}, found ${result.total}`,
    );

    return {
      data: result.data,
      total: result.total,
      page: Math.floor(validOffset / validLimit) + 1,
      pageSize: validLimit,
      totalPages: Math.ceil(result.total / validLimit),
    };
  }

  async getEmployeeById(
    id: string,
    callerUserId: string,
  ): Promise<EmployeeRecord> {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    await this.verifyOrganizationAccess(
      employee.organization_id,
      callerUserId,
    );

    return employee;
  }

  async deleteEmployee(id: string, callerUserId: string): Promise<void> {
    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    await this.verifyOrganizationAccess(
      employee.organization_id,
      callerUserId,
    );

    await this.employeeRepository.delete(id);
  }

  async getMyProfile(userId: string): Promise<EmployeeRecord> {
    let employee = await this.employeeRepository.findByUserId(userId);
    if (!employee) {
      employee = await this.employeeRepository.findById(userId);
    }
    if (!employee) {
      throw new NotFoundException('Employee profile not found');
    }
    return employee;
  }

  async updateMyProfile(
    userId: string,
    fields: Partial<{
      first_name: string;
      last_name: string;
      position: string | null;
      department: string | null;
      profile_picture: string | null;
      phone_number: string | null;
      branch_id: string | null;
    }>,
  ): Promise<EmployeeRecord> {
    const employee = await this.employeeRepository.findByUserId(userId);
    if (!employee) {
      throw new NotFoundException('Employee profile not found');
    }

    if (fields.branch_id) {
      const branch = await this.branchRepository.findByIdAndOrganization(
        fields.branch_id,
        employee.organization_id,
      );
      if (!branch) {
        throw new BadRequestException(
          'Branch not found or does not belong to this organization',
        );
      }
    }

    const updated = await this.employeeRepository.update(employee.id, fields);
    if (!updated) {
      throw new NotFoundException('Employee profile not found');
    }

    const withEmail = await this.employeeRepository.findById(updated.id);
    return withEmail || updated;
  }

  async updateEmployeeProfileByOrganization(
    employeeId: string,
    organizerUserId: string,
    fields: Partial<{
      first_name: string;
      last_name: string;
      position: string | null;
      department: string | null;
      profile_picture: string | null;
      phone_number: string | null;
      branch_id: string | null;
      permissions: unknown[] | null;
      status: 'pending' | 'active';
    }>,
  ): Promise<EmployeeRecord> {
    const employee = await this.getEmployeeById(employeeId, organizerUserId);

    if (fields.branch_id) {
      const branch = await this.branchRepository.findByIdAndOrganization(
        fields.branch_id,
        employee.organization_id,
      );
      if (!branch) {
        throw new BadRequestException(
          'Branch not found or does not belong to this organization',
        );
      }
    }

    const updated = await this.employeeRepository.update(employee.id, fields);
    if (!updated) {
      throw new NotFoundException('Employee not found');
    }

    const withEmail = await this.employeeRepository.findById(updated.id);
    return withEmail || updated;
  }

  async resendInvite(
    organizationId: string,
    callerUserId: string,
    email: string,
  ): Promise<void> {
    await this.verifyOrganizationAccess(organizationId, callerUserId);

    const organization =
      await this.organizationService.findById(organizationId);

    const employee = await this.employeeRepository.findByEmailAndOrganization(
      email,
      organizationId,
    );
    if (!employee) {
      throw new NotFoundException(
        'No employee found with this email in your organization',
      );
    }

    const temporaryPassword = this.generateTemporaryPassword();

    await this.usersService.updatePasswordWithPlaintext(
      employee.user_id,
      temporaryPassword,
    );

    await this.emailService.sendCredentialsEmail(
      email,
      temporaryPassword,
      'Organization Member',
      {
        createdBy: 'organization',
        organizationName: organization!.name,
      },
    );
  }

  async activatePendingStatusOnFirstLogin(userId: string): Promise<void> {
    const employee = await this.employeeRepository.findByUserId(userId);
    if (!employee) {
      return;
    }

    if (employee.status !== 'pending') {
      return;
    }

    await this.employeeRepository.update(employee.id, { status: 'active' });

    this.employeeGateway.emitEmployeeStatusChanged(employee.organization_id, {
      employeeId: employee.id,
      userId: employee.user_id,
      firstName: employee.first_name,
      lastName: employee.last_name,
      status: 'active',
    });
  }

  async grantPermissions(
    id: string,
    permissions: unknown[],
  ): Promise<unknown[] | null> {
    if (!Array.isArray(permissions)) {
      throw new BadRequestException('permissions must be an array');
    }
    for (const p of permissions) {
      if (!p || typeof p !== 'object') {
        throw new BadRequestException('each permission must be an object');
      }
      const rp: any = p as any;
      if (!rp.resource) {
        throw new BadRequestException(
          'each permission must have a resource field',
        );
      }
      if (!rp.action || !Array.isArray(rp.action)) {
        throw new BadRequestException(
          'each permission must have an action field that is an array of strings',
        );
      }
      if (rp.action.length === 0) {
        throw new BadRequestException(
          'action array must have at least one element',
        );
      }
      for (const action of rp.action) {
        if (typeof action !== 'string' || !action.trim()) {
          throw new BadRequestException(
            'each action in the action array must be a non-empty string',
          );
        }
      }
    }

    let employee = await this.employeeRepository.findById(id);
    if (!employee) {
      employee = await this.employeeRepository.findByUserId(id);
    }
    if (!employee) throw new NotFoundException('Employee not found');
    try {
      const updated = await this.employeeRepository.updatePermissionsAdd(
        employee.id,
        permissions,
      );
      return updated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(msg);
    }
  }

  async removePermissions(
    id: string,
    permissions: unknown[],
  ): Promise<unknown[] | null> {
    if (!Array.isArray(permissions)) {
      throw new BadRequestException('permissions must be an array');
    }

    let employee = await this.employeeRepository.findById(id);
    if (!employee) {
      employee = await this.employeeRepository.findByUserId(id);
    }
    if (!employee) throw new NotFoundException('Employee not found');
    try {
      const updated = await this.employeeRepository.updatePermissionsRemove(
        employee.id,
        permissions,
      );
      return updated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(msg);
    }
  }

  private generateTemporaryPassword(): string {
    return randomBytes(12).toString('base64').slice(0, 16);
  }
}
