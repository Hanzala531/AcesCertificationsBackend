import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { QueryResult } from '../../common/types/database.types';
import {
  SupportTicketTargetType,
  SupportTicketType,
  SupportTicket,
  SupportTicketStatus,
  SupportTicketWithCertificate,
} from './types/support-ticket.types';

@Injectable()
export class SupportTicketRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(data: {
    user_id: string;
    subject: string;
    category: string;
    certificate_id?: string | null;
    description: string;
    supporting_document?: string;
    ticket_type?: SupportTicketType;
    target_type?: SupportTicketTargetType;
    target_id?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<SupportTicket> {
    const result = (await this.db.query(
      `INSERT INTO support_tickets
       (user_id, subject, category, certificate_id, description, supporting_document, ticket_type, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.user_id,
        data.subject,
        data.category,
        data.certificate_id || null,
        data.description,
        data.supporting_document || null,
        data.ticket_type || 'support',
        data.target_type || 'certificate',
        data.target_id || null,
        JSON.stringify(data.metadata || {}),
      ],
    )) as QueryResult<SupportTicket>;
    return result.rows[0];
  }

  async findById(id: string): Promise<SupportTicketWithCertificate | null> {
    const result = (await this.db.query(
      `SELECT st.*, c.name AS certificate_name, c.certificate_id AS product_id
       FROM support_tickets st
       LEFT JOIN certificates c ON st.certificate_id = c.id
       WHERE st.id = $1`,
      [id],
    )) as QueryResult<SupportTicketWithCertificate>;
    return result.rows[0] || null;
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
  }): Promise<{ data: SupportTicketWithCertificate[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.status) {
      conditions.push(`st.status = $${paramIndex++}`);
      values.push(params.status);
    }
    if (params.category) {
      conditions.push(`st.category = $${paramIndex++}`);
      values.push(params.category);
    }
    if (params.certificate_id) {
      conditions.push(`st.certificate_id = $${paramIndex++}`);
      values.push(params.certificate_id);
    }
    if (params.ticket_type) {
      conditions.push(`st.ticket_type = $${paramIndex++}`);
      values.push(params.ticket_type);
    }
    if (params.target_type) {
      conditions.push(`st.target_type = $${paramIndex++}`);
      values.push(params.target_type);
    }
    if (params.target_id) {
      conditions.push(`st.target_id = $${paramIndex++}`);
      values.push(params.target_id);
    }
    if (params.user_id) {
      conditions.push(`st.user_id = $${paramIndex++}`);
      values.push(params.user_id);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = (await this.db.query(
      `SELECT COUNT(*) AS total FROM support_tickets st ${whereClause}`,
      values,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0].total, 10);

    const offset = (params.page - 1) * params.limit;
    values.push(params.limit, offset);

    const result = (await this.db.query(
      `SELECT st.*, c.name AS certificate_name, c.certificate_id AS product_id
       FROM support_tickets st
       LEFT JOIN certificates c ON st.certificate_id = c.id
       ${whereClause}
       ORDER BY st.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values,
    )) as QueryResult<SupportTicketWithCertificate>;

    return { data: result.rows, total };
  }

  async updateStatus(
    id: string,
    status: SupportTicketStatus,
    actedBy?: string,
  ): Promise<SupportTicketWithCertificate | null> {
    const isResolvedStatus = ['resolved', 'completed', 'closed'].includes(
      status,
    );
    const queryParams: unknown[] = [status, id];
    let setClause = `status = $1, updated_at = NOW()`;

    if (isResolvedStatus && actedBy) {
      queryParams.push(actedBy);
      setClause += `, resolved_by = $${queryParams.length}, resolved_at = NOW()`;
    }

    await this.db.query(
      `UPDATE support_tickets SET ${setClause} WHERE id = $2`,
      queryParams,
    );
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = (await this.db.query(
      `DELETE FROM support_tickets WHERE id = $1`,
      [id],
    )) as unknown as QueryResult<never>;
    return (result.rowCount ?? 0) > 0;
  }
}
