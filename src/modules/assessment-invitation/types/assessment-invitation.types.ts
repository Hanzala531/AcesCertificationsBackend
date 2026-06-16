export interface AssessmentInvitation {
  id: string;
  assessment_id: string;
  certificate_id: string;
  invited_user_id: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface AssessmentInvitationWithDetails extends AssessmentInvitation {
  certificate_name?: string;
  assessment_status?: string;
  invited_by_name?: string;
}
