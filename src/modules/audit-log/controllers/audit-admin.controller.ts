import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleGuard } from '../../auth/role.guard';
import { Roles } from '../../auth/roles.decorator';
import { AuditLogRepository } from '../audit-log.repository';
import {
  AuditLogExportDto,
  AuditLogQueryDto,
} from '../dto/audit-log-query.dto';

const MAX_EXPORT_DAYS = parseInt(
  process.env.AUDIT_LOG_MAX_EXPORT_DAYS ?? '90',
  10,
);
const EXPORT_ROW_LIMIT = 10_000;

@ApiTags('Audit Logs')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), RoleGuard)
@Roles('admin', 'superadmin')
@Controller('admin/audit-logs')
export class AuditAdminController {
  constructor(private readonly auditRepo: AuditLogRepository) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs (paginated)' })
  async findAll(@Query() query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);

    const filters = {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      actor_id: query.actor_id,
      action: query.action,
      category: query.category,
    };

    const { items, total } = await this.auditRepo.findPaginated(
      filters,
      page,
      limit,
    );

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export audit logs as JSON download' })
  async export(
    @Query() query: AuditLogExportDto,
    @Res() res: Response,
  ): Promise<void> {
    const to = query.to ? new Date(query.to) : new Date();
    const requestedFrom = query.from
      ? new Date(query.from)
      : new Date(Date.now() - MAX_EXPORT_DAYS * 24 * 60 * 60 * 1000);

    const earliestAllowed = new Date(
      to.getTime() - MAX_EXPORT_DAYS * 24 * 60 * 60 * 1000,
    );
    const from =
      requestedFrom < earliestAllowed ? earliestAllowed : requestedFrom;

    const data = await this.auditRepo.findForExport(from, to, EXPORT_ROW_LIMIT);

    const filename = `audit-logs-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(data);
  }
}