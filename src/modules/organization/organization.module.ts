import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CommonModule } from '../../common/common.module';
import { UsersModule } from '../users/users.module';
import { OrganizationService } from './organization.service';
import { OrganizationRepository } from './organization.repository';
import { OrganizationController } from './organization.controller';

@Module({
  imports: [DatabaseModule, CommonModule, UsersModule],
  providers: [OrganizationService, OrganizationRepository],
  controllers: [OrganizationController],
  exports: [OrganizationService, OrganizationRepository],
})
export class OrganizationModule {}
