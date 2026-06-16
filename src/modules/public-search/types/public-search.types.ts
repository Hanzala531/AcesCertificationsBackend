export interface OrganizationProfile {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  company_size: string | null;
  organization_type: string | null;
  website: string | null;
  email: string | null;
  contact_no: string | null;
  legal_city: string | null;
  legal_state: string | null;
  legal_country: string | null;
  industries: { id: string; name: string }[];
  total_certificates: number;
  branches?: BranchWithCertificates[];
  created_at: Date;
}

export interface OrganizationDetails {
  organization_name: string;
  legal_registered_name: string | null;
  industry_type: string | null;
  headquarters_location: string | null;
  total_employees: number;
  website: string | null;
  about_organization: string | null;
  is_verified: boolean;
}

export interface OrganizationMetrics {
  total_branches: number;
  certified_branches: number;
  assured_certificates: number;
  self_disclosures: number;
}

export interface BranchWithCertificates {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  status: string;
  is_main: boolean;
  certifications_count: number;
  assured_certificates_count: number;
  self_disclosure_certificates_count: number;
  certificates: BranchCertificate[];
}

export interface BranchCertificate {
  id: string;
  certificate_name: string;
  certificate_number: string;
  issued_at: Date;
  expiry_date: Date | null;
  audited: boolean;
  reviewed: boolean;
  type: 'assured' | 'self_disclosure';
  status: 'active' | 'expired';
}

export interface CertificateDetail {
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
  status: string;
  auditor_signature: string | null;
  reviewer_signature: string | null;
  assurance_details: AssuranceDetail[];
}

export interface AssuranceDetail {
  id: string;
  type: string;
  status: string;
  details: string | null;
}

export interface PublicCertificateDetail {
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
  status: string;
  validity_days: number | null;
  validity_months: number | null;
  validity_years: number | null;
  validity_label: string | null;
  auditor: {
    id: string;
    first_name: string;
    last_name: string;
    signature: string | null;
  } | null;
  reviewer: {
    id: string;
    first_name: string;
    last_name: string;
    signature: string | null;
  } | null;
  assurance_details: AssuranceDetail[];
}
