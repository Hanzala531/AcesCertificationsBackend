import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../../database/database.module';
import { CommonModule } from '../../common/common.module';
import { AuditorModule } from '../auditor/auditor.module';
import { ReviewerModule } from '../reviewer/reviewer.module';
import { SubadminModule } from '../subadmin/subadmin.module';
import { OrganizationModule } from '../organization/organization.module';
import { IndustryModule } from '../industry/industry.module';
import { EmployeeModule } from '../employee/employee.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    PassportModule,
    CommonModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'change-me',
      }),
    }),
    UsersModule,
    AuditorModule,
    ReviewerModule,
    SubadminModule,
    OrganizationModule,
    IndustryModule,
    EmployeeModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, UsersModule],
})
export class AuthModule {}
