
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activities": {
                  Row: {
                    "archived_at": string | null,"archived_by": string | null,"budget_sen": number,"club_id": string,"created_at": string,"currency": Database["public"]['Enums']["currency_code"],"description": string,"end_date": string,"id": string,"legal_hold": boolean,"name": string,"retain_until": string | null,"start_date": string,"status": Database["public"]['Enums']["activity_status"],"type": Database["public"]['Enums']["activity_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"archived_by"?: string | null,"budget_sen": number,"club_id": string,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"description"?: string,"end_date": string,"id"?: string,"legal_hold"?: boolean,"name": string,"retain_until"?: string | null,"start_date": string,"status"?: Database["public"]['Enums']["activity_status"],"type": Database["public"]['Enums']["activity_type"],"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"archived_by"?: string | null,"budget_sen"?: number,"club_id"?: string,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"description"?: string,"end_date"?: string,"id"?: string,"legal_hold"?: boolean,"name"?: string,"retain_until"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["activity_status"],"type"?: Database["public"]['Enums']["activity_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"activity_memberships": {
                  Row: {
                    "activity_id": string,"club_id": string,"created_at": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"club_id": string,"created_at"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "activity_id"?: string,"club_id"?: string,"created_at"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_memberships_activity_id_club_id_fkey"
      columns: ["activity_id","club_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id","club_id"]
    },{
      foreignKeyName: "activity_memberships_club_id_user_id_fkey"
      columns: ["club_id","user_id"]
isOneToOne: false
      referencedRelation: "club_memberships"
      referencedColumns: ["club_id","user_id"]
    }
                  ]
                },"activity_role_grants": {
                  Row: {
                    "activity_id": string,"club_id": string,"created_at": string,"created_by": string | null,"role": Database["public"]['Enums']["activity_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"club_id": string,"created_at"?: string,"created_by"?: string | null,"role": Database["public"]['Enums']["activity_role"],"user_id": string
                  }
                  Update: {
                    "activity_id"?: string,"club_id"?: string,"created_at"?: string,"created_by"?: string | null,"role"?: Database["public"]['Enums']["activity_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_role_grants_activity_id_user_id_club_id_fkey"
      columns: ["activity_id","user_id","club_id"]
isOneToOne: false
      referencedRelation: "activity_memberships"
      referencedColumns: ["activity_id","user_id","club_id"]
    }
                  ]
                },"archive_records": {
                  Row: {
                    "activity_id": string | null,"archived_at": string,"archived_by": string | null,"club_id": string,"created_at": string,"department_id": string | null,"entity_id": string,"entity_type": string,"id": string,"legal_hold": boolean,"retain_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id"?: string | null,"archived_at"?: string,"archived_by"?: string | null,"club_id": string,"created_at"?: string,"department_id"?: string | null,"entity_id": string,"entity_type": string,"id"?: string,"legal_hold"?: boolean,"retain_until"?: string | null
                  }
                  Update: {
                    "activity_id"?: string | null,"archived_at"?: string,"archived_by"?: string | null,"club_id"?: string,"created_at"?: string,"department_id"?: string | null,"entity_id"?: string,"entity_type"?: string,"id"?: string,"legal_hold"?: boolean,"retain_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "archive_records_activity_id_club_id_fkey"
      columns: ["activity_id","club_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id","club_id"]
    },{
      foreignKeyName: "archive_records_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "archive_records_department_id_activity_id_club_id_fkey"
      columns: ["department_id","activity_id","club_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id","activity_id","club_id"]
    }
                  ]
                },"audit_events": {
                  Row: {
                    "action": string,"activity_id": string | null,"actor_uid": string,"changes": NonNullable<Json>,"club_id": string,"created_at": string,"department_id": string | null,"id": string,"record_id": string,"record_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"activity_id"?: string | null,"actor_uid": string,"changes"?: NonNullable<Json>,"club_id": string,"created_at"?: string,"department_id"?: string | null,"id"?: string,"record_id": string,"record_type": string
                  }
                  Update: {
                    "action"?: string,"activity_id"?: string | null,"actor_uid"?: string,"changes"?: NonNullable<Json>,"club_id"?: string,"created_at"?: string,"department_id"?: string | null,"id"?: string,"record_id"?: string,"record_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_activity_id_club_id_fkey"
      columns: ["activity_id","club_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id","club_id"]
    },{
      foreignKeyName: "audit_events_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_events_department_id_activity_id_club_id_fkey"
      columns: ["department_id","activity_id","club_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id","activity_id","club_id"]
    }
                  ]
                },"club_memberships": {
                  Row: {
                    "club_id": string,"created_at": string,"revision": number,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"revision"?: number,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"revision"?: number,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_memberships_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"club_role_grants": {
                  Row: {
                    "club_id": string,"created_at": string,"created_by": string | null,"role": Database["public"]['Enums']["club_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"created_by"?: string | null,"role": Database["public"]['Enums']["club_role"],"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"created_by"?: string | null,"role"?: Database["public"]['Enums']["club_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_role_grants_club_id_user_id_fkey"
      columns: ["club_id","user_id"]
isOneToOne: false
      referencedRelation: "club_memberships"
      referencedColumns: ["club_id","user_id"]
    }
                  ]
                },"clubs": {
                  Row: {
                    "created_at": string,"currency": Database["public"]['Enums']["currency_code"],"id": string,"name": string,"slug": string,"timezone": string,"updated_at": string,"warning_percent": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"id"?: string,"name": string,"slug": string,"timezone"?: string,"updated_at"?: string,"warning_percent"?: number
                  }
                  Update: {
                    "created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"id"?: string,"name"?: string,"slug"?: string,"timezone"?: string,"updated_at"?: string,"warning_percent"?: number
                  }
                  Relationships: [

                  ]
                },"department_memberships": {
                  Row: {
                    "activity_id": string,"club_id": string,"created_at": string,"created_by": string | null,"department_id": string,"role": Database["public"]['Enums']["department_role"],"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"club_id": string,"created_at"?: string,"created_by"?: string | null,"department_id": string,"role": Database["public"]['Enums']["department_role"],"status"?: string,"user_id": string
                  }
                  Update: {
                    "activity_id"?: string,"club_id"?: string,"created_at"?: string,"created_by"?: string | null,"department_id"?: string,"role"?: Database["public"]['Enums']["department_role"],"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "department_memberships_activity_id_user_id_club_id_fkey"
      columns: ["activity_id","user_id","club_id"]
isOneToOne: false
      referencedRelation: "activity_memberships"
      referencedColumns: ["activity_id","user_id","club_id"]
    },{
      foreignKeyName: "department_memberships_department_id_activity_id_club_id_fkey"
      columns: ["department_id","activity_id","club_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id","activity_id","club_id"]
    }
                  ]
                },"departments": {
                  Row: {
                    "activity_id": string,"allocation_sen": number,"club_id": string,"created_at": string,"description": string,"head_label": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"allocation_sen": number,"club_id": string,"created_at"?: string,"description"?: string,"head_label"?: string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "activity_id"?: string,"allocation_sen"?: number,"club_id"?: string,"created_at"?: string,"description"?: string,"head_label"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "departments_activity_id_club_id_fkey"
      columns: ["activity_id","club_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id","club_id"]
    }
                  ]
                },"invitation_role_grants": {
                  Row: {
                    "activity_id": string | null,"activity_role": Database["public"]['Enums']["activity_role"] | null,"club_id": string,"club_role": Database["public"]['Enums']["club_role"] | null,"created_at": string,"department_id": string | null,"department_role": Database["public"]['Enums']["department_role"] | null,"id": string,"invitation_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id"?: string | null,"activity_role"?: Database["public"]['Enums']["activity_role"] | null,"club_id": string,"club_role"?: Database["public"]['Enums']["club_role"] | null,"created_at"?: string,"department_id"?: string | null,"department_role"?: Database["public"]['Enums']["department_role"] | null,"id"?: string,"invitation_id": string
                  }
                  Update: {
                    "activity_id"?: string | null,"activity_role"?: Database["public"]['Enums']["activity_role"] | null,"club_id"?: string,"club_role"?: Database["public"]['Enums']["club_role"] | null,"created_at"?: string,"department_id"?: string | null,"department_role"?: Database["public"]['Enums']["department_role"] | null,"id"?: string,"invitation_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitation_role_grants_activity_id_club_id_fkey"
      columns: ["activity_id","club_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id","club_id"]
    },{
      foreignKeyName: "invitation_role_grants_department_id_activity_id_club_id_fkey"
      columns: ["department_id","activity_id","club_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id","activity_id","club_id"]
    },{
      foreignKeyName: "invitation_role_grants_invitation_id_club_id_fkey"
      columns: ["invitation_id","club_id"]
isOneToOne: false
      referencedRelation: "invitations"
      referencedColumns: ["id","club_id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"club_id": string,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"club_id": string,"created_at"?: string,"email": string,"expires_at": string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"club_id"?: string,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    }
                  ]
                },"member_preferences": {
                  Row: {
                    "notification_enabled": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "notification_enabled"?: boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "notification_enabled"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_club_invitation":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"current_club_session":
{ Args: Record<PropertyKey, never>; Returns: Json
                           }
          }
          Enums: {
            "activity_role": "Treasurer","activity_status": "Planning"|"Active"|"Completed","activity_type": "Workshop"|"Large-scale event"|"Community"|"Other","club_role": "Director"|"Treasurer","currency_code": "MYR"|"SGD"|"USD","department_role": "HOD"|"Member"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {

          }
        },"public": {
          Enums: {
            "activity_role": ["Treasurer"],"activity_status": ["Planning", "Active", "Completed"],"activity_type": ["Workshop", "Large-scale event", "Community", "Other"],"club_role": ["Director", "Treasurer"],"currency_code": ["MYR", "SGD", "USD"],"department_role": ["HOD", "Member"]
          }
        }
} as const
