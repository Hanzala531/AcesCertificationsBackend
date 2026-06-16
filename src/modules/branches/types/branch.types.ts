export interface BranchRecord {
  id: string;
  organization_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  contact_no?: string;
  email?: string;
  is_main: boolean;
  branch_size?: string;
  created_at: Date;
  updated_at: Date;
}

export type CreateBranchData = Omit<
  BranchRecord,
  'id' | 'created_at' | 'updated_at'
>;

export type UpdateBranchData = Partial<
  Omit<BranchRecord, 'id' | 'organization_id' | 'created_at' | 'updated_at'>
>;
