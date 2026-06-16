import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../database/database.module';
import { AuditLogRepository } from './audit-log.repository';
import { AuditLogService } from './audit-log.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditAdminController } from './controllers/audit-admin.controller';

@Global()
@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule],
  providers: [
    AuditLogRepository,
    AuditLogService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  controllers: [AuditAdminController],
  exports: [AuditLogService, AuditLogRepository],
})
export class AuditModule {}
