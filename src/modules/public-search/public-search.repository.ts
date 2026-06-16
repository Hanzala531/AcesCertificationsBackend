import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type {
  OrganizationProfile,
  OrganizationDetails,
  OrganizationMetrics,
  BranchWithCertificates,
  BranchCertificate,
  CertificateDetail,
  AssuranceDetail,
  PublicCertificateDetail,
} from './types/public-search.types';

export interface OrganizationSearchResult {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  legal_city: string | null;
  legal_state: string | null;
  legal_country: string | null;
  contact_no: string | null;
  email: string | null;
  website: string | null;
  industries: { id: string; name: string }[];
  total_certificates: number;
}

export interface CertificateSearchResult {
  id: string;
  certificate_name: string;
  certificate_number: string;
  certificate_id: string;
  organization_id: string;
  organization_name: string;
  organization_logo: string | null;
  branch_id: string | null;
  branch_name: string | null;
  badge_name: string | null;
  badge_color: string | null;
  review_score: number | null;
  issued_at: Date;
  expiry_date: Date | null;
  is_blocked: boolean;
}

export interface OrganizationListItem {
  id: string;
  name: string;
  description: string | null;
}

interface SearchFilters {
  q?: string;
  country?: string;
  industry_id?: string;
  organization_id?: string;
  certificate_id?: string;
}

interface QueryResult<T> {
  rows: T[];
}

@Injectable()
export class PublicSearchRepository {
  constructor(private db: DatabaseService) {}

  async listOrganizations(
    limit: number,
    offset: number,
  ): Promise<{ data: OrganizationListItem[]; total: number }> {
    const [countResult, dataResult] = (await Promise.all([
      this.db.query('SELECT COUNT(*) AS total FROM organization'),
      this.db.query(
        'SELECT id, name, description FROM organization ORDER BY name ASC LIMIT $1 OFFSET $2',
        [limit, offset],
      ),
    ])) as [QueryResult<{ total: string }>, QueryResult<OrganizationListItem>];

    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0]?.total ?? '0', 10),
    };
  }

  async searchOrganizations(
    filters: SearchFilters,
    limit: number,
    offset: number,
  ): Promise<{ data: OrganizationSearchResult[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.q) {
      conditions.push(`(
        o.name ILIKE $${paramIdx}
        OR o.description ILIKE $${paramIdx}
        OR EXISTS (
          SELECT 1 FROM organization_industries oi2
          JOIN industry i2 ON i2.id = oi2.industry_id
          WHERE oi2.organization_id = o.id AND i2.name ILIKE $${paramIdx}
        )
      )`);
      params.push(`%${filters.q}%`);
      paramIdx++;
    }

    if (filters.country) {
      conditions.push(`o.legal_country ILIKE $${paramIdx}`);
      params.push(`%${filters.country}%`);
      paramIdx++;
    }

    if (filters.industry_id) {
      conditions.push(`EXISTS (
        SELECT 1 FROM organization_industries oi3
        WHERE oi3.organization_id = o.id AND oi3.industry_id = $${paramIdx}
      )`);
      params.push(filters.industry_id);
      paramIdx++;
    }

    if (filters.organization_id) {
      conditions.push(`o.id = $${paramIdx}`);
      params.push(filters.organization_id);
      paramIdx++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countResult = (await this.db.query(
      `SELECT COUNT(DISTINCT o.id) AS total FROM organization o ${whereClause}`,
      params,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    // Data query
    const dataParams = [...params, limit, offset];
    const dataResult = (await this.db.query(
      `SELECT
         o.id,
         o.name,
         o.description,
         o.logo,
         o.legal_city,
         o.legal_state,
         o.legal_country,
         o.contact_no,
         o.email,
         o.website,
         COALESCE(
           json_agg(DISTINCT jsonb_build_object('id', i.id, 'name', i.name))
           FILTER (WHERE i.id IS NOT NULL),
           '[]'
         ) AS industries,
         COUNT(DISTINCT ic.id) AS total_certificates
       FROM organization o
       LEFT JOIN organization_industries oi ON oi.organization_id = o.id
       LEFT JOIN industry i ON i.id = oi.industry_id
       LEFT JOIN issued_certificates ic ON ic.organization_id = o.id AND ic.is_blocked = FALSE
       ${whereClause}
       GROUP BY o.id
       ORDER BY COUNT(DISTINCT ic.id) DESC, o.name ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      dataParams,
    )) as QueryResult<OrganizationSearchResult & { total_certificates: string }>;

    const data = dataResult.rows.map((row) => ({
      ...row,
      total_certificates: Number(row.total_certificates),
    }));

    return { data, total };
  }

  async searchCertificates(
    filters: SearchFilters,
    limit: number,
    offset: number,
  ): Promise<{ data: CertificateSearchResult[]; total: number }> {
    const conditions: string[] = ['ic.is_blocked = FALSE'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.q) {
      conditions.push(`(
        ic.certificate_name ILIKE $${paramIdx}
        OR ic.certificate_number ILIKE $${paramIdx}
        OR o.name ILIKE $${paramIdx}
        OR ic.badge_name ILIKE $${paramIdx}
        OR EXISTS (
          SELECT 1 FROM certificates c2
          WHERE c2.id = ic.certificate_id
            AND c2.industry_ids && (
              SELECT COALESCE(array_agg(i3.id), '{}')
              FROM industry i3
              WHERE i3.name ILIKE $${paramIdx}
            )
        )
      )`);
      params.push(`%${filters.q}%`);
      paramIdx++;
    }

    if (filters.country) {
      conditions.push(`o.legal_country ILIKE $${paramIdx}`);
      params.push(`%${filters.country}%`);
      paramIdx++;
    }

    if (filters.industry_id) {
      conditions.push(`c.industry_ids @> ARRAY[$${paramIdx}]::uuid[]`);
      params.push(filters.industry_id);
      paramIdx++;
    }

    if (filters.organization_id) {
      conditions.push(`ic.organization_id = $${paramIdx}`);
      params.push(filters.organization_id);
      paramIdx++;
    }

    if (filters.certificate_id) {
      conditions.push(`ic.certificate_id = $${paramIdx}`);
      params.push(filters.certificate_id);
      paramIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count query
    const countResult = (await this.db.query(
      `SELECT COUNT(*) AS total
       FROM issued_certificates ic
       JOIN organization o ON o.id = ic.organization_id
       JOIN certificates c ON c.id = ic.certificate_id
       ${whereClause}`,
      params,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    // Data query
    const dataParams = [...params, limit, offset];
    const dataResult = (await this.db.query(
      `SELECT
         ic.id,
         ic.certificate_name,
         ic.certificate_number,
         c.certificate_id,
         ic.organization_id,
         o.name AS organization_name,
         o.logo AS organization_logo,
         COALESCE(ic.branch_id, mb.id) AS branch_id,
         COALESCE(b.name, mb.name) AS branch_name,
         ic.badge_name,
         ic.badge_color,
         ic.review_score,
         ic.issued_at,
         ic.expiry_date,
         ic.is_blocked
       FROM issued_certificates ic
       JOIN organization o ON o.id = ic.organization_id
       JOIN certificates c ON c.id = ic.certificate_id
       LEFT JOIN branches b ON b.id = ic.branch_id
       LEFT JOIN branches mb ON mb.organization_id = ic.organization_id AND mb.is_main = TRUE
       ${whereClause}
       ORDER BY ic.issued_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      dataParams,
    )) as QueryResult<CertificateSearchResult>;

    const data = dataResult.rows.map((row) => ({
      ...row,
      review_score: row.review_score !== null ? Number(row.review_score) : null,
    }));

    return { data, total };
  }

  // ──────────────────────────────────────────────────────────
  // Organization Profile
  // ──────────────────────────────────────────────────────────
  async getOrganizationProfile(
    organizationId: string,
  ): Promise<OrganizationProfile | null> {
    const result = (await this.db.query(
      `SELECT
         o.id,
         o.name,
         o.description,
         o.logo,
         o.company_size,
         o.organization_type,
         o.website,
         o.email,
         o.contact_no,
         o.legal_city,
         o.legal_state,
         o.legal_country,
         o.created_at,
         COALESCE(
           json_agg(DISTINCT jsonb_build_object('id', i.id, 'name', i.name))
           FILTER (WHERE i.id IS NOT NULL),
           '[]'
         ) AS industries,
         COUNT(DISTINCT ic.id) AS total_certificates
       FROM organization o
       LEFT JOIN organization_industries oi ON oi.organization_id = o.id
       LEFT JOIN industry i ON i.id = oi.industry_id
       LEFT JOIN issued_certificates ic ON ic.organization_id = o.id AND ic.is_blocked = FALSE
       WHERE o.id = $1
       GROUP BY o.id`,
      [organizationId],
    )) as QueryResult<OrganizationProfile & { total_certificates: string }>;

    if (!result.rows[0]) return null;

    return {
      ...result.rows[0],
      total_certificates: Number(result.rows[0].total_certificates),
    };
  }

  async getOrganizationDetails(
    organizationId: string,
  ): Promise<OrganizationDetails | null> {
    const result = (await this.db.query(
      `SELECT
         o.name AS organization_name,
         o.legal_registered_name,
         o.website,
         o.description AS about_organization,
         COALESCE(u.is_verified, FALSE) AS is_verified,
         o.legal_city,
         o.legal_state,
         o.legal_country,
         (
           SELECT COUNT(*)::int
           FROM employee e
           WHERE e.organization_id = o.id
         ) AS total_employees,
         (
           SELECT i.name
           FROM organization_industries oi
           JOIN industry i ON i.id = oi.industry_id
           WHERE oi.organization_id = o.id
           LIMIT 1
         ) AS industry_type
       FROM organization o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`,
      [organizationId],
    )) as QueryResult<{
      organization_name: string;
      legal_registered_name: string | null;
      website: string | null;
      about_organization: string | null;
      is_verified: boolean;
      total_employees: number;
      legal_city: string | null;
      legal_state: string | null;
      legal_country: string | null;
      industry_type: string | null;
    }>;

    if (!result.rows[0]) return null;

    const row = result.rows[0];
    const locationParts = [row.legal_city, row.legal_country].filter(Boolean);
    const headquarters_location =
      locationParts.length > 0 ? locationParts.join(', ') : null;

    return {
      organization_name: row.organization_name,
      legal_registered_name: row.legal_registered_name ?? null,
      industry_type: row.industry_type ?? null,
      headquarters_location,
      total_employees: Number(row.total_employees),
      website: row.website ?? null,
      about_organization: row.about_organization ?? null,
      is_verified: Boolean(row.is_verified),
    };
  }

  async getOrganizationProfileBranches(
    organizationId: string,
  ): Promise<BranchWithCertificates[]> {
    const branchResult = (await this.db.query(
      `SELECT
         b.id,
         b.name,
         b.city,
         b.country,
         b.is_main,
         COUNT(DISTINCT ic.id) AS certifications_count
       FROM branches b
       LEFT JOIN issued_certificates ic ON ic.organization_id = b.organization_id
         AND ic.is_blocked = FALSE
         AND (
           ic.branch_id = b.id
           OR (ic.branch_id IS NULL AND b.is_main = TRUE)
         )
       WHERE b.organization_id = $1
       GROUP BY b.id
       ORDER BY b.is_main DESC, b.name ASC`,
      [organizationId],
    )) as QueryResult<{
      id: string;
      name: string;
      city: string | null;
      country: string | null;
      is_main: boolean;
      certifications_count: string;
    }>;

    return this.mapBranchesWithCertificates(organizationId, branchResult.rows);
  }

  // ──────────────────────────────────────────────────────────
  // Organization Metrics
  // ──────────────────────────────────────────────────────────
  async getOrganizationMetrics(
    organizationId: string,
  ): Promise<OrganizationMetrics> {
    const result = (await this.db.query(
      `SELECT
         (SELECT COUNT(*) FROM branches WHERE organization_id = $1) AS total_branches,
         (SELECT COUNT(DISTINCT ic.branch_id)
          FROM issued_certificates ic
          WHERE ic.organization_id = $1
            AND ic.is_blocked = FALSE
            AND ic.branch_id IS NOT NULL
            AND (ic.expiry_date IS NULL OR ic.expiry_date > NOW())) AS certified_branches,
         (SELECT COUNT(*)
          FROM certificate_assessments ca
          WHERE ca.organization_id = $1
            AND ca.assessment_type = 'assured') AS assured_certificates,
         (SELECT COUNT(*)
          FROM certificate_assessments ca
          WHERE ca.organization_id = $1
            AND ca.assessment_type = 'self_disclosure') AS self_disclosures`,
      [organizationId],
    )) as QueryResult<{
      total_branches: string;
      certified_branches: string;
      assured_certificates: string;
      self_disclosures: string;
    }>;

    const row = result.rows[0];
    return {
      total_branches: parseInt(row.total_branches, 10),
      certified_branches: parseInt(row.certified_branches, 10),
      assured_certificates: parseInt(row.assured_certificates, 10),
      self_disclosures: parseInt(row.self_disclosures, 10),
    };
  }

  // ──────────────────────────────────────────────────────────
  // Organization Branches with Certificates
  // ──────────────────────────────────────────────────────────
  async getOrganizationBranches(
    organizationId: string,
    limit: number,
    offset: number,
    typeFilter?: string,
    statusFilter?: string,
  ): Promise<{ data: BranchWithCertificates[]; total: number }> {
    // Build dynamic conditions
    const conditions: string[] = ['b.organization_id = $1'];
    const params: unknown[] = [organizationId];
    let paramIdx = 2;

    if (typeFilter === 'main') {
      conditions.push('b.is_main = TRUE');
    } else if (typeFilter === 'sub') {
      conditions.push('b.is_main = FALSE');
    }

    // statusFilter is reserved for future use (no status column on branches currently)

    const whereClause = conditions.join(' AND ');

    // Count query
    const countResult = (await this.db.query(
      `SELECT COUNT(*) AS total FROM branches b WHERE ${whereClause}`,
      params,
    )) as QueryResult<{ total: string }>;
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    // Branches query
    const branchParams = [...params, limit, offset];
    const branchResult = (await this.db.query(
      `SELECT
         b.id,
         b.name,
         b.city,
         b.country,
         b.is_main,
         COUNT(DISTINCT ic.id) AS certifications_count
       FROM branches b
       LEFT JOIN issued_certificates ic ON ic.organization_id = b.organization_id
         AND ic.is_blocked = FALSE
         AND (
           ic.branch_id = b.id
           OR (ic.branch_id IS NULL AND b.is_main = TRUE)
         )
       WHERE ${whereClause}
       GROUP BY b.id
       ORDER BY b.is_main DESC, b.name ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      branchParams,
    )) as QueryResult<{
      id: string;
      name: string;
      city: string | null;
      country: string | null;
      is_main: boolean;
      certifications_count: string;
    }>;

    if (branchResult.rows.length === 0) {
      return { data: [], total };
    }
    const data = await this.mapBranchesWithCertificates(
      organizationId,
      branchResult.rows,
    );

    return { data, total };
  }

  // ──────────────────────────────────────────────────────────
  // Certificate Detail by Number
  // ──────────────────────────────────────────────────────────
  async getCertificateByNumber(
    certificateNumber: string,
  ): Promise<CertificateDetail | null> {
    const result = (await this.db.query(
      `SELECT
         ic.id,
         ic.certificate_number,
         ic.certificate_name,
         c.certificate_id,
         ic.organization_id,
         o.name AS organization_name,
         o.logo AS organization_logo,
         COALESCE(ic.branch_id, mb.id) AS branch_id,
         COALESCE(b.name, mb.name) AS branch_name,
         ic.certificate_name AS scope,
         ic.badge_name,
         ic.badge_color,
         ic.review_score,
         ic.issued_at,
         ic.expiry_date,
         ca.audit_date AS audit_start,
         ca.review_date AS audit_end,
         ic.is_blocked,
         aud.signature AS auditor_signature,
         rev.signature AS reviewer_signature
       FROM issued_certificates ic
       JOIN certificates c ON c.id = ic.certificate_id
       JOIN organization o ON o.id = ic.organization_id
       LEFT JOIN branches b ON b.id = ic.branch_id
       LEFT JOIN branches mb ON mb.organization_id = ic.organization_id AND mb.is_main = TRUE
       LEFT JOIN certificate_assessments ca ON ca.id = ic.assessment_id
       LEFT JOIN auditor aud ON aud.user_id = ca.assigned_auditor_id
       LEFT JOIN reviewer rev ON rev.user_id = ca.assigned_reviewer_id
       WHERE ic.certificate_number = $1`,
      [certificateNumber],
    )) as QueryResult<{
      id: string;
      certificate_number: string;
      certificate_name: string;
      certificate_id: string;
      organization_id: string;
      organization_name: string;
      organization_logo: string | null;
      branch_id: string | null;
      branch_name: string | null;
      scope: string;
      badge_name: string | null;
      badge_color: string | null;
      review_score: number | null;
      issued_at: Date;
      expiry_date: Date | null;
      audit_start: Date | null;
      audit_end: Date | null;
      is_blocked: boolean;
      auditor_signature: string | null;
      reviewer_signature: string | null;
    }>;

    if (!result.rows[0]) return null;

    const row = result.rows[0];

    // Fetch assurance details from audits table
    const assuranceResult = (await this.db.query(
      `SELECT
         a.id,
         CASE WHEN a.audit_lifecycle_status IS NOT NULL
           THEN a.audit_lifecycle_status::text
           ELSE 'audit'
         END AS type,
         COALESCE(a.status::text, 'pending') AS status,
         a.audit_summary AS details
       FROM audits a
       JOIN certificate_assessments ca ON ca.id = a.assessment_id
       JOIN issued_certificates ic ON ic.assessment_id = ca.id
       WHERE ic.certificate_number = $1
       ORDER BY a.created_at DESC`,
      [certificateNumber],
    )) as QueryResult<AssuranceDetail>;

    const status = this.deriveCertificateStatus(row.is_blocked, row.expiry_date);

    return {
      ...row,
      review_score: row.review_score !== null ? Number(row.review_score) : null,
      status,
      assurance_details: assuranceResult.rows,
    };
  }

  // ──────────────────────────────────────────────────────────
  // Certificate Detail by Issued Certificate ID
  // ──────────────────────────────────────────────────────────
  async getCertificateByIds(
    issuedCertificateId: string,
  ): Promise<PublicCertificateDetail | null> {
    const result = (await this.db.query(
      `SELECT
         ic.id,
         ic.certificate_number,
         ic.certificate_name,
         c.certificate_id,
         ic.organization_id,
         o.name AS organization_name,
         o.logo AS organization_logo,
         COALESCE(ic.branch_id, mb.id) AS branch_id,
         COALESCE(b.name, mb.name) AS branch_name,
         COALESCE(b.city, mb.city) AS branch_city,
         COALESCE(b.country, mb.country) AS branch_country,
         ic.certificate_name AS scope,
         ic.badge_name,
         ic.badge_color,
         ic.review_score,
         ic.issued_at,
         COALESCE(
           ic.expiry_date,
           CASE
             WHEN COALESCE(c.validity_years, 0) > 0
               OR COALESCE(c.validity_months, 0) > 0
               OR COALESCE(c.validity_days, 0) > 0
             THEN
               ic.issued_at
               + (COALESCE(c.validity_years,  0) || ' years')::interval
               + (COALESCE(c.validity_months, 0) || ' months')::interval
               + (COALESCE(c.validity_days,   0) || ' days')::interval
             ELSE NULL
           END
         ) AS expiry_date,
         ca.audit_date AS audit_start,
         ca.review_date AS audit_end,
         ca.assessment_type,
         ic.is_blocked,
         COALESCE(c.validity_days, 0) AS validity_days,
         COALESCE(c.validity_months, 0) AS validity_months,
         COALESCE(c.validity_years, 0) AS validity_years,
         aud.id AS auditor_id,
         aud.first_name AS auditor_first_name,
         aud.last_name AS auditor_last_name,
         aud.signature AS auditor_signature,
         rev.id AS reviewer_id,
         rev.first_name AS reviewer_first_name,
         rev.last_name AS reviewer_last_name,
         rev.signature AS reviewer_signature
       FROM issued_certificates ic
       JOIN certificates c ON c.id = ic.certificate_id
       JOIN organization o ON o.id = ic.organization_id
       LEFT JOIN branches b ON b.id = ic.branch_id
       LEFT JOIN branches mb ON mb.organization_id = ic.organization_id AND mb.is_main = TRUE
       LEFT JOIN certificate_assessments ca ON ca.id = ic.assessment_id
       LEFT JOIN auditor aud ON aud.user_id = ca.assigned_auditor_id
       LEFT JOIN reviewer rev ON rev.user_id = ca.assigned_reviewer_id
       WHERE ic.id = $1`,
      [issuedCertificateId],
    )) as QueryResult<{
      id: string;
      certificate_number: string;
      certificate_name: string;
      certificate_id: string;
      organization_id: string;
      organization_name: string;
      organization_logo: string | null;
      branch_id: string | null;
      branch_name: string | null;
      branch_city: string | null;
      branch_country: string | null;
      scope: string;
      badge_name: string | null;
      badge_color: string | null;
      review_score: number | null;
      issued_at: Date;
      expiry_date: Date | null;
      audit_start: Date | null;
      audit_end: Date | null;
      assessment_type: 'assured' | 'self_disclosure';
      is_blocked: boolean;
      validity_days: number | null;
      validity_months: number | null;
      validity_years: number | null;
      auditor_id: string | null;
      auditor_first_name: string | null;
      auditor_last_name: string | null;
      auditor_signature: string | null;
      reviewer_id: string | null;
      reviewer_first_name: string | null;
      reviewer_last_name: string | null;
      reviewer_signature: string | null;
    }>;

    if (!result.rows[0]) return null;

    const row = result.rows[0];

    const assuranceResult = (await this.db.query(
      `SELECT
         a.id,
         CASE WHEN a.audit_lifecycle_status IS NOT NULL
           THEN a.audit_lifecycle_status::text
           ELSE 'audit'
         END AS type,
         COALESCE(a.status::text, 'pending') AS status,
         a.audit_summary AS details
       FROM audits a
       JOIN certificate_assessments ca ON ca.id = a.assessment_id
       JOIN issued_certificates ic ON ic.assessment_id = ca.id
       WHERE ic.id = $1
       ORDER BY a.created_at DESC`,
      [row.id],
    )) as QueryResult<AssuranceDetail>;

    const status = this.deriveCertificateStatus(row.is_blocked, row.expiry_date);

    return {
      id: row.id,
      certificate_number: row.certificate_number,
      certificate_name: row.certificate_name,
      certificate_id: row.certificate_id,
      organization_id: row.organization_id,
      organization_name: row.organization_name,
      organization_logo: row.organization_logo,
      branch_id: row.branch_id,
      branch_name: row.branch_name,
      branch_city: row.branch_city,
      branch_country: row.branch_country,
      scope: row.scope,
      badge_name: row.badge_name,
      badge_color: row.badge_color,
      review_score: row.review_score !== null ? Number(row.review_score) : null,
      issued_at: row.issued_at,
      expiry_date: row.expiry_date,
      audit_start: row.audit_start,
      audit_end: row.audit_end,
      assessment_type: row.assessment_type,
      is_blocked: row.is_blocked,
      status,
      validity_days: row.validity_days,
      validity_months: row.validity_months,
      validity_years: row.validity_years,
      validity_label: this.buildValidityLabel(row.validity_years, row.validity_months, row.validity_days, row.issued_at, row.expiry_date),
      auditor:
        row.auditor_id
          ? {
              id: row.auditor_id,
              first_name: row.auditor_first_name!,
              last_name: row.auditor_last_name!,
              signature: row.auditor_signature,
            }
          : null,
      reviewer:
        row.reviewer_id
          ? {
              id: row.reviewer_id,
              first_name: row.reviewer_first_name!,
              last_name: row.reviewer_last_name!,
              signature: row.reviewer_signature,
            }
          : null,
      assurance_details: assuranceResult.rows,
    };
  }

  // ──────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────
  private deriveCertificateStatus(
    isBlocked: boolean,
    expiryDate: Date | null,
  ): string {
    if (isBlocked) return 'blocked';
    if (expiryDate && new Date(expiryDate) < new Date()) return 'expired';
    return 'active';
  }

  private computeExpiryDate(
    issuedAt: Date,
    existingExpiry: Date | null,
    years: number | null,
    months: number | null,
    days: number | null,
  ): Date | null {
    if (existingExpiry) return existingExpiry;
    if (!years && !months && !days) return null;
    const d = new Date(issuedAt);
    if (years) d.setFullYear(d.getFullYear() + years);
    if (months) d.setMonth(d.getMonth() + months);
    if (days) d.setDate(d.getDate() + days);
    return d;
  }

  private buildValidityLabel(
    years: number | null,
    months: number | null,
    days: number | null,
    issuedAt: Date,
    expiryDate: Date | null,
  ): string | null {
    // Prefer template values if any are non-zero
    const y = years ?? 0;
    const m = months ?? 0;
    const d = days ?? 0;
    if (y > 0 || m > 0 || d > 0) {
      const parts: string[] = [];
      if (y) parts.push(`${y} Year${y !== 1 ? 's' : ''}`);
      if (m) parts.push(`${m} Month${m !== 1 ? 's' : ''}`);
      if (d) parts.push(`${d} Day${d !== 1 ? 's' : ''}`);
      return parts.join(', ');
    }

    // Fallback: derive label from the issued → expiry date difference
    if (!expiryDate) return null;
    const issued = new Date(issuedAt);
    const expiry = new Date(expiryDate);
    let yearDiff = expiry.getFullYear() - issued.getFullYear();
    let monthDiff = expiry.getMonth() - issued.getMonth();
    const dayDiff = expiry.getDate() - issued.getDate();
    if (dayDiff < 0) monthDiff--;
    if (monthDiff < 0) { yearDiff--; monthDiff += 12; }

    const parts: string[] = [];
    if (yearDiff > 0) parts.push(`${yearDiff} Year${yearDiff !== 1 ? 's' : ''}`);
    if (monthDiff > 0) parts.push(`${monthDiff} Month${monthDiff !== 1 ? 's' : ''}`);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  private async mapBranchesWithCertificates(
    organizationId: string,
    branches: Array<{
      id: string;
      name: string;
      city: string | null;
      country: string | null;
      is_main: boolean;
      certifications_count: string;
    }>,
  ): Promise<BranchWithCertificates[]> {
    if (branches.length === 0) {
      return [];
    }

    const branchIds = branches.map((branch) => branch.id);
    const mainBranchId = branches.find((branch) => branch.is_main)?.id ?? null;

    const certsByBranch = await this.getCertificatesByBranchIds(
      organizationId,
      branchIds,
      mainBranchId,
    );

    // Count assessments per branch by type (NULL branch_id collapses to main branch)
    const assessmentCountsResult = (await this.db.query(
      `SELECT
         COALESCE(ca.branch_id, $2::uuid) AS branch_id,
         ca.assessment_type,
         COUNT(*) AS assessment_count
       FROM certificate_assessments ca
       WHERE ca.organization_id = $1
         AND (
           ca.branch_id = ANY($3)
           OR (ca.branch_id IS NULL AND $2::uuid IS NOT NULL)
         )
       GROUP BY COALESCE(ca.branch_id, $2::uuid), ca.assessment_type`,
      [organizationId, mainBranchId, branchIds],
    )) as QueryResult<{
      branch_id: string;
      assessment_type: string;
      assessment_count: string;
    }>;

    const assuredByBranch = new Map<string, number>();
    const selfDisclosureByBranch = new Map<string, number>();
    for (const row of assessmentCountsResult.rows) {
      const count = parseInt(row.assessment_count, 10);
      if (row.assessment_type === 'assured') {
        assuredByBranch.set(row.branch_id, count);
      } else if (row.assessment_type === 'self_disclosure') {
        selfDisclosureByBranch.set(row.branch_id, count);
      }
    }

    return branches.map((branch) => {
      const certs = certsByBranch.get(branch.id) || [];
      return {
        id: branch.id,
        name: branch.name,
        city: branch.city,
        country: branch.country,
        status: 'active',
        is_main: branch.is_main,
        certifications_count: parseInt(branch.certifications_count, 10),
        assured_certificates_count: assuredByBranch.get(branch.id) ?? 0,
        self_disclosure_certificates_count: selfDisclosureByBranch.get(branch.id) ?? 0,
        certificates: certs,
      };
    });
  }

  private async getCertificatesByBranchIds(
    organizationId: string,
    branchIds: string[],
    mainBranchId: string | null,
  ): Promise<Map<string, BranchCertificate[]>> {
    if (branchIds.length === 0) {
      return new Map<string, BranchCertificate[]>();
    }

    const certResult = (await this.db.query(
      `SELECT
         ic.id,
         ic.branch_id,
         ic.certificate_name,
         ic.certificate_number,
         ic.issued_at,
         ic.expiry_date,
         ca.assessment_type,
         (ca.assigned_auditor_id IS NOT NULL) AS audited,
         (ca.assigned_reviewer_id IS NOT NULL) AS reviewed
       FROM issued_certificates ic
       JOIN certificate_assessments ca ON ca.id = ic.assessment_id
       WHERE ic.is_blocked = FALSE
         AND (
           ic.branch_id = ANY($1)
           OR (
             $2::uuid IS NOT NULL
             AND ic.organization_id = $3
             AND ic.branch_id IS NULL
           )
         )
       ORDER BY ic.issued_at DESC`,
      [branchIds, mainBranchId, organizationId],
    )) as QueryResult<{
      id: string;
      branch_id: string | null;
      certificate_name: string;
      certificate_number: string;
      issued_at: Date;
      expiry_date: Date | null;
      assessment_type: string;
      audited: boolean;
      reviewed: boolean;
    }>;

    const certsByBranch = new Map<string, BranchCertificate[]>();
    for (const cert of certResult.rows) {
      const targetBranchId = cert.branch_id ?? mainBranchId;
      if (!targetBranchId) {
        continue;
      }
      const mapped: BranchCertificate = {
        id: cert.id,
        certificate_name: cert.certificate_name,
        certificate_number: cert.certificate_number,
        issued_at: cert.issued_at,
        expiry_date: cert.expiry_date,
        audited: cert.audited,
        reviewed: cert.reviewed,
        type: cert.assessment_type === 'assured' ? 'assured' : 'self_disclosure',
        status:
          cert.expiry_date && new Date(cert.expiry_date) < new Date()
            ? 'expired'
            : 'active',
      };
      const existing = certsByBranch.get(targetBranchId) || [];
      existing.push(mapped);
      certsByBranch.set(targetBranchId, existing);
    }

    return certsByBranch;
  }
}
