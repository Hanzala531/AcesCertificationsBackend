import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeRepository } from './employee.repository';
import { EmployeeGateway } from './employee.gateway';
import { DatabaseModule } from '../../database/database.module';
import { UsersModule } from '../users/users.module';
import { OrganizationModule } from '../organization/organization.module';
import { BranchRepository } from '../branches/branches.repository';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    OrganizationModule,
    CommonModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  controllers: [EmployeeController],
  providers: [
    EmployeeService,
    EmployeeRepository,
    BranchRepository,
    EmployeeGateway,
  ],
  exports: [EmployeeService, EmployeeRepository, EmployeeGateway],
})
export class EmployeeModule {}
