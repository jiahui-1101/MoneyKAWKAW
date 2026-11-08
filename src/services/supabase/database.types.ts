// Generated contract mirror for the checked-in migrations. Regenerate from the local schema with:
// npx supabase gen types typescript --local > src/services/supabase/database.types.ts
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type TimeRow = { created_at: string; updated_at: string };

export interface Database {
  public: {
    Tables: {
      clubs: Table<TimeRow & { id: string; slug: string; name: string; currency: Database['public']['Enums']['currency_code']; timezone: string; warning_percent: number }>;
      profiles: Table<{ user_id: string; display_name: string; created_at: string; updated_at: string }>;
      club_memberships: Table<TimeRow & { club_id: string; user_id: string; status: string; revision: number }>;
      club_role_grants: Table<{ club_id: string; user_id: string; role: Database['public']['Enums']['club_role']; created_at: string; created_by: string | null }>;
      activities: Table<TimeRow & { id: string; club_id: string; name: string; description: string; type: Database['public']['Enums']['activity_type']; status: Database['public']['Enums']['activity_status']; start_date: string; end_date: string; budget_sen: number; currency: Database['public']['Enums']['currency_code']; archived_at: string | null; archived_by: string | null; retain_until: string | null; legal_hold: boolean }>;
      departments: Table<TimeRow & { id: string; club_id: string; activity_id: string; name: string; description: string; head_label: string; allocation_sen: number }>;
      activity_memberships: Table<{ activity_id: string; club_id: string; user_id: string; status: string; created_at: string }>;
      activity_role_grants: Table<{ activity_id: string; club_id: string; user_id: string; role: Database['public']['Enums']['activity_role']; created_at: string; created_by: string | null }>;
      department_memberships: Table<{ department_id: string; activity_id: string; club_id: string; user_id: string; role: Database['public']['Enums']['department_role']; status: string; created_at: string; created_by: string | null }>;
      member_preferences: Table<{ user_id: string; notification_enabled: boolean; updated_at: string }>;
      invitations: Table<{ id: string; club_id: string; email: string; invited_by: string | null; expires_at: string; accepted_by: string | null; accepted_at: string | null; revoked_at: string | null; created_at: string }>;
      invitation_role_grants: Table<{ id: string; invitation_id: string; club_id: string; club_role: Database['public']['Enums']['club_role'] | null; activity_role: Database['public']['Enums']['activity_role'] | null; department_role: Database['public']['Enums']['department_role'] | null; activity_id: string | null; department_id: string | null; created_at: string }>;
      audit_events: Table<{ id: string; club_id: string; actor_uid: string; action: string; record_type: string; record_id: string; activity_id: string | null; department_id: string | null; changes: Json; created_at: string }>;
      archive_records: Table<{ id: string; club_id: string; entity_type: string; entity_id: string; activity_id: string | null; department_id: string | null; archived_at: string; archived_by: string | null; retain_until: string | null; legal_hold: boolean; created_at: string }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_club_invitation: { Args: Record<PropertyKey, never>; Returns: boolean };
      current_club_session: { Args: Record<PropertyKey, never>; Returns: Json };
    };
    Enums: {
      club_role: 'Director' | 'Treasurer';
      department_role: 'HOD' | 'Member';
      activity_role: 'Treasurer';
      currency_code: 'MYR' | 'SGD' | 'USD';
      activity_type: 'Workshop' | 'Large-scale event' | 'Community' | 'Other';
      activity_status: 'Planning' | 'Active' | 'Completed';
    };
    CompositeTypes: { [_ in never]: never };
  };
}
