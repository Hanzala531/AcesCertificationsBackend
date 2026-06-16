import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { CommonModule } from '../../common/common.module';
import { NotificationService } from './services/notification.service';
import { NotificationEmailService } from './services/notification-email.service';
import { NotificationGateway } from './websocket/notification.gateway';
import { ConnectionManagerService } from './websocket/connection-manager.service';
import { NotificationRepository } from './notification.repository';
import { BadgeRepository } from './badge.repository';
import { BadgeService } from './badge.service';
import {
  NotificationController,
  BadgeController,
} from './notification.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    CommonModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'change-me',
      }),
    }),
  ],
  controllers: [NotificationController, BadgeController],
  providers: [
    NotificationService,
    NotificationEmailService,
    NotificationGateway,
    ConnectionManagerService,
    NotificationRepository,
    BadgeRepository,
    BadgeService,
  ],
  exports: [
    NotificationService,
    NotificationEmailService,
    NotificationGateway,
    ConnectionManagerService,
    NotificationRepository,
    BadgeRepository,
    BadgeService,
  ],
})
export class NotificationModule {}
