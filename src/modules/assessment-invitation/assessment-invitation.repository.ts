import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { QueryResult } from '../../common/types/database.types';
import {
  AssessmentInvitation,
  AssessmentInvitationWithDetails,
} from './types/assessment-invitation.types';

@Injectable()
export class AssessmentInvitationRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(data: {
    assessmentId: string;
    certificateId: string;
    invitedUserId: string;
    invitedBy: string;
  }): Promise<AssessmentInvitation> {
    const result = (await this.db.query(
      `INSERT INTO assessment_invitations
         (assessment_id, certificate_id, invited_user_id, invited_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        data.assessmentId,
        data.certificateId,
        data.invitedUserId,
        data.invitedBy,
      ],
    )) as QueryResult<AssessmentInvitation>;
    return result.rows[0];
  }

  async findById(id: string): Promise<AssessmentInvitation | null> {
    const result = (await this.db.query(
      `SELECT * FROM assessment_invitations WHERE id = $1`,
      [id],
    )) as QueryResult<AssessmentInvitation>;
    return result.rows[0] || null;
  }

  async findPendingByAssessment(
    assessmentId: string,
  ): Promise<AssessmentInvitation | null> {
    const result = (await this.db.query(
      `SELECT * FROM assessment_invitations
       WHERE assessment_id = $1 AND status = 'pending'`,
      [assessmentId],
    )) as QueryResult<AssessmentInvitation>;
    return result.rows[0] || null;
  }

  async findByInvitedUser(
    userId: string,
    status?: string,
    page = 1,
    limit = 10,
  ): Promise<{ data: AssessmentInvitationWithDetails[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = ['ai.invited_user_id = $1'];
    const params: (string | number)[] = [userId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`ai.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const countResult = (await this.db.query(
      `SELECT COUNT(*) as total
       FROM assessment_invitations ai
       WHERE ${whereClause}`,
      params,
    )) as QueryResult<{ total: string }>;

    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = (await this.db.query(
      `SELECT ai.*,
              c.name AS certificate_name,
              ca.status AS assessment_status,
              CONCAT(u.email) AS invited_by_name
       FROM assessment_invitations ai
       LEFT JOIN certificates c ON c.id = ai.certificate_id
       LEFT JOIN certificate_assessments ca ON ca.id = ai.assessment_id
       LEFT JOIN users u ON u.id = ai.invited_by
       WHERE ${whereClause}
       ORDER BY ai.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    )) as QueryResult<AssessmentInvitationWithDetails>;

    return { data: dataResult.rows, total };
  }

  async updateStatus(
    id: string,
    status: 'accepted' | 'declined',
  ): Promise<AssessmentInvitation> {
    const result = (await this.db.query(
      `UPDATE assessment_invitations
       SET status = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status],
    )) as QueryResult<AssessmentInvitation>;
    return result.rows[0];
  }

  async cancelPendingByAssessment(assessmentId: string): Promise<void> {
    await this.db.query(
      `UPDATE assessment_invitations
       SET status = 'declined', updated_at = NOW()
       WHERE assessment_id = $1 AND status = 'pending'`,
      [assessmentId],
    );
  }
}
