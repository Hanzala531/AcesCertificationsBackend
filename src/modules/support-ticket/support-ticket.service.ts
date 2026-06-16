import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { SupportTicketRepository } from './support-ticket.repository';
import { CertificateRepository } from '../certificate/certificate.repository';
import { ChatService } from '../chat/chat.service';
import { NotificationService } from '../notification/services/notification.service';
import { NotificationRepository } from '../notification/notification.repository';
import {
  NotificationType,
  NotificationPriority,
} from '../notification/types/notification.types';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import {
  SupportTicketStatus,
  SupportTicketTargetType,
  SupportTicketType,
  SupportTicketWithCertificate,
} from './types/support-ticket.types';

const TERMINAL_STATUSES: SupportTicketStatus[] = ['completed'];

@Injectable()
export class SupportTicketService {
  private readonly logger = new Logger(SupportTicketService.name);

  constructor(
    private readonly ticketRepo: SupportTicketRepository,
    private readonly certificateRepo: CertificateRepository,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    private readonly notificationService: NotificationService,
    private readonly notificationRepo: NotificationRepository,
  ) {}

  async create(
    userId: string,
    dto: CreateSupportTicketDto,
  ): Promise<SupportTicketWithCertificate> {
    const ticketType: SupportTicketType = dto.ticket_type || 'support';
    const targetType: SupportTicketTargetType =
      dto.target_type || 'certificate';
    const effectiveCertificateId =
      dto.certificate_id ||
      (targetType === 'certificate' ? dto.target_id : undefined);

    if (
      targetType !== 'other' &&
      !dto.target_id &&
      targetType !== 'certificate'
    ) {
      throw new BadRequestException(
        'target_id is required when target_type is not "certificate" or "other"',
      );
    }

    if (targetType === 'other' && dto.target_id) {
      throw new BadRequestException(
        'target_id must be omitted when target_type is "other"',
      );
    }

    if (targetType === 'certificate' && !effectiveCertificateId) {
      throw new BadRequestException(
        'certificate_id is required when target_type is "certificate"',
      );
    }

    let certificate: { name: string; certificate_id: string } | null = null;
    if (effectiveCertificateId) {
      certificate = await this.certificateRepo.findCertificateById(
        effectiveCertificateId,
      );
      if (!certificate) {
        throw new NotFoundException(
          `Certificate with ID ${effectiveCertificateId} not found`,
        );
      }
    }

    const ticket = await this.ticketRepo.create({
      user_id: userId,
      subject: dto.subject,
      category: dto.category,
      certificate_id: effectiveCertificateId || null,
      description: dto.description,
      supporting_document: dto.supporting_document,
      ticket_type: ticketType,
      target_type: targetType,
      target_id:
        targetType === 'certificate'
          ? dto.target_id || effectiveCertificateId
          : dto.target_id || null,
      metadata: dto.metadata || {},
    });

    const result: SupportTicketWithCertificate = {
      ...ticket,
      certificate_name: certificate?.name || null,
      product_id: certificate?.certificate_id || null,
    };

    // Auto-create chat thread for the support ticket
    try {
      await this.chatService.createSupportTicketThread(
        ticket.id,
        userId,
        'applicant',
      );
      this.logger.log(
        `Chat thread created for support ticket ${ticket.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create chat thread for support ticket ${ticket.id}: ${error.message}`,
      );
    }

    // Notify admins about the new support ticket (persisted to DB)
    try {
      const adminUserIds = await this.notificationRepo.getUserIdsByRoles([
        'admin',
        'subadmin',
      ]);
      if (adminUserIds.length > 0) {
        await this.notificationService.notifyUsers(adminUserIds, {
          type: NotificationType.ACTION_REQUIRED,
          priority: NotificationPriority.HIGH,
          title: 'New Support Ticket',
          message: `New ${ticketType} ticket: "${dto.subject}"`,
          module: 'support',
          metadata: {
            support_ticket_id: ticket.id,
            ticket_type: ticketType,
            category: dto.category,
            subject: dto.subject,
            certificate_name: certificate?.name || null,
          },
        });
        this.logger.log(
          `Admin notification sent to ${adminUserIds.length} admin(s) for support ticket ${ticket.id}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send admin notification for support ticket ${ticket.id}: ${error.message}`,
      );
    }

    return result;
  }

  async findById(id: string): Promise<SupportTicketWithCertificate> {
    const ticket = await this.ticketRepo.findById(id);
    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }
    return ticket;
  }

  async findAll(params: {
    page: number;
    limit: number;
    status?: SupportTicketStatus;
    category?: string;
    certificate_id?: string;
    ticket_type?: SupportTicketType;
    target_type?: SupportTicketTargetType;
    target_id?: string;
    user_id?: string;
  }): Promise<{
    data: SupportTicketWithCertificate[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { data, total } = await this.ticketRepo.findAll(params);
    return { data, total, page: params.page, limit: params.limit };
  }

  async updateStatus(
    id: string,
    status: SupportTicketStatus,
    actedBy?: string,
  ): Promise<SupportTicketWithCertificate> {
    const existing = await this.ticketRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    if (existing.status === status) {
      throw new BadRequestException(`Ticket is already in '${status}' status`);
    }

    const updated = await this.ticketRepo.updateStatus(id, status, actedBy);
    if (!updated) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }

    // Auto-lock chat thread when ticket reaches a terminal status
    if (TERMINAL_STATUSES.includes(status)) {
      try {
        await this.chatService.lockSupportTicketThread(
          id,
          `Support ticket ${status}`,
        );
        this.logger.log(
          `Chat thread locked for support ticket ${id} (status: ${status})`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to lock chat thread for support ticket ${id}: ${error.message}`,
        );
      }
    }

    // Notify the ticket creator about the status change
    try {
      await this.notificationService.notifyUser(existing.user_id, {
        type: NotificationType.INFO,
        priority: NotificationPriority.MEDIUM,
        title: 'Support Ticket Updated',
        message: `Your ticket "${existing.subject}" has been updated to "${status}"`,
        module: 'support',
        metadata: {
          support_ticket_id: id,
          new_status: status,
          subject: existing.subject,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify user about ticket status change ${id}: ${error.message}`,
      );
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.ticketRepo.findById(id);
    if (!existing) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }
    await this.ticketRepo.delete(id);
  }
}
