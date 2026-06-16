import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ChatRepository } from './chat.repository';
import { AssessmentRepository } from '../assessment/assessment.repository';
import { SupportTicketRepository } from '../support-ticket/support-ticket.repository';
import {
  ChatThread,
  ChatMessage,
  ChatThreadWithDetails,
  ChatMessageWithSender,
  ChatParticipantWithUser,
  ChatParticipantRole,
  ChatThreadType,
} from './types/chat.types';
import { ChatThreadAdminView } from './chat.repository';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly chatRepo: ChatRepository,
    private readonly assessmentRepo: AssessmentRepository,
    @Inject(forwardRef(() => SupportTicketRepository))
    private readonly supportTicketRepo: SupportTicketRepository,
  ) {}

  private isAdmin(userRole?: string): boolean {
    return userRole === 'admin' || userRole === 'subadmin';
  }

  async createThread(
    assessmentId: string,
    creatorUserId: string,
    creatorRole: ChatParticipantRole,
  ): Promise<ChatThreadWithDetails> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const isAssuredCompleted =
      assessment.assessment_type === 'assured' &&
      assessment.status === 'completed';
    if (
      (assessment.status === 'completed' || assessment.status === 'expired') &&
      !isAssuredCompleted
    ) {
      throw new BadRequestException(
        'Cannot create chat for completed or expired assessment',
      );
    }

    const existingThread = await this.chatRepo.findThreadByType(
      assessmentId,
      'auditor_applicant',
    );
    if (existingThread) {
      const threadDetails = await this.chatRepo.findThreadWithDetails(
        existingThread.id,
      );
      await this.chatRepo.addParticipant(
        existingThread.id,
        creatorUserId,
        creatorRole,
      );
      return threadDetails!;
    }

    const thread = await this.chatRepo.createThread(
      assessmentId,
      'auditor_applicant',
    );
    await this.chatRepo.addParticipant(thread.id, creatorUserId, creatorRole);

    return (await this.chatRepo.findThreadWithDetails(thread.id))!;
  }

  async createThreadForAssuredAssessment(
    assessmentId: string,
    applicantUserId: string,
  ): Promise<ChatThreadWithDetails> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.assessment_type !== 'assured') {
      throw new BadRequestException(
        'This method is only for assured assessments',
      );
    }

    const existingThread = await this.chatRepo.findThreadByType(
      assessmentId,
      'auditor_applicant',
    );
    if (existingThread) {
      const existingParticipant = await this.chatRepo.findParticipant(
        existingThread.id,
        applicantUserId,
      );
      if (!existingParticipant) {
        await this.chatRepo.addParticipant(
          existingThread.id,
          applicantUserId,
          'applicant',
        );
      }
      return (await this.chatRepo.findThreadWithDetails(existingThread.id))!;
    }

    const thread = await this.chatRepo.createThread(
      assessmentId,
      'auditor_applicant',
    );
    await this.chatRepo.addParticipant(thread.id, applicantUserId, 'applicant');

    if (assessment.assigned_auditor_id) {
      await this.chatRepo.addParticipant(
        thread.id,
        assessment.assigned_auditor_id,
        'auditor',
      );
    }

    if (assessment.assigned_reviewer_id) {
      await this.chatRepo.addParticipant(
        thread.id,
        assessment.assigned_reviewer_id,
        'reviewer',
      );
    }

    return (await this.chatRepo.findThreadWithDetails(thread.id))!;
  }

  async getThread(
    threadId: string,
    userId: string,
    userRole?: string,
  ): Promise<ChatThreadWithDetails> {
    const thread = await this.chatRepo.findThreadWithDetails(threadId);
    if (!thread) {
      throw new NotFoundException('Chat thread not found');
    }

    if (!this.isAdmin(userRole)) {
      const participant = await this.chatRepo.findParticipant(threadId, userId);
      if (!participant) {
        throw new ForbiddenException('You are not a participant in this chat');
      }
    }

    return thread;
  }

  async getThreadByAssessmentId(
    assessmentId: string,
    userId: string,
    userRole?: string,
  ): Promise<ChatThreadWithDetails | null> {
    const thread = await this.chatRepo.findThreadByAssessmentId(assessmentId);
    if (!thread) {
      return null;
    }

    if (!this.isAdmin(userRole)) {
      const participant = await this.chatRepo.findParticipant(thread.id, userId);
      if (!participant) {
        throw new ForbiddenException('You are not a participant in this chat');
      }
    }

    return this.chatRepo.findThreadWithDetails(thread.id);
  }

  async getThreadsForUser(
    userId: string,
    userRole?: string,
  ): Promise<ChatThreadWithDetails[]> {
    return this.chatRepo.findThreadsForUser(userId);
  }

  async addParticipant(
    threadId: string,
    userId: string,
    role: ChatParticipantRole,
    requesterId: string,
    requesterRole?: string,
  ): Promise<ChatParticipantWithUser[]> {
    const thread = await this.chatRepo.findThreadById(threadId);
    if (!thread) {
      throw new NotFoundException('Chat thread not found');
    }

    if (thread.status === 'locked') {
      throw new BadRequestException('Cannot add participants to a locked chat');
    }

    if (!this.isAdmin(requesterRole)) {
      const requesterParticipant = await this.chatRepo.findParticipant(
        threadId,
        requesterId,
      );
      if (!requesterParticipant) {
        throw new ForbiddenException('You are not a participant in this chat');
      }
    }

    await this.chatRepo.addParticipant(threadId, userId, role);

    return this.chatRepo.findParticipantsByThreadId(threadId);
  }

  async getParticipants(
    threadId: string,
    userId: string,
    userRole?: string,
  ): Promise<ChatParticipantWithUser[]> {
    if (!this.isAdmin(userRole)) {
      const participant = await this.chatRepo.findParticipant(threadId, userId);
      if (!participant) {
        throw new ForbiddenException('You are not a participant in this chat');
      }
    }

    return this.chatRepo.findParticipantsByThreadId(threadId);
  }

  async sendMessage(
    threadId: string,
    senderId: string,
    content: string,
    senderRole?: string,
  ): Promise<ChatMessageWithSender> {
    const thread = await this.chatRepo.findThreadById(threadId);
    if (!thread) {
      throw new NotFoundException('Chat thread not found');
    }

    if (thread.status === 'locked') {
      throw new BadRequestException('Cannot send messages to a locked chat');
    }

    if (this.isAdmin(senderRole)) {
      // Auto-add admin as participant if not already
      await this.chatRepo.addParticipant(threadId, senderId, 'admin');
    } else {
      const participant = await this.chatRepo.findParticipant(threadId, senderId);
      if (!participant) {
        throw new ForbiddenException('You are not a participant in this chat');
      }
    }

    const message = await this.chatRepo.createMessage(
      threadId,
      senderId,
      content,
    );

    const participants =
      await this.chatRepo.findParticipantsByThreadId(threadId);
    const sender = participants.find((p) => p.user_id === senderId);

    return {
      ...message,
      sender_name: sender
        ? `${sender.first_name} ${sender.last_name}`
        : 'Unknown',
      sender_role: sender?.role,
    };
  }

  async getMessages(
    threadId: string,
    userId: string,
    options: {
      page?: number;
      limit?: number;
      before?: string;
      after?: string;
    } = {},
    userRole?: string,
  ): Promise<{
    messages: ChatMessageWithSender[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    if (!this.isAdmin(userRole)) {
      const participant = await this.chatRepo.findParticipant(threadId, userId);
      if (!participant) {
        throw new ForbiddenException('You are not a participant in this chat');
      }
    }

    await this.chatRepo.updateLastRead(threadId, userId);

    const { page = 1, limit = 50, before, after } = options;

    const result = await this.chatRepo.findMessagesByThreadId(threadId, {
      page,
      limit,
      before: before ? new Date(before) : undefined,
      after: after ? new Date(after) : undefined,
    });

    const totalPages = Math.ceil(result.total / limit);

    return {
      messages: result.messages,
      total: result.total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  async lockThread(threadId: string, reason?: string): Promise<ChatThread> {
    const thread = await this.chatRepo.findThreadById(threadId);
    if (!thread) {
      throw new NotFoundException('Chat thread not found');
    }

    if (thread.status === 'locked') {
      return thread;
    }

    const lockedThread = await this.chatRepo.updateThreadStatus(
      threadId,
      'locked',
      reason,
    );

    await this.chatRepo.createMessage(
      threadId,
      '00000000-0000-0000-0000-000000000000',
      `Chat locked: ${reason || 'Assessment completed'}`,
      true,
    );

    return lockedThread;
  }

  async lockSupportTicketThread(
    supportTicketId: string,
    reason: string,
  ): Promise<void> {
    const thread =
      await this.chatRepo.findThreadBySupportTicketId(supportTicketId);
    if (!thread || thread.status === 'locked') {
      return;
    }

    await this.chatRepo.updateThreadStatus(thread.id, 'locked', reason);
    await this.chatRepo.createMessage(
      thread.id,
      '00000000-0000-0000-0000-000000000000',
      `Chat locked: ${reason}`,
      true,
    );
    this.logger.log(
      `Chat thread ${thread.id} locked for support ticket ${supportTicketId}: ${reason}`,
    );
  }

  async lockThreadByAssessmentId(
    assessmentId: string,
    reason: string,
  ): Promise<void> {
    // Lock all active threads for the assessment (auditor_applicant, auditor_reviewer, reviewer_applicant)
    const count = await this.chatRepo.lockThreadsByAssessmentIds(
      [assessmentId],
      reason,
    );
    if (count > 0) {
      this.logger.log(
        `${count} chat thread(s) locked for assessment ${assessmentId}: ${reason}`,
      );
    }
  }

  async validateChatAccess(
    userId: string,
    userRole: string,
    assessmentId: string,
  ): Promise<{
    canAccess: boolean;
    participantRole: ChatParticipantRole | null;
  }> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      return { canAccess: false, participantRole: null };
    }

    const isAssuredCompleted =
      assessment.assessment_type === 'assured' &&
      assessment.status === 'completed';

    if (
      (assessment.status === 'completed' || assessment.status === 'expired') &&
      !isAssuredCompleted
    ) {
      const thread = await this.chatRepo.findThreadByAssessmentId(assessmentId);
      if (thread) {
        const participant = await this.chatRepo.findParticipant(
          thread.id,
          userId,
        );
        return {
          canAccess: !!participant,
          participantRole: participant?.role || null,
        };
      }
      return { canAccess: false, participantRole: null };
    }

    let participantRole: ChatParticipantRole | null = null;

    if (this.isAdmin(userRole)) {
      participantRole = 'admin';
    } else if (userRole === 'organization' || userRole === 'organization_member') {
      participantRole = 'applicant';
    } else if (userRole === 'auditor') {
      const auditorRecord =
        await this.assessmentRepo.findAuditorByUserId(userId);
      if (
        auditorRecord &&
        (assessment.assigned_auditor_id === userId ||
          assessment.assigned_auditor_id === auditorRecord.id)
      ) {
        participantRole = 'auditor';
      }
    } else if (userRole === 'reviewer') {
      const reviewerRecord =
        await this.assessmentRepo.findReviewerByUserId(userId);
      if (
        reviewerRecord &&
        (assessment.assigned_reviewer_id === userId ||
          assessment.assigned_reviewer_id === reviewerRecord.id)
      ) {
        participantRole = 'reviewer';
      }
    }

    return {
      canAccess: participantRole !== null,
      participantRole,
    };
  }

  async createSupportTicketThread(
    supportTicketId: string,
    creatorUserId: string,
    creatorRole: string,
  ): Promise<ChatThreadWithDetails> {
    const ticket =
      await this.supportTicketRepo.findById(supportTicketId);
    if (!ticket) {
      throw new NotFoundException('Support ticket not found');
    }

    const existingThread =
      await this.chatRepo.findThreadBySupportTicketId(supportTicketId);
    if (existingThread) {
      const participantRole: ChatParticipantRole = this.isAdmin(creatorRole)
        ? 'admin'
        : 'applicant';
      await this.chatRepo.addParticipant(
        existingThread.id,
        creatorUserId,
        participantRole,
      );
      return (await this.chatRepo.findThreadWithDetails(existingThread.id))!;
    }

    const thread = await this.chatRepo.createThread(
      null,
      'support_ticket',
      supportTicketId,
    );

    const participantRole: ChatParticipantRole = this.isAdmin(creatorRole)
      ? 'admin'
      : 'applicant';
    await this.chatRepo.addParticipant(thread.id, creatorUserId, participantRole);

    // If created by a non-admin, also add the ticket creator as participant if different
    if (ticket.user_id !== creatorUserId) {
      await this.chatRepo.addParticipant(thread.id, ticket.user_id, 'applicant');
    }

    return (await this.chatRepo.findThreadWithDetails(thread.id))!;
  }

  async getThreadBySupportTicketId(
    supportTicketId: string,
    userId: string,
    userRole?: string,
  ): Promise<ChatThreadWithDetails | null> {
    const thread =
      await this.chatRepo.findThreadBySupportTicketId(supportTicketId);
    if (!thread) {
      return null;
    }

    if (this.isAdmin(userRole)) {
      // Auto-add admin as participant when they view the thread
      await this.chatRepo.addParticipant(thread.id, userId, 'admin');
    } else {
      const participant = await this.chatRepo.findParticipant(thread.id, userId);
      if (!participant) {
        throw new ForbiddenException('You are not a participant in this chat');
      }
    }

    return this.chatRepo.findThreadWithDetails(thread.id);
  }

  async isParticipant(threadId: string, userId: string): Promise<boolean> {
    const participant = await this.chatRepo.findParticipant(threadId, userId);
    return !!participant;
  }

  async getParticipantUserIds(threadId: string): Promise<string[]> {
    const participants =
      await this.chatRepo.findParticipantsByThreadId(threadId);
    return participants.map((p) => p.user_id);
  }

  async getThreadDetails(threadId: string): Promise<ChatThreadWithDetails | null> {
    return this.chatRepo.findThreadWithDetails(threadId);
  }

  async addParticipantToAssessmentThread(
    assessmentId: string,
    userId: string,
    role: ChatParticipantRole,
  ): Promise<void> {
    const thread = await this.chatRepo.findThreadByAssessmentId(assessmentId);
    if (!thread) {
      return;
    }

    if (thread.status === 'locked') {
      return;
    }

    const existingParticipant = await this.chatRepo.findParticipant(
      thread.id,
      userId,
    );
    if (existingParticipant) {
      if (existingParticipant.role !== role) {
        await this.chatRepo.addParticipant(thread.id, userId, role);
      }
      return;
    }

    await this.chatRepo.addParticipant(thread.id, userId, role);
  }

  async findOrCreateReviewerPrivateThread(
    assessmentId: string,
    reviewerUserId: string,
  ): Promise<ChatThreadWithDetails> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    const applicantUserIds = await this.assessmentRepo.getApplicantUserIds(
      assessment.organization_id,
      assessment.branch_id,
    );
    return this.findOrCreateTypedThread(
      assessmentId,
      'reviewer_applicant',
      reviewerUserId,
      'reviewer',
      applicantUserIds,
      'applicant',
    );
  }

  /**
   * Generic method used by compliance actions to find or create a typed thread.
   * If the thread already exists, just ensures the creator is a participant.
   * If new, creates the thread and adds creator + all secondary participants.
   * When questionId is provided, threads are scoped per-question.
   */
  async findOrCreateTypedThread(
    assessmentId: string,
    threadType: ChatThreadType,
    creatorUserId: string,
    creatorRole: ChatParticipantRole,
    secondaryParticipantUserIds?: string[],
    secondaryRole?: ChatParticipantRole,
    questionId?: string,
  ): Promise<ChatThreadWithDetails> {
    const existing = await this.chatRepo.findThreadByType(
      assessmentId,
      threadType,
      questionId,
    );
    if (existing) {
      await this.chatRepo.addParticipant(existing.id, creatorUserId, creatorRole);
      return (await this.chatRepo.findThreadWithDetails(existing.id))!;
    }

    const thread = await this.chatRepo.createThread(
      assessmentId,
      threadType,
      undefined,
      questionId,
    );
    await this.chatRepo.addParticipant(thread.id, creatorUserId, creatorRole);

    if (secondaryParticipantUserIds && secondaryRole) {
      for (const uid of secondaryParticipantUserIds) {
        await this.chatRepo.addParticipant(thread.id, uid, secondaryRole);
      }
    }

    return (await this.chatRepo.findThreadWithDetails(thread.id))!;
  }

  async findOrCreateAuditorReviewerThread(
    assessmentId: string,
    userId: string,
    userRole: string,
  ): Promise<ChatThreadWithDetails> {
    const assessment =
      await this.assessmentRepo.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (!assessment.assigned_auditor_id) {
      throw new BadRequestException(
        'No auditor assigned to this assessment',
      );
    }

    if (!assessment.assigned_reviewer_id) {
      throw new BadRequestException(
        'No reviewer assigned to this assessment',
      );
    }

    if (userRole === 'reviewer') {
      if (assessment.assigned_reviewer_id !== userId) {
        throw new ForbiddenException(
          'You are not the assigned reviewer for this assessment',
        );
      }

      return this.findOrCreateTypedThread(
        assessmentId,
        'auditor_reviewer',
        userId,
        'reviewer',
        [assessment.assigned_auditor_id],
        'auditor',
      );
    }

    if (userRole === 'auditor') {
      const auditorRecord =
        await this.assessmentRepo.findAuditorByUserId(userId);
      if (
        !auditorRecord ||
        (assessment.assigned_auditor_id !== userId &&
          assessment.assigned_auditor_id !== auditorRecord.id)
      ) {
        throw new ForbiddenException(
          'You are not the assigned auditor for this assessment',
        );
      }

      return this.findOrCreateTypedThread(
        assessmentId,
        'auditor_reviewer',
        userId,
        'auditor',
        [assessment.assigned_reviewer_id],
        'reviewer',
      );
    }

    throw new ForbiddenException(
      'Only auditors and reviewers can create auditor-reviewer threads',
    );
  }

  /**
   * Adds applicant(s) to an existing clarification thread.
   * Only the reviewer (or admin) who is a participant can invoke this.
   */
  async addApplicantToThread(
    threadId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<ChatParticipantWithUser[]> {
    const thread = await this.chatRepo.findThreadById(threadId);
    if (!thread) {
      throw new NotFoundException('Chat thread not found');
    }

    if (thread.status === 'locked') {
      throw new BadRequestException('Cannot add participants to a locked chat');
    }

    if (!thread.assessment_id) {
      throw new BadRequestException(
        'This thread is not linked to an assessment',
      );
    }

    // Only reviewer or admin can add applicant
    if (!this.isAdmin(requesterRole)) {
      if (requesterRole !== 'reviewer') {
        throw new ForbiddenException(
          'Only reviewers or admins can add applicants to a thread',
        );
      }
      const requesterParticipant = await this.chatRepo.findParticipant(
        threadId,
        requesterId,
      );
      if (!requesterParticipant) {
        throw new ForbiddenException('You are not a participant in this chat');
      }
    }

    const assessment = await this.assessmentRepo.findAssessmentById(
      thread.assessment_id,
    );
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const orgUserIds = await this.assessmentRepo.getApplicantUserIds(
      assessment.organization_id,
      assessment.branch_id,
    );

    for (const uid of orgUserIds) {
      await this.chatRepo.addParticipant(threadId, uid, 'applicant');
    }

    return this.chatRepo.findParticipantsByThreadId(threadId);
  }

  /**
   * Admin-only: returns all threads across all assessments, grouped by assessment.
   * Paginated by number of assessments.
   */
  async getAllAssessmentThreadsForAdmin(options: {
    page?: number;
    limit?: number;
  }): Promise<{
    assessments: Array<{
      assessmentId: string;
      certificateName: string;
      organizationName: string;
      assessmentType: string;
      threads: ChatThreadAdminView[];
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20 } = options;
    const { threads, total } =
      await this.chatRepo.findAllThreadsAcrossAssessments({ page, limit });

    // Group threads by assessment_id
    const grouped = new Map<
      string,
      {
        assessmentId: string;
        certificateName: string;
        organizationName: string;
        assessmentType: string;
        threads: ChatThreadAdminView[];
      }
    >();

    for (const t of threads) {
      if (!grouped.has(t.assessment_id)) {
        grouped.set(t.assessment_id, {
          assessmentId: t.assessment_id,
          certificateName: t.certificate_name,
          organizationName: t.organization_name,
          assessmentType: t.assessment_type,
          threads: [],
        });
      }
      grouped.get(t.assessment_id)!.threads.push(t);
    }

    const totalPages = Math.ceil(total / limit);

    return {
      assessments: Array.from(grouped.values()),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Admin-only: returns all threads for an assessment grouped under the
   * assessment's certificate name, with message counts and last message preview.
   */
  async getAssessmentThreadsForAdmin(assessmentId: string): Promise<{
    assessmentId: string;
    certificateName: string;
    organizationName: string;
    assessmentType: string;
    threads: ChatThreadAdminView[];
  }> {
    const threads =
      await this.chatRepo.findAllThreadsByAssessment(assessmentId);

    if (threads.length === 0) {
      // Assessment may exist but have no threads yet — still return empty response
      const assessment =
        await this.assessmentRepo.findAssessmentById(assessmentId);
      if (!assessment) {
        throw new NotFoundException('Assessment not found');
      }
      return {
        assessmentId,
        certificateName: '',
        organizationName: '',
        assessmentType: assessment.assessment_type,
        threads: [],
      };
    }

    const first = threads[0];
    return {
      assessmentId,
      certificateName: first.certificate_name,
      organizationName: first.organization_name,
      assessmentType: first.assessment_type,
      threads,
    };
  }
}
