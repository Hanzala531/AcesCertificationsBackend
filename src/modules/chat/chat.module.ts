import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatRepository } from './chat.repository';
import { ChatGateway } from './chat.gateway';
import { DatabaseModule } from '../../database/database.module';
import { AssessmentModule } from '../assessment/assessment.module';
import { SupportTicketModule } from '../support-ticket/support-ticket.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => AssessmentModule),
    forwardRef(() => SupportTicketModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatRepository, ChatGateway],
  exports: [ChatService, ChatRepository, ChatGateway],
})
export class ChatModule {}
