import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { QueryResult } from '../../common/types/database.types';

export interface OrganizationBadge {
  id: string;
  organization_id: string;
  branch_id: string | null;
  certificate_id: string | null;
  badge_name: 'bronze' | 'silver' | 'gold' | 'platinum';
  color: string;
  assessed_by_user_id: string;
  accessed_by_user_id: string | null;
  score: number;
  assessment_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BadgeWithDetails extends OrganizationBadge {
  organization_name?: string;
  branch_name?: string;
  certificate_name?: string;
  assessed_by_email?: string;
}

@Injectable()
export class BadgeRepository {
  constructor(private readonly db: DatabaseService) {}

  async createBadge(data: {
    organization_id: string;
    branch_id?: string | null;
    certificate_id?: string | null;
    badge_name: 'bronze' | 'silver' | 'gold' | 'platinum';
    color: string;
    assessed_by_user_id: string;
    score: number;
    assessment_id?: string | null;
  }): Promise<OrganizationBadge> {
    const result = (await this.db.query(
      `INSERT INTO organization_badges 
       (organization_id, branch_id, certificate_id, badge_name, color, assessed_by_user_id, score, assessment_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.organization_id,
        data.branch_id || null,
        data.certificate_id || null,
        data.badge_name,
        data.color,
        data.assessed_by_user_id,
        data.score,
        data.assessment_id || null,
      ],
    )) as QueryResult<OrganizationBadge>;

    return result.rows[0];
  }

  async findBadgesByOrganization(
    organizationId: string,
    branchId?: string | null,
  ): Promise<BadgeWithDetails[]> {
    let query = `
      SELECT 
        ob.*,
        o.name as organization_name,
        b.name as branch_name,
        c.name as certificate_name,
        u.email as assessed_by_email
      FROM organization_badges ob
      LEFT JOIN organization o ON o.id = ob.organization_id
      LEFT JOIN branches b ON b.id = ob.branch_id
      LEFT JOIN certificates c ON c.id = ob.certificate_id
      LEFT JOIN users u ON u.id = ob.assessed_by_user_id
      WHERE ob.organization_id = $1
    `;

    const params: (string | null)[] = [organizationId];

    if (branchId !== undefined) {
      if (branchId === null) {
        query += ` AND ob.branch_id IS NULL`;
      } else {
        query += ` AND ob.branch_id = $2`;
        params.push(branchId);
      }
    }

    query += ` ORDER BY ob.created_at DESC`;

    const result = (await this.db.query(
      query,
      params,
    )) as QueryResult<BadgeWithDetails>;

    return result.rows;
  }

  async findBadgeById(badgeId: string): Promise<BadgeWithDetails | null> {
    const result = (await this.db.query(
      `SELECT 
        ob.*,
        o.name as organization_name,
        b.name as branch_name,
        c.name as certificate_name,
        u.email as assessed_by_email
      FROM organization_badges ob
      LEFT JOIN organization o ON o.id = ob.organization_id
      LEFT JOIN branches b ON b.id = ob.branch_id
      LEFT JOIN certificates c ON c.id = ob.certificate_id
      LEFT JOIN users u ON u.id = ob.assessed_by_user_id
      WHERE ob.id = $1`,
      [badgeId],
    )) as QueryResult<BadgeWithDetails>;

    return result.rows[0] || null;
  }

  async findLatestBadgeForAssessment(
    assessmentId: string,
  ): Promise<OrganizationBadge | null> {
    const result = (await this.db.query(
      `SELECT * FROM organization_badges 
       WHERE assessment_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [assessmentId],
    )) as QueryResult<OrganizationBadge>;

    return result.rows[0] || null;
  }

  async findBadgeByOrganizationAndCertificate(
    organizationId: string,
    certificateId: string,
    branchId?: string | null,
  ): Promise<BadgeWithDetails | null> {
    let query = `
      SELECT 
        ob.*,
        o.name as organization_name,
        b.name as branch_name,
        c.name as certificate_name,
        u.email as assessed_by_email
      FROM organization_badges ob
      LEFT JOIN organization o ON o.id = ob.organization_id
      LEFT JOIN branches b ON b.id = ob.branch_id
      LEFT JOIN certificates c ON c.id = ob.certificate_id
      LEFT JOIN users u ON u.id = ob.assessed_by_user_id
      WHERE ob.organization_id = $1
        AND ob.certificate_id = $2
    `;

    const params: (string | null)[] = [organizationId, certificateId];

    if (branchId !== undefined) {
      if (branchId === null) {
        query += ` AND ob.branch_id IS NULL`;
      } else {
        query += ` AND ob.branch_id = $3`;
        params.push(branchId);
      }
    }

    query += ` ORDER BY ob.created_at DESC LIMIT 1`;

    const result = (await this.db.query(
      query,
      params,
    )) as QueryResult<BadgeWithDetails>;

    return result.rows[0] || null;
  }

  async updateAccessedBy(
    badgeId: string,
    accessedByUserId: string,
  ): Promise<OrganizationBadge> {
    const result = (await this.db.query(
      `UPDATE organization_badges 
       SET accessed_by_user_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [accessedByUserId, badgeId],
    )) as QueryResult<OrganizationBadge>;

    return result.rows[0];
  }
}
