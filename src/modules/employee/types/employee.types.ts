export interface EmployeeRecord {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  organization_id: string;
  branch_id?: string | null;
  position?: string | null;
  department?: string | null;
  profile_picture?: string | null;
  phone_number?: string | null;
  permissions?: unknown[] | null;
  status?: 'pending' | 'active';
  email?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateEmployeeData {
  user_id: string;
  first_name: string;
  last_name: string;
  organization_id: string;
  branch_id?: string | null;
  position?: string | null;
  department?: string | null;
  profile_picture?: string | null;
  phone_number?: string | null;
  permissions?: unknown[] | null;
}
