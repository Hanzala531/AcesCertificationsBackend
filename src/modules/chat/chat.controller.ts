import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoleGuard } from '../auth/role.guard';
import { Roles } from '../auth/roles.decorator';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import {
  CreateChatThreadDto,
  CreateAuditorReviewerThreadDto,
  SendMessageDto,
  GetMessagesQueryDto,
  AddParticipantDto,
  LockThreadDto,
} from './dto/chat.dto';
import {
  SwaggerCreateThread,
  SwaggerCreateAuditorReviewerThread,
  SwaggerGetThread,
  SwaggerGetThreadByAssessment,
  SwaggerGetUserThreads,
  SwaggerSendMessage,
  SwaggerGetMessages,
  SwaggerGetParticipants,
  SwaggerAddParticipant,
  SwaggerAddApplicantToThread,
  SwaggerLockThread,
  SwaggerGetWebSocketStatus,
  SwaggerGetAssessmentThreadsAdmin,
  SwaggerGetAllAssessmentThreadsAdmin,
  SwaggerGetThreadBySupportTicket,
} from './swagger/chat.swagger';

interface RequestWithUser extends Request {
  user: {
    sub: string;
    role: string;
  };
}

@ApiTags('💬 Chat')
@ApiBearerAuth('JWT-auth')
@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  private readonly isServerless: boolean;

  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {
    this.isServerless = !!(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.FUNCTIONS_WORKER_RUNTIME
    );
  }

  @Get('websocket-status')
  @SwaggerGetWebSocketStatus()
  async getWebSocketStatus() {
    return {
      success: true,
      data: {
        websocketSupported: !this.isServerless,
        realtimeEnabled: !this.isServerless,
        message: this.isServerless
          ? 'WebSocket connections are not supported in serverless environments. Use REST API for messaging.'
          : 'WebSocket connections are available. Connect to /chat namespace for real-time messaging.',
        namespace: '/chat',
        events: {
          join_thread: 'Join a chat thread room',
          leave_thread: 'Leave a chat thread room',
          send_message: 'Send a message (via WebSocket)',
          typing: 'Broadcast typing indicator',
          mark_read: 'Mark messages as read',
        },
      },
    };
  }

  @Post('threads')
  @Roles('admin', 'subadmin', 'organization', 'organization_member', 'auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @SwaggerCreateThread()
  async createThread(
    @Request() req: RequestWithUser,
    @Body() dto: CreateChatThreadDto,
  ) {
    const { canAccess, participantRole } =
      await this.chatService.validateChatAccess(
        req.user.sub,
        req.user.role,
        dto.assessmentId,
      );

    if (!canAccess || !participantRole) {
      return {
        success: false,
        message: 'You do not have access to this assessment',
        statusCode: HttpStatus.FORBIDDEN,
      };
    }

    const thread = await this.chatService.createThread(
      dto.assessmentId,
      req.user.sub,
      participantRole,
    );

    return {
      success: true,
      message: 'Chat thread created successfully',
      data: this.formatThread(thread),
    };
  }

  @Post('threads/auditor-reviewer')
  @Roles('auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @SwaggerCreateAuditorReviewerThread()
  async createAuditorReviewerThread(
    @Request() req: RequestWithUser,
    @Body() dto: CreateAuditorReviewerThreadDto,
  ) {
    const thread = await this.chatService.findOrCreateAuditorReviewerThread(
      dto.assessmentId,
      req.user.sub,
      req.user.role,
    );

    // Send the first message if provided
    if (dto.message?.trim()) {
      const msg = await this.chatService.sendMessage(
        thread.id,
        req.user.sub,
        dto.message.trim(),
        req.user.role,
      );
      this.chatGateway.notifyNewMessage(msg).catch(() => {});
    }

    return {
      success: true,
      message: 'Auditor-reviewer chat thread created successfully',
      data: this.formatThread(thread),
    };
  }

  @Get('threads')
  @Roles('admin', 'subadmin', 'organization', 'organization_member', 'auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @SwaggerGetUserThreads()
  async getUserThreads(@Request() req: RequestWithUser) {
    const threads = await this.chatService.getThreadsForUser(
      req.user.sub,
      req.user.role,
    );

    return {
      success: true,
      data: threads.map((t) => this.formatThread(t)),
    };
  }

  @Get('threads/:threadId')
  @Roles('admin', 'subadmin', 'organization', 'organization_member', 'auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @SwaggerGetThread()
  async getThread(
    @Request() req: RequestWithUser,
    @Param('threadId', ParseUUIDPipe) threadId: string,
  ) {
    const thread = await this.chatService.getThread(
      threadId,
      req.user.sub,
      req.user.role,
    );

    return {
      success: true,
      data: this.formatThread(thread),
    };
  }

  @Get('assessment/:assessmentId/thread')
  @Roles('admin', 'subadmin', 'organization', 'organization_member', 'auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @SwaggerGetThreadByAssessment()
  async getThreadByAssessment(
    @Request() req: RequestWithUser,
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const thread = await this.chatService.getThreadByAssessmentId(
      assessmentId,
      req.user.sub,
      req.user.role,
    );

    return {
      success: true,
      data: thread ? this.formatThread(thread) : null,
    };
  }

  @Get('support-ticket/:supportTicketId/thread')
  @Roles('admin', 'subadmin', 'organization', 'organization_member', 'auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @SwaggerGetThreadBySupportTicket()
  async getThreadBySupportTicket(
    @Request() req: RequestWithUser,
    @Param('supportTicketId', ParseUUIDPipe) supportTicketId: string,
  ) {
    const thread = await this.chatService.getThreadBySupportTicketId(
      supportTicketId,
      req.user.sub,
      req.user.role,
    );

    return {
      success: true,
      data: thread ? this.formatThread(thread) : null,
    };
  }

  @Post('threads/:threadId/messages')
  @Roles('admin', 'subadmin', 'organization', 'organization_member', 'auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.CREATED)
  @SwaggerSendMessage()
  async sendMessage(
    @Request() req: RequestWithUser,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.chatService.sendMessage(
      threadId,
      req.user.sub,
      dto.content,
      req.user.role,
    );

    // Broadcast via WebSocket to all thread participants
    this.chatGateway.notifyNewMessage(message).catch(() => {});

    return {
      success: true,
      message: 'Message sent successfully',
      data: this.formatMessage(message),
    };
  }

  @Get('threads/:threadId/messages')
  @Roles('admin', 'subadmin', 'organization', 'organization_member', 'auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @SwaggerGetMessages()
  async getMessages(
    @Request() req: RequestWithUser,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Query() query: GetMessagesQueryDto,
  ) {
    const result = await this.chatService.getMessages(
      threadId,
      req.user.sub,
      {
        page: query.page,
        limit: query.limit,
        before: query.before,
        after: query.after,
      },
      req.user.role,
    );

    return {
      success: true,
      data: {
        messages: result.messages.map((m) => this.formatMessage(m)),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasMore: result.hasMore,
      },
    };
  }

  @Get('threads/:threadId/participants')
  @Roles('admin', 'subadmin', 'organization', 'organization_member', 'auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @SwaggerGetParticipants()
  async getParticipants(
    @Request() req: RequestWithUser,
    @Param('threadId', ParseUUIDPipe) threadId: string,
  ) {
    const participants = await this.chatService.getParticipants(
      threadId,
      req.user.sub,
      req.user.role,
    );

    return {
      success: true,
      data: participants.map((p) => ({
        id: p.id,
        userId: p.user_id,
        firstName: p.first_name,
        lastName: p.last_name,
        role: p.role,
        joinedAt: p.joined_at,
        lastReadAt: p.last_read_at,
      })),
    };
  }

  @Post('threads/:threadId/participants')
  @Roles('admin', 'subadmin', 'organization', 'organization_member', 'auditor', 'reviewer')
  @UseGuards(RoleGuard)
  @SwaggerAddParticipant()
  async addParticipant(
    @Request() req: RequestWithUser,
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body() dto: AddParticipantDto,
  ) {
    const participants = await this.chatService.addParticipant(
      threadId,
      dto.userId,
      dto.role,
      req.user.sub,
      req.user.role,
    );

    return {
      success: true,
      message: 'Participant added successfully',
      data: participants.map((p) => ({
        id: p.id,
        userId: p.user_id,
        firstName: p.first_name,
        lastName: p.last_name,
        role: p.role,
        joinedAt: p.joined_at,
      })),
    };
  }

  @Get('threads/assessment/:assessmentId')
  @Roles('admin', 'subadmin')
  @UseGuards(RoleGuard)
  @SwaggerGetAssessmentThreadsAdmin()
  async getAssessmentThreadsAdmin(
    @Param('assessmentId', ParseUUIDPipe) assessmentId: string,
  ) {
    const result =
      await this.chatService.getAssessmentThreadsForAdmin(assessmentId);

    return {
      success: true,
      data: {
        assessmentId: result.assessmentId,
        certificateName: result.certificateName,
        organizationName: result.organizationName,
        assessmentType: result.assessmentType,
        threads: result.threads.map((t) => ({
          threadId: t.id,
          questionId: t.question_id,
          threadType: t.thread_type,
          status: t.status,
          participantCount: t.participant_count,
          messageCount: t.message_count,
          lastMessagePreview: t.last_message_preview,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          lockedAt: t.locked_at,
          lockedReason: t.locked_reason,
        })),
      },
    };
  }

  @Post('threads/:threadId/add-applicant')
  @Roles('admin', 'subadmin', 'reviewer')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @SwaggerAddApplicantToThread()
  async addApplicantToThread(
    @Request() req: RequestWithUser,
    @Param('threadId', ParseUUIDPipe) threadId: string,
  ) {
    const participants = await this.chatService.addApplicantToThread(
      threadId,
      req.user.sub,
      req.user.role,
    );

    return {
      success: true,
      message: 'Applicant(s) added to thread successfully',
      data: participants.map((p) => ({
        id: p.id,
        userId: p.user_id,
        firstName: p.first_name,
        lastName: p.last_name,
        role: p.role,
        joinedAt: p.joined_at,
      })),
    };
  }

  @Get('threads/assessments/all')
  @Roles('admin', 'subadmin')
  @UseGuards(RoleGuard)
  @SwaggerGetAllAssessmentThreadsAdmin()
  async getAllAssessmentThreadsAdmin(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.chatService.getAllAssessmentThreadsForAdmin({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    return {
      success: true,
      data: {
        assessments: result.assessments.map((a) => ({
          assessmentId: a.assessmentId,
          certificateName: a.certificateName,
          organizationName: a.organizationName,
          assessmentType: a.assessmentType,
          threads: a.threads.map((t) => ({
            threadId: t.id,
            questionId: t.question_id,
            threadType: t.thread_type,
            status: t.status,
            participantCount: t.participant_count,
            messageCount: t.message_count,
            lastMessagePreview: t.last_message_preview,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            lockedAt: t.locked_at,
            lockedReason: t.locked_reason,
          })),
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Post('threads/:threadId/lock')
  @Roles('admin', 'subadmin')
  @UseGuards(RoleGuard)
  @HttpCode(HttpStatus.OK)
  @SwaggerLockThread()
  async lockThread(
    @Param('threadId', ParseUUIDPipe) threadId: string,
    @Body() dto: LockThreadDto,
  ) {
    const thread = await this.chatService.lockThread(threadId, dto.reason);

    return {
      success: true,
      message: 'Chat thread locked successfully',
      data: {
        id: thread.id,
        status: thread.status,
        lockedAt: thread.locked_at,
        lockedReason: thread.locked_reason,
      },
    };
  }

  private formatThread(thread: any) {
    return {
      id: thread.id,
      assessmentId: thread.assessment_id,
      supportTicketId: thread.support_ticket_id,
      questionId: thread.question_id,
      threadType: thread.thread_type,
      status: thread.status,
      certificateName: thread.certificate_name,
      organizationName: thread.organization_name,
      supportTicketSubject: thread.support_ticket_subject,
      supportTicketCategory: thread.support_ticket_category,
      questionText: thread.question_text,
      assessmentType: thread.assessment_type,
      participantCount: thread.participant_count,
      unreadCount: thread.unread_count,
      createdAt: thread.created_at,
      updatedAt: thread.updated_at,
      lockedAt: thread.locked_at,
      lockedReason: thread.locked_reason,
    };
  }

  private formatMessage(message: any) {
    return {
      id: message.id,
      threadId: message.thread_id,
      senderId: message.sender_id,
      senderName: message.sender_name,
      senderRole: message.sender_role,
      content: message.content,
      isSystemMessage: message.is_system_message,
      createdAt: message.created_at,
    };
  }
}
