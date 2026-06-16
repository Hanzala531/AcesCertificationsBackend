import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  ChatThread,
  ChatMessage,
  ChatParticipant,
  ChatThreadWithDetails,
  ChatMessageWithSender,
  ChatParticipantWithUser,
  ChatThreadStatus,
  ChatParticipantRole,
  ChatThreadType,
} from './types/chat.types';

interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface ChatThreadAdminView {
  id: string;
  assessment_id: string;
  question_id: string | null;
  thread_type: ChatThreadType;
  status: ChatThreadStatus;
  certificate_name: string;
  organization_name: string;
  assessment_type: string;
  participant_count: number;
  message_count: number;
  last_message_preview: string | null;
  created_at: Date;
  updated_at: Date;
  locked_at: Date | null;
  locked_reason: string | null;
}

@Injectable()
export class ChatRepository {
  constructor(private readonly db: DatabaseService) {}

  async createThread(
    assessmentId: string | null,
    threadType: ChatThreadType,
    supportTicketId?: string,
    questionId?: string,
  ): Promise<ChatThread> {
    const result = (await this.db.query(
      `INSERT INTO chat_threads (assessment_id, support_ticket_id, thread_type, question_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [assessmentId, supportTicketId || null, threadType, questionId || null],
    )) as QueryResult<ChatThread>;
    return result.rows[0];
  }

  async findThreadById(id: string): Promise<ChatThread | null> {
    const result = (await this.db.query(
      `SELECT * FROM chat_threads WHERE id = $1`,
      [id],
    )) as QueryResult<ChatThread>;
    return result.rows[0] || null;
  }

  async findThreadByType(
    assessmentId: string,
    threadType: ChatThreadType,
    questionId?: string,
  ): Promise<ChatThread | null> {
    if (questionId) {
      const result = (await this.db.query(
        `SELECT * FROM chat_threads WHERE assessment_id = $1 AND thread_type = $2 AND question_id = $3`,
        [assessmentId, threadType, questionId],
      )) as QueryResult<ChatThread>;
      return result.rows[0] || null;
    }
    const result = (await this.db.query(
      `SELECT * FROM chat_threads WHERE assessment_id = $1 AND thread_type = $2 AND question_id IS NULL`,
      [assessmentId, threadType],
    )) as QueryResult<ChatThread>;
    return result.rows[0] || null;
  }

  /** Backward-compat alias — returns the main shared (auditor_applicant) thread */
  async findThreadByAssessmentId(
    assessmentId: string,
  ): Promise<ChatThread | null> {
    return this.findThreadByType(assessmentId, 'auditor_applicant');
  }

  /** Backward-compat alias — returns the reviewer_applicant thread */
  async findReviewerPrivateThread(
    assessmentId: string,
  ): Promise<ChatThread | null> {
    return this.findThreadByType(assessmentId, 'reviewer_applicant');
  }

  async findThreadBySupportTicketId(
    supportTicketId: string,
  ): Promise<ChatThread | null> {
    const result = (await this.db.query(
      `SELECT * FROM chat_threads WHERE support_ticket_id = $1 AND thread_type = 'support_ticket'`,
      [supportTicketId],
    )) as QueryResult<ChatThread>;
    return result.rows[0] || null;
  }

  async findAllThreadsByAssessment(
    assessmentId: string,
  ): Promise<ChatThreadAdminView[]> {
    const result = (await this.db.query(
      `SELECT
         ct.id,
         ct.assessment_id,
         ct.question_id,
         ct.thread_type,
         ct.status,
         ct.created_at,
         ct.updated_at,
         ct.locked_at,
         ct.locked_reason,
         ca.assessment_type,
         c.name  AS certificate_name,
         o.name  AS organization_name,
         COALESCE(pc.cnt, 0)::int AS participant_count,
         COALESCE(mc.cnt, 0)::int AS message_count,
         lm.content AS last_message_preview
       FROM chat_threads ct
       JOIN certificate_assessments ca ON ct.assessment_id = ca.id
       LEFT JOIN certificates  c ON ca.certificate_id = c.id
       LEFT JOIN organization  o ON ca.organization_id = o.id
       LEFT JOIN (SELECT thread_id, COUNT(*) AS cnt FROM chat_participants GROUP BY thread_id) pc ON pc.thread_id = ct.id
       LEFT JOIN (SELECT thread_id, COUNT(*) AS cnt FROM chat_messages GROUP BY thread_id) mc ON mc.thread_id = ct.id
       LEFT JOIN LATERAL (
         SELECT content FROM chat_messages WHERE thread_id = ct.id ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       WHERE ct.assessment_id = $1
       ORDER BY ct.thread_type`,
      [assessmentId],
    )) as QueryResult<ChatThreadAdminView>;
    return result.rows;
  }

  async findThreadWithDetails(
    id: string,
  ): Promise<ChatThreadWithDetails | null> {
    const result = (await this.db.query(
      `SELECT
        ct.*,
        ca.assessment_type,
        c.name as certificate_name,
        o.name as organization_name,
        st.subject as support_ticket_subject,
        st.category as support_ticket_category,
        q.question as question_text,
        (SELECT COUNT(*) FROM chat_participants WHERE thread_id = ct.id) as participant_count
       FROM chat_threads ct
       LEFT JOIN certificate_assessments ca ON ct.assessment_id = ca.id
       LEFT JOIN certificates c ON ca.certificate_id = c.id
       LEFT JOIN organization o ON ca.organization_id = o.id
       LEFT JOIN support_tickets st ON ct.support_ticket_id = st.id
       LEFT JOIN questions q ON ct.question_id = q.id
       WHERE ct.id = $1`,
      [id],
    )) as QueryResult<ChatThreadWithDetails>;
    return result.rows[0] || null;
  }

  async findThreadsForUser(userId: string): Promise<ChatThreadWithDetails[]> {
    const result = (await this.db.query(
      `SELECT
        ct.*,
        ca.assessment_type,
        c.name as certificate_name,
        o.name as organization_name,
        st.subject as support_ticket_subject,
        st.category as support_ticket_category,
        q.question as question_text,
        (SELECT COUNT(*) FROM chat_participants WHERE thread_id = ct.id) as participant_count,
        (SELECT COUNT(*) FROM chat_messages cm
         WHERE cm.thread_id = ct.id
         AND cm.created_at > COALESCE(cp.last_read_at, '1970-01-01')) as unread_count
       FROM chat_threads ct
       JOIN chat_participants cp ON ct.id = cp.thread_id
       LEFT JOIN certificate_assessments ca ON ct.assessment_id = ca.id
       LEFT JOIN certificates c ON ca.certificate_id = c.id
       LEFT JOIN organization o ON ca.organization_id = o.id
       LEFT JOIN support_tickets st ON ct.support_ticket_id = st.id
       LEFT JOIN questions q ON ct.question_id = q.id
       WHERE cp.user_id = $1
         AND EXISTS (
           SELECT 1 FROM chat_messages cm WHERE cm.thread_id = ct.id
         )
       ORDER BY ct.updated_at DESC`,
      [userId],
    )) as QueryResult<ChatThreadWithDetails>;
    return result.rows;
  }

  async updateThreadStatus(
    id: string,
    status: ChatThreadStatus,
    reason?: string,
  ): Promise<ChatThread> {
    const result = (await this.db.query(
      `UPDATE chat_threads
       SET status = $2::chat_thread_status,
           locked_at = CASE WHEN $2::text = 'locked' THEN NOW() ELSE NULL END,
           locked_reason = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, reason || null],
    )) as QueryResult<ChatThread>;
    return result.rows[0];
  }

  async addParticipant(
    threadId: string,
    userId: string,
    role: ChatParticipantRole,
  ): Promise<ChatParticipant> {
    const result = (await this.db.query(
      `INSERT INTO chat_participants (thread_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (thread_id, user_id) DO UPDATE SET role = $3
       RETURNING *`,
      [threadId, userId, role],
    )) as QueryResult<ChatParticipant>;
    return result.rows[0];
  }

  async removeParticipant(threadId: string, userId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM chat_participants WHERE thread_id = $1 AND user_id = $2`,
      [threadId, userId],
    );
  }

  async findParticipant(
    threadId: string,
    userId: string,
  ): Promise<ChatParticipant | null> {
    const result = (await this.db.query(
      `SELECT * FROM chat_participants WHERE thread_id = $1 AND user_id = $2`,
      [threadId, userId],
    )) as QueryResult<ChatParticipant>;
    return result.rows[0] || null;
  }

  async findParticipantsByThreadId(
    threadId: string,
  ): Promise<ChatParticipantWithUser[]> {
    const result = (await this.db.query(
      `SELECT cp.*,
              COALESCE(a.first_name, r.first_name, e.first_name, sa.first_name, o.name, u.email) as first_name,
              COALESCE(a.last_name, r.last_name, e.last_name, sa.last_name, '') as last_name,
              u.email
       FROM chat_participants cp
       JOIN users u ON cp.user_id = u.id
       LEFT JOIN auditor a ON cp.user_id = a.user_id
       LEFT JOIN reviewer r ON cp.user_id = r.user_id
       LEFT JOIN employee e ON cp.user_id = e.user_id
       LEFT JOIN subadmin sa ON cp.user_id = sa.user_id
       LEFT JOIN organization o ON cp.user_id = o.user_id
       WHERE cp.thread_id = $1
       ORDER BY cp.joined_at`,
      [threadId],
    )) as QueryResult<ChatParticipantWithUser>;
    return result.rows;
  }

  async updateLastRead(threadId: string, userId: string): Promise<void> {
    await this.db.query(
      `UPDATE chat_participants SET last_read_at = NOW() WHERE thread_id = $1 AND user_id = $2`,
      [threadId, userId],
    );
  }

  async createMessage(
    threadId: string,
    senderId: string,
    content: string,
    isSystemMessage: boolean = false,
  ): Promise<ChatMessage> {
    const result = (await this.db.query(
      `INSERT INTO chat_messages (thread_id, sender_id, content, is_system_message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [threadId, senderId, content, isSystemMessage],
    )) as QueryResult<ChatMessage>;

    await this.db.query(
      `UPDATE chat_threads SET updated_at = NOW() WHERE id = $1`,
      [threadId],
    );

    return result.rows[0];
  }

  async findMessageById(id: string): Promise<ChatMessage | null> {
    const result = (await this.db.query(
      `SELECT * FROM chat_messages WHERE id = $1`,
      [id],
    )) as QueryResult<ChatMessage>;
    return result.rows[0] || null;
  }

  async findMessagesByThreadId(
    threadId: string,
    options: {
      page?: number;
      limit?: number;
      before?: Date;
      after?: Date;
    } = {},
  ): Promise<{ messages: ChatMessageWithSender[]; total: number }> {
    const { page = 1, limit = 50, before, after } = options;
    const offset = (page - 1) * limit;

    let whereClause = 'cm.thread_id = $1';
    const params: (string | Date | number)[] = [threadId];
    let paramIndex = 2;

    if (before) {
      whereClause += ` AND cm.created_at < $${paramIndex}`;
      params.push(before);
      paramIndex++;
    }

    if (after) {
      whereClause += ` AND cm.created_at > $${paramIndex}`;
      params.push(after);
      paramIndex++;
    }

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total FROM chat_messages cm WHERE ${whereClause}`,
      params,
    )) as QueryResult<{ total: string }>;

    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    params.push(limit, offset);
    const result = (await this.db.query(
      `SELECT
        cm.*,
        COALESCE(
          COALESCE(a.first_name, r.first_name, e.first_name, sa.first_name) || ' ' ||
          COALESCE(a.last_name, r.last_name, e.last_name, sa.last_name),
          o.name,
          CASE WHEN u.role = 'admin' THEN 'Admin' ELSE u.email END
        ) as sender_name,
        cp.role as sender_role
       FROM chat_messages cm
       LEFT JOIN users u ON cm.sender_id = u.id
       LEFT JOIN auditor a ON cm.sender_id = a.user_id
       LEFT JOIN reviewer r ON cm.sender_id = r.user_id
       LEFT JOIN employee e ON cm.sender_id = e.user_id
       LEFT JOIN subadmin sa ON cm.sender_id = sa.user_id
       LEFT JOIN organization o ON cm.sender_id = o.user_id
       LEFT JOIN chat_participants cp ON cm.thread_id = cp.thread_id AND cm.sender_id = cp.user_id
       WHERE ${whereClause}
       ORDER BY cm.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params,
    )) as QueryResult<ChatMessageWithSender>;

    return {
      messages: result.rows.reverse(),
      total,
    };
  }

  async getLastMessage(
    threadId: string,
  ): Promise<ChatMessageWithSender | null> {
    const result = (await this.db.query(
      `SELECT
        cm.*,
        COALESCE(
          COALESCE(a.first_name, r.first_name, e.first_name, sa.first_name) || ' ' ||
          COALESCE(a.last_name, r.last_name, e.last_name, sa.last_name),
          o.name,
          CASE WHEN u.role = 'admin' THEN 'Admin' ELSE u.email END
        ) as sender_name,
        cp.role as sender_role
       FROM chat_messages cm
       LEFT JOIN users u ON cm.sender_id = u.id
       LEFT JOIN auditor a ON cm.sender_id = a.user_id
       LEFT JOIN reviewer r ON cm.sender_id = r.user_id
       LEFT JOIN employee e ON cm.sender_id = e.user_id
       LEFT JOIN subadmin sa ON cm.sender_id = sa.user_id
       LEFT JOIN organization o ON cm.sender_id = o.user_id
       LEFT JOIN chat_participants cp ON cm.thread_id = cp.thread_id AND cm.sender_id = cp.user_id
       WHERE cm.thread_id = $1
       ORDER BY cm.created_at DESC
       LIMIT 1`,
      [threadId],
    )) as QueryResult<ChatMessageWithSender>;
    return result.rows[0] || null;
  }

  async findThreadBySupportTicketWithDetails(
    supportTicketId: string,
  ): Promise<ChatThreadWithDetails | null> {
    const result = (await this.db.query(
      `SELECT
        ct.*,
        st.subject as support_ticket_subject,
        st.category as support_ticket_category,
        (SELECT COUNT(*) FROM chat_participants WHERE thread_id = ct.id) as participant_count
       FROM chat_threads ct
       LEFT JOIN support_tickets st ON ct.support_ticket_id = st.id
       WHERE ct.support_ticket_id = $1 AND ct.thread_type = 'support_ticket'`,
      [supportTicketId],
    )) as QueryResult<ChatThreadWithDetails>;
    return result.rows[0] || null;
  }

  async findAllThreadsAcrossAssessments(
    options: { page?: number; limit?: number } = {},
  ): Promise<{ threads: ChatThreadAdminView[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const countResult = (await this.db.query(
      `SELECT COUNT(DISTINCT ct.assessment_id)::int AS total
       FROM chat_threads ct
       WHERE ct.assessment_id IS NOT NULL`,
    )) as QueryResult<{ total: number }>;
    const total = countResult.rows[0]?.total || 0;

    const result = (await this.db.query(
      `SELECT
         ct.id,
         ct.assessment_id,
         ct.question_id,
         ct.thread_type,
         ct.status,
         ct.created_at,
         ct.updated_at,
         ct.locked_at,
         ct.locked_reason,
         ca.assessment_type,
         c.name  AS certificate_name,
         o.name  AS organization_name,
         COALESCE(pc.cnt, 0)::int AS participant_count,
         COALESCE(mc.cnt, 0)::int AS message_count,
         lm.content AS last_message_preview
       FROM chat_threads ct
       JOIN certificate_assessments ca ON ct.assessment_id = ca.id
       LEFT JOIN certificates  c ON ca.certificate_id = c.id
       LEFT JOIN organization  o ON ca.organization_id = o.id
       LEFT JOIN (SELECT thread_id, COUNT(*) AS cnt FROM chat_participants GROUP BY thread_id) pc ON pc.thread_id = ct.id
       LEFT JOIN (SELECT thread_id, COUNT(*) AS cnt FROM chat_messages GROUP BY thread_id) mc ON mc.thread_id = ct.id
       LEFT JOIN LATERAL (
         SELECT content FROM chat_messages WHERE thread_id = ct.id ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       WHERE ct.assessment_id IS NOT NULL
         AND ct.assessment_id IN (
           SELECT DISTINCT ct2.assessment_id
           FROM chat_threads ct2
           WHERE ct2.assessment_id IS NOT NULL
           ORDER BY ct2.assessment_id
           LIMIT $1 OFFSET $2
         )
       ORDER BY ca.created_at DESC, ct.thread_type`,
      [limit, offset],
    )) as QueryResult<ChatThreadAdminView>;

    return { threads: result.rows, total };
  }

  async lockThreadsByAssessmentIds(
    assessmentIds: string[],
    reason: string,
  ): Promise<number> {
    const result = (await this.db.query(
      `UPDATE chat_threads
       SET status = 'locked', locked_at = NOW(), locked_reason = $2, updated_at = NOW()
       WHERE assessment_id = ANY($1) AND status = 'active'
       RETURNING id`,
      [assessmentIds, reason],
    )) as QueryResult<{ id: string }>;
    return result.rowCount;
  }
}
