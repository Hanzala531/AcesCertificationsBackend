import { Module, forwardRef } from '@nestjs/common';
import { SupportTicketController } from './support-ticket.controller';
import { SupportTicketService } from './support-ticket.service';
import { SupportTicketRepository } from './support-ticket.repository';
import { DatabaseModule } from '../../database/database.module';
import { CertificateModule } from '../certificate/certificate.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [DatabaseModule, CertificateModule, forwardRef(() => ChatModule), NotificationModule],
  controllers: [SupportTicketController],
  providers: [SupportTicketService, SupportTicketRepository],
  exports: [SupportTicketService, SupportTicketRepository],
})
export class SupportTicketModule {}
