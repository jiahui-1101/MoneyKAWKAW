
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
                    "archived_at": string | null,"archived_by": string | null,"budget_sen": number,"closing_revision": number,"club_id": string,"created_at": string,"currency": Database["public"]['Enums']["currency_code"],"description": string,"end_date": string,"financial_state": string,"id": string,"legal_hold": boolean,"name": string,"retain_until": string | null,"start_date": string,"status": Database["public"]['Enums']["activity_status"],"type": Database["public"]['Enums']["activity_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"archived_by"?: string | null,"budget_sen": number,"closing_revision"?: number,"club_id": string,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"description"?: string,"end_date": string,"financial_state"?: string,"id"?: string,"legal_hold"?: boolean,"name": string,"retain_until"?: string | null,"start_date": string,"status"?: Database["public"]['Enums']["activity_status"],"type": Database["public"]['Enums']["activity_type"],"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"archived_by"?: string | null,"budget_sen"?: number,"closing_revision"?: number,"club_id"?: string,"created_at"?: string,"currency"?: Database["public"]['Enums']["currency_code"],"description"?: string,"end_date"?: string,"financial_state"?: string,"id"?: string,"legal_hold"?: boolean,"name"?: string,"retain_until"?: string | null,"start_date"?: string,"status"?: Database["public"]['Enums']["activity_status"],"type"?: Database["public"]['Enums']["activity_type"],"updated_at"?: string
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
                },"activity_closing_decisions": {
                  Row: {
                    "approved": boolean,"closing_revision": number,"decided_at": string,"decided_by": string,"decided_name": string,"id": string,"reason": string,"reconciliation_id": string,"request_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approved": boolean,"closing_revision": number,"decided_at"?: string,"decided_by": string,"decided_name": string,"id"?: string,"reason": string,"reconciliation_id": string,"request_key": string
                  }
                  Update: {
                    "approved"?: boolean,"closing_revision"?: number,"decided_at"?: string,"decided_by"?: string,"decided_name"?: string,"id"?: string,"reason"?: string,"reconciliation_id"?: string,"request_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_closing_decisions_reconciliation_id_fkey"
      columns: ["reconciliation_id"]
isOneToOne: true
      referencedRelation: "activity_reconciliations"
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
                },"activity_reconciliations": {
                  Row: {
                    "activity_id": string,"closing_revision": number,"facts": NonNullable<Json>,"id": string,"request_key": string,"signed_at": string,"signed_by": string,"signed_name": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"closing_revision": number,"facts": NonNullable<Json>,"id"?: string,"request_key": string,"signed_at"?: string,"signed_by": string,"signed_name": string,"version": number
                  }
                  Update: {
                    "activity_id"?: string,"closing_revision"?: number,"facts"?: NonNullable<Json>,"id"?: string,"request_key"?: string,"signed_at"?: string,"signed_by"?: string,"signed_name"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_reconciliations_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
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
                    "activity_id": string | null,"approval_id": string | null,"archive_state": string,"archived_at": string,"archived_by": string | null,"checked_at": string | null,"club_id": string,"compressed_bytes": number | null,"compressed_sha256": string | null,"created_at": string,"department_id": string | null,"entity_id": string,"entity_type": string,"evidence_bytes": number | null,"failure_code": string | null,"format_version": number | null,"id": string,"legal_hold": boolean,"logical_bytes": number | null,"logical_sha256": string | null,"object_path": string | null,"reconciliation_id": string | null,"recovery_checked_at": string | null,"recovery_report": Json | null,"retain_until": string | null,"retention_policy": Json | null,"source_revision": number | null,"source_text": string | null,"verification_state": string,"verified_evidence_count": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id"?: string | null,"approval_id"?: string | null,"archive_state"?: string,"archived_at"?: string,"archived_by"?: string | null,"checked_at"?: string | null,"club_id": string,"compressed_bytes"?: number | null,"compressed_sha256"?: string | null,"created_at"?: string,"department_id"?: string | null,"entity_id": string,"entity_type": string,"evidence_bytes"?: number | null,"failure_code"?: string | null,"format_version"?: number | null,"id"?: string,"legal_hold"?: boolean,"logical_bytes"?: number | null,"logical_sha256"?: string | null,"object_path"?: string | null,"reconciliation_id"?: string | null,"recovery_checked_at"?: string | null,"recovery_report"?: Json | null,"retain_until"?: string | null,"retention_policy"?: Json | null,"source_revision"?: number | null,"source_text"?: string | null,"verification_state"?: string,"verified_evidence_count"?: number | null
                  }
                  Update: {
                    "activity_id"?: string | null,"approval_id"?: string | null,"archive_state"?: string,"archived_at"?: string,"archived_by"?: string | null,"checked_at"?: string | null,"club_id"?: string,"compressed_bytes"?: number | null,"compressed_sha256"?: string | null,"created_at"?: string,"department_id"?: string | null,"entity_id"?: string,"entity_type"?: string,"evidence_bytes"?: number | null,"failure_code"?: string | null,"format_version"?: number | null,"id"?: string,"legal_hold"?: boolean,"logical_bytes"?: number | null,"logical_sha256"?: string | null,"object_path"?: string | null,"reconciliation_id"?: string | null,"recovery_checked_at"?: string | null,"recovery_report"?: Json | null,"retain_until"?: string | null,"retention_policy"?: Json | null,"source_revision"?: number | null,"source_text"?: string | null,"verification_state"?: string,"verified_evidence_count"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "archive_records_activity_id_club_id_fkey"
      columns: ["activity_id","club_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id","club_id"]
    },{
      foreignKeyName: "archive_records_approval_id_fkey"
      columns: ["approval_id"]
isOneToOne: false
      referencedRelation: "activity_closing_decisions"
      referencedColumns: ["id"]
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
    },{
      foreignKeyName: "archive_records_reconciliation_id_fkey"
      columns: ["reconciliation_id"]
isOneToOne: false
      referencedRelation: "activity_reconciliations"
      referencedColumns: ["id"]
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
                },"claim_items": {
                  Row: {
                    "claim_id": string,"corrected_description": string,"corrected_line_total_sen": number,"corrected_quantity_milli": number | null,"corrected_unit_price_sen": number | null,"created_at": string,"exclusion_reason": string,"id": string,"included": boolean,"line_kind": string,"original_description": string,"original_line_total_sen": number,"original_ocr_reference": string | null,"original_quantity_milli": number | null,"original_unit_price_sen": number | null,"receipt_id": string,"revision": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claim_id": string,"corrected_description": string,"corrected_line_total_sen": number,"corrected_quantity_milli"?: number | null,"corrected_unit_price_sen"?: number | null,"created_at"?: string,"exclusion_reason"?: string,"id"?: string,"included"?: boolean,"line_kind"?: string,"original_description": string,"original_line_total_sen": number,"original_ocr_reference"?: string | null,"original_quantity_milli"?: number | null,"original_unit_price_sen"?: number | null,"receipt_id": string,"revision"?: number,"updated_at"?: string
                  }
                  Update: {
                    "claim_id"?: string,"corrected_description"?: string,"corrected_line_total_sen"?: number,"corrected_quantity_milli"?: number | null,"corrected_unit_price_sen"?: number | null,"created_at"?: string,"exclusion_reason"?: string,"id"?: string,"included"?: boolean,"line_kind"?: string,"original_description"?: string,"original_line_total_sen"?: number,"original_ocr_reference"?: string | null,"original_quantity_milli"?: number | null,"original_unit_price_sen"?: number | null,"receipt_id"?: string,"revision"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "claim_items_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: false
      referencedRelation: "claims"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_items_receipt_id_claim_id_fkey"
      columns: ["receipt_id","claim_id"]
isOneToOne: false
      referencedRelation: "claim_receipts"
      referencedColumns: ["id","claim_id"]
    }
                  ]
                },"claim_payment_destinations": {
                  Row: {
                    "account_id": string | null,"claim_id": string,"holder": string,"identifier": string,"institution": string,"kind": string,"label": string,"masked": string,"owner_uid": string,"selected_at": string,"selected_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id"?: string | null,"claim_id": string,"holder": string,"identifier": string,"institution": string,"kind": string,"label": string,"masked": string,"owner_uid": string,"selected_at"?: string,"selected_by": string
                  }
                  Update: {
                    "account_id"?: string | null,"claim_id"?: string,"holder"?: string,"identifier"?: string,"institution"?: string,"kind"?: string,"label"?: string,"masked"?: string,"owner_uid"?: string,"selected_at"?: string,"selected_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "claim_payment_destinations_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "payment_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_payment_destinations_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: true
      referencedRelation: "claims"
      referencedColumns: ["id"]
    }
                  ]
                },"claim_pressure_advice": {
                  Row: {
                    "actor_uid": string,"claim_id": string,"claim_revision": number,"contributions": NonNullable<Json>,"created_at": string,"experimental": boolean,"feature_hash": string,"feature_schema": string,"feature_snapshot": NonNullable<Json>,"id": string,"model_version": string,"provenance": string,"score": number
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_uid": string,"claim_id": string,"claim_revision": number,"contributions": NonNullable<Json>,"created_at"?: string,"experimental"?: boolean,"feature_hash": string,"feature_schema"?: string,"feature_snapshot": NonNullable<Json>,"id"?: string,"model_version": string,"provenance"?: string,"score": number
                  }
                  Update: {
                    "actor_uid"?: string,"claim_id"?: string,"claim_revision"?: number,"contributions"?: NonNullable<Json>,"created_at"?: string,"experimental"?: boolean,"feature_hash"?: string,"feature_schema"?: string,"feature_snapshot"?: NonNullable<Json>,"id"?: string,"model_version"?: string,"provenance"?: string,"score"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "claim_pressure_advice_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: false
      referencedRelation: "claims"
      referencedColumns: ["id"]
    }
                  ]
                },"claim_receipts": {
                  Row: {
                    "claim_id": string,"created_at": string,"extraction": Json | null,"id": string,"is_current": boolean,"merchant": string | null,"mime_type": string,"ocr_engine": string | null,"ocr_status": string,"ocr_version": string | null,"original_filename": string,"original_total_sen": number | null,"purchase_date": string | null,"reviewed_total_sen": number | null,"sha256": string | null,"size_bytes": number | null,"storage_path": string,"upload_status": Database["public"]['Enums']["receipt_upload_status"],"uploaded_at": string | null,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claim_id": string,"created_at"?: string,"extraction"?: Json | null,"id"?: string,"is_current"?: boolean,"merchant"?: string | null,"mime_type": string,"ocr_engine"?: string | null,"ocr_status"?: string,"ocr_version"?: string | null,"original_filename": string,"original_total_sen"?: number | null,"purchase_date"?: string | null,"reviewed_total_sen"?: number | null,"sha256"?: string | null,"size_bytes"?: number | null,"storage_path": string,"upload_status"?: Database["public"]['Enums']["receipt_upload_status"],"uploaded_at"?: string | null,"uploaded_by": string
                  }
                  Update: {
                    "claim_id"?: string,"created_at"?: string,"extraction"?: Json | null,"id"?: string,"is_current"?: boolean,"merchant"?: string | null,"mime_type"?: string,"ocr_engine"?: string | null,"ocr_status"?: string,"ocr_version"?: string | null,"original_filename"?: string,"original_total_sen"?: number | null,"purchase_date"?: string | null,"reviewed_total_sen"?: number | null,"sha256"?: string | null,"size_bytes"?: number | null,"storage_path"?: string,"upload_status"?: Database["public"]['Enums']["receipt_upload_status"],"uploaded_at"?: string | null,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "claim_receipts_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: false
      referencedRelation: "claims"
      referencedColumns: ["id"]
    }
                  ]
                },"claim_status_history": {
                  Row: {
                    "actor_uid": string,"claim_id": string,"created_at": string,"detail": NonNullable<Json>,"from_status": Database["public"]['Enums']["claim_status"] | null,"id": string,"to_status": Database["public"]['Enums']["claim_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_uid": string,"claim_id": string,"created_at"?: string,"detail"?: NonNullable<Json>,"from_status"?: Database["public"]['Enums']["claim_status"] | null,"id"?: string,"to_status": Database["public"]['Enums']["claim_status"]
                  }
                  Update: {
                    "actor_uid"?: string,"claim_id"?: string,"created_at"?: string,"detail"?: NonNullable<Json>,"from_status"?: Database["public"]['Enums']["claim_status"] | null,"id"?: string,"to_status"?: Database["public"]['Enums']["claim_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "claim_status_history_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: false
      referencedRelation: "claims"
      referencedColumns: ["id"]
    }
                  ]
                },"claims": {
                  Row: {
                    "activity_id": string,"approved_amount_sen": number | null,"claimant_user_id": string,"claimed_amount_sen": number | null,"club_id": string,"created_at": string,"decided_at": string | null,"decision_reason": string,"decision_risk": Json | null,"department_id": string,"draft_payment_account_id": string | null,"extracted_items_total_sen": number | null,"id": string,"idempotency_key": string,"item_budget_sen_snapshot": number,"original_receipt_total_sen": number | null,"over_budget_amount_sen": number,"over_budget_justification": string,"purchase_task_id": string,"review_started_at": string | null,"reviewer_uid": string | null,"revision": number,"risk_assessment": Json | null,"status": Database["public"]['Enums']["claim_status"],"submission_key": string | null,"submitted_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"approved_amount_sen"?: number | null,"claimant_user_id": string,"claimed_amount_sen"?: number | null,"club_id": string,"created_at"?: string,"decided_at"?: string | null,"decision_reason"?: string,"decision_risk"?: Json | null,"department_id": string,"draft_payment_account_id"?: string | null,"extracted_items_total_sen"?: number | null,"id"?: string,"idempotency_key": string,"item_budget_sen_snapshot": number,"original_receipt_total_sen"?: number | null,"over_budget_amount_sen"?: number,"over_budget_justification"?: string,"purchase_task_id": string,"review_started_at"?: string | null,"reviewer_uid"?: string | null,"revision"?: number,"risk_assessment"?: Json | null,"status"?: Database["public"]['Enums']["claim_status"],"submission_key"?: string | null,"submitted_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "activity_id"?: string,"approved_amount_sen"?: number | null,"claimant_user_id"?: string,"claimed_amount_sen"?: number | null,"club_id"?: string,"created_at"?: string,"decided_at"?: string | null,"decision_reason"?: string,"decision_risk"?: Json | null,"department_id"?: string,"draft_payment_account_id"?: string | null,"extracted_items_total_sen"?: number | null,"id"?: string,"idempotency_key"?: string,"item_budget_sen_snapshot"?: number,"original_receipt_total_sen"?: number | null,"over_budget_amount_sen"?: number,"over_budget_justification"?: string,"purchase_task_id"?: string,"review_started_at"?: string | null,"reviewer_uid"?: string | null,"revision"?: number,"risk_assessment"?: Json | null,"status"?: Database["public"]['Enums']["claim_status"],"submission_key"?: string | null,"submitted_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "claims_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claims_draft_payment_account_id_fkey"
      columns: ["draft_payment_account_id"]
isOneToOne: false
      referencedRelation: "payment_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claims_purchase_task_id_activity_id_department_id_club_id_fkey"
      columns: ["purchase_task_id","activity_id","department_id","club_id"]
isOneToOne: false
      referencedRelation: "purchase_tasks"
      referencedColumns: ["id","activity_id","department_id","club_id"]
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
                },"financial_notifications": {
                  Row: {
                    "claim_id": string,"created_at": string,"detail": string,"id": string,"read_at": string | null,"recipient_uid": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claim_id": string,"created_at"?: string,"detail": string,"id"?: string,"read_at"?: string | null,"recipient_uid": string,"title": string
                  }
                  Update: {
                    "claim_id"?: string,"created_at"?: string,"detail"?: string,"id"?: string,"read_at"?: string | null,"recipient_uid"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "financial_notifications_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: false
      referencedRelation: "claims"
      referencedColumns: ["id"]
    }
                  ]
                },"financial_requests": {
                  Row: {
                    "action": string,"actor_uid": string,"claim_id": string,"created_at": string,"id": string,"payload": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_uid": string,"claim_id": string,"created_at"?: string,"id": string,"payload": NonNullable<Json>
                  }
                  Update: {
                    "action"?: string,"actor_uid"?: string,"claim_id"?: string,"created_at"?: string,"id"?: string,"payload"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "financial_requests_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: false
      referencedRelation: "claims"
      referencedColumns: ["id"]
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
                },"payment_accounts": {
                  Row: {
                    "club_id": string,"created_at": string,"holder": string,"id": string,"identifier": string,"institution": string,"is_default": boolean,"kind": string,"label": string,"masked": string,"owner_uid": string,"revision": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"holder": string,"id"?: string,"identifier": string,"institution": string,"is_default"?: boolean,"kind": string,"label": string,"masked": string,"owner_uid": string,"revision"?: number,"updated_at"?: string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"holder"?: string,"id"?: string,"identifier"?: string,"institution"?: string,"is_default"?: boolean,"kind"?: string,"label"?: string,"masked"?: string,"owner_uid"?: string,"revision"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_accounts_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_accounts_member_fk"
      columns: ["club_id","owner_uid"]
isOneToOne: false
      referencedRelation: "club_memberships"
      referencedColumns: ["club_id","user_id"]
    }
                  ]
                },"payment_proofs": {
                  Row: {
                    "claim_id": string,"created_at": string,"filename": string,"finalized_at": string | null,"id": string,"mime_type": string,"sha256": string,"size_bytes": number,"storage_path": string,"upload_status": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claim_id": string,"created_at"?: string,"filename": string,"finalized_at"?: string | null,"id"?: string,"mime_type": string,"sha256": string,"size_bytes": number,"storage_path": string,"upload_status"?: string,"uploaded_by": string
                  }
                  Update: {
                    "claim_id"?: string,"created_at"?: string,"filename"?: string,"finalized_at"?: string | null,"id"?: string,"mime_type"?: string,"sha256"?: string,"size_bytes"?: number,"storage_path"?: string,"upload_status"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_proofs_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: false
      referencedRelation: "claims"
      referencedColumns: ["id"]
    }
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
                },"purchase_tasks": {
                  Row: {
                    "activity_id": string,"assigned_member_id": string,"closing_resolution": Json | null,"club_id": string,"completed_at": string | null,"created_at": string,"created_by_hod": string,"department_id": string,"description": string,"due_date": string,"estimated_budget_sen": number,"id": string,"item_name": string,"priority": Database["public"]['Enums']["purchase_priority"],"request_key": string,"status": Database["public"]['Enums']["purchase_task_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"assigned_member_id": string,"closing_resolution"?: Json | null,"club_id": string,"completed_at"?: string | null,"created_at"?: string,"created_by_hod": string,"department_id": string,"description": string,"due_date": string,"estimated_budget_sen": number,"id"?: string,"item_name": string,"priority"?: Database["public"]['Enums']["purchase_priority"],"request_key": string,"status"?: Database["public"]['Enums']["purchase_task_status"],"updated_at"?: string
                  }
                  Update: {
                    "activity_id"?: string,"assigned_member_id"?: string,"closing_resolution"?: Json | null,"club_id"?: string,"completed_at"?: string | null,"created_at"?: string,"created_by_hod"?: string,"department_id"?: string,"description"?: string,"due_date"?: string,"estimated_budget_sen"?: number,"id"?: string,"item_name"?: string,"priority"?: Database["public"]['Enums']["purchase_priority"],"request_key"?: string,"status"?: Database["public"]['Enums']["purchase_task_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_tasks_activity_id_club_id_fkey"
      columns: ["activity_id","club_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id","club_id"]
    },{
      foreignKeyName: "purchase_tasks_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_tasks_department_id_activity_id_club_id_assigned__fkey"
      columns: ["department_id","activity_id","club_id","assigned_member_id"]
isOneToOne: false
      referencedRelation: "department_memberships"
      referencedColumns: ["department_id","activity_id","club_id","user_id"]
    },{
      foreignKeyName: "purchase_tasks_department_id_activity_id_club_id_fkey"
      columns: ["department_id","activity_id","club_id"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id","activity_id","club_id"]
    }
                  ]
                },"receipt_modifications": {
                  Row: {
                    "after_value": NonNullable<Json>,"before_value": NonNullable<Json>,"claim_id": string,"claim_item_id": string | null,"created_at": string,"field_changed": string,"id": string,"modification_type": Database["public"]['Enums']["receipt_modification_type"],"modified_by": string,"reason": string,"receipt_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "after_value": NonNullable<Json>,"before_value": NonNullable<Json>,"claim_id": string,"claim_item_id"?: string | null,"created_at"?: string,"field_changed": string,"id"?: string,"modification_type": Database["public"]['Enums']["receipt_modification_type"],"modified_by": string,"reason": string,"receipt_id": string
                  }
                  Update: {
                    "after_value"?: NonNullable<Json>,"before_value"?: NonNullable<Json>,"claim_id"?: string,"claim_item_id"?: string | null,"created_at"?: string,"field_changed"?: string,"id"?: string,"modification_type"?: Database["public"]['Enums']["receipt_modification_type"],"modified_by"?: string,"reason"?: string,"receipt_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "receipt_modifications_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: false
      referencedRelation: "claims"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "receipt_modifications_claim_item_id_fkey"
      columns: ["claim_item_id"]
isOneToOne: false
      referencedRelation: "claim_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "receipt_modifications_receipt_id_fkey"
      columns: ["receipt_id"]
isOneToOne: false
      referencedRelation: "claim_receipts"
      referencedColumns: ["id"]
    }
                  ]
                },"reimbursement_payments": {
                  Row: {
                    "amount_sen": number,"approved_amount_sen": number,"claim_id": string,"discrepancy_amount_sen": number | null,"discrepancy_at": string | null,"discrepancy_reason": string | null,"id": string,"payment_date": string,"proof_id": string,"received_at": string | null,"received_by": string | null,"recorded_at": string,"recorded_by": string,"reference": string,"request_key": string,"resolution_note": string | null,"resolved_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_sen": number,"approved_amount_sen": number,"claim_id": string,"discrepancy_amount_sen"?: number | null,"discrepancy_at"?: string | null,"discrepancy_reason"?: string | null,"id"?: string,"payment_date": string,"proof_id": string,"received_at"?: string | null,"received_by"?: string | null,"recorded_at"?: string,"recorded_by": string,"reference": string,"request_key": string,"resolution_note"?: string | null,"resolved_at"?: string | null
                  }
                  Update: {
                    "amount_sen"?: number,"approved_amount_sen"?: number,"claim_id"?: string,"discrepancy_amount_sen"?: number | null,"discrepancy_at"?: string | null,"discrepancy_reason"?: string | null,"id"?: string,"payment_date"?: string,"proof_id"?: string,"received_at"?: string | null,"received_by"?: string | null,"recorded_at"?: string,"recorded_by"?: string,"reference"?: string,"request_key"?: string,"resolution_note"?: string | null,"resolved_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reimbursement_payments_claim_id_fkey"
      columns: ["claim_id"]
isOneToOne: true
      referencedRelation: "claims"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reimbursement_payments_proof_id_claim_id_fkey"
      columns: ["proof_id","claim_id"]
isOneToOne: false
      referencedRelation: "payment_proofs"
      referencedColumns: ["id","claim_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "abandon_closing_proof":
{ Args: { "p_activity": string,"p_proof": string,"p_reason": string }; Returns: undefined
                           },
"abandon_my_claim_receipt":
{ Args: { "p_receipt_id": string }; Returns: string
                           },
"abandon_payment_proof":
{ Args: { "p_proof_id": string }; Returns: string
                           },
"accept_club_invitation":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"activity_archive_material":
{ Args: { "p_archive": string }; Returns: Json
                           },
"activity_closing_readiness":
{ Args: { "p_activity": string,"p_role": string }; Returns: Json
                           },
"activity_closing_report":
{ Args: { "p_activity": string,"p_role": string }; Returns: Json
                           },
"activity_staged_proofs":
{ Args: { "p_activity": string }; Returns: {
              "created_at": string,"filename": string,"id": string,"size_bytes": number
            }[]
                           },
"assess_claim_risk":
{ Args: { "p_claim_id": string }; Returns: Json
                           },
"assistant_context":
{ Args: { "p_kind": string,"p_record"?: string,"p_role": string }; Returns: Json
                           },
"authorize_activity_archive":
{ Args: { "p_activity": string,"p_download": boolean,"p_role": string }; Returns: string
                           },
"begin_my_claim":
{ Args: { "p_request_key": string,"p_task_id": string }; Returns: string
                           },
"claim_pressure_snapshot":
{ Args: { "p_claim_id": string }; Returns: Json
                           },
"correct_my_claim_receipt_total":
{ Args: { "p_claim_id": string,"p_expected_updated_at": string,"p_reason": string,"p_total_sen": number }; Returns: string
                           },
"current_club_session":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"decide_activity_reconciliation":
{ Args: { "p_activity": string,"p_approved": boolean,"p_reason": string,"p_reconciliation": string,"p_request_key": string,"p_revision": number }; Returns: string
                           },
"edit_my_claim_item":
{ Args: { "p_claim_id": string,"p_excluded": boolean,"p_expected_updated_at": string,"p_item_id": string,"p_line": Json,"p_modification_type": Database["public"]['Enums']["receipt_modification_type"],"p_reason": string }; Returns: string
                           },
"finalize_activity_archive":
{ Args: { "p_actor": string,"p_archive": string,"p_compressed_bytes": number,"p_compressed_sha": string,"p_evidence_bytes": number,"p_evidence_count": number,"p_logical_sha": string,"p_revision": number }; Returns: undefined
                           },
"finalize_activity_archive_object":
{ Args: { "p_actor": string,"p_archive": string,"p_compressed_bytes": number,"p_compressed_sha": string,"p_evidence_bytes": number,"p_evidence_count": number,"p_logical_sha": string,"p_object_path": string,"p_revision": number }; Returns: undefined
                           },
"finalize_claim_receipt":
{ Args: { "p_receipt_id": string }; Returns: string
                           },
"finalize_payment_proof":
{ Args: { "p_proof_id": string }; Returns: string
                           },
"financial_summaries":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_my_payment_account":
{ Args: { "p_account_id": string }; Returns: {
              "holder": string,"id": string,"identifier": string,"institution": string,"is_default": boolean,"kind": string,"label": string,"revision": number,"updated_at": string
            }[]
                           },
"list_my_payment_accounts":
{ Args: Record<PropertyKey, never>; Returns: {
              "holder": string,"id": string,"in_use": boolean,"institution": string,"is_default": boolean,"kind": string,"label": string,"masked": string,"revision": number,"updated_at": string
            }[]
                           },
"my_claim_destination":
{ Args: { "p_claim_id": string }; Returns: {
              "holder": string,"institution": string,"kind": string,"label": string,"masked": string,"selected_at": string
            }[]
                           },
"payment_instructions":
{ Args: { "p_claim_id": string }; Returns: {
              "claim_id": string,"holder": string,"identifier": string,"institution": string,"kind": string,"label": string,"masked": string,"revision": string
            }[]
                           },
"prepare_claim_receipt":
{ Args: { "p_claim_id": string,"p_expected_updated_at": string,"p_filename": string,"p_mime": string,"p_sha256": string,"p_size": number }; Returns: {
              "draft_updated_at": string,"receipt_id": string,"storage_path": string
            }[]
                           },
"prepare_payment_proof":
{ Args: { "p_claim_id": string,"p_filename": string,"p_mime": string,"p_sha256": string,"p_size": number }; Returns: {
              "claim_id": string,
"created_at": string,
"filename": string,
"finalized_at": string | null,
"id": string,
"mime_type": string,
"sha256": string,
"size_bytes": number,
"storage_path": string,
"upload_status": string,
"uploaded_by": string
            }
                          SetofOptions: {
        from: "*"
        to: "payment_proofs"
        isOneToOne: true
        isSetofReturn: false
      } },
"preview_activity_archive_cleanup":
{ Args: { "p_activity": string }; Returns: Json
                           },
"read_financial_notification":
{ Args: { "p_notification_id": string }; Returns: undefined
                           },
"record_activity_archive_check":
{ Args: { "p_actor": string,"p_archive": string,"p_compressed_sha": string,"p_failure": string,"p_operation": string,"p_role": string }; Returns: undefined
                           },
"record_activity_archive_recovery":
{ Args: { "p_actor": string,"p_archive": string,"p_compressed_sha": string,"p_evidence_count": number,"p_milliseconds": number,"p_rows": number }; Returns: undefined
                           },
"record_reimbursement":
{ Args: { "p_amount_sen": number,"p_claim_id": string,"p_confirmed": boolean,"p_destination_revision": string,"p_expected_updated_at": string,"p_payment_date": string,"p_proof_id": string,"p_reference": string,"p_request_key": string }; Returns: string
                           },
"recorded_payment_destinations":
{ Args: Record<PropertyKey, never>; Returns: {
              "claim_id": string,"holder": string,"institution": string,"kind": string,"label": string,"masked": string
            }[]
                           },
"remove_my_payment_account":
{ Args: { "p_account_id": string }; Returns: undefined
                           },
"reopen_activity_closing":
{ Args: { "p_activity": string,"p_reason": string,"p_revision": number }; Returns: undefined
                           },
"replace_corrupt_archive_stage":
{ Args: { "p_actor": string,"p_archive": string,"p_expected_path": string }; Returns: string
                           },
"report_payment_issue":
{ Args: { "p_payment_id": string,"p_reason": string,"p_received_sen"?: number,"p_request_key": string }; Returns: undefined
                           },
"request_activity_close":
{ Args: { "p_activity": string }; Returns: number
                           },
"reserve_activity_archive":
{ Args: { "p_activity": string }; Returns: string
                           },
"resolve_closing_purchase":
{ Args: { "p_reason": string,"p_task": string }; Returns: undefined
                           },
"resolve_payment_issue":
{ Args: { "p_note": string,"p_payment_id": string,"p_request_key": string }; Returns: undefined
                           },
"retain_claim_pressure_advice":
{ Args: { "p_claim_id": string,"p_contributions": Json,"p_expected_updated_at": string,"p_model_version": string,"p_raw": Json,"p_score": number }; Returns: string
                           },
"save_activity":
{ Args: { "p_budget_sen": number,"p_description": string,"p_end_date": string,"p_id": string,"p_name": string,"p_start_date": string,"p_status": Database["public"]['Enums']["activity_status"],"p_type": Database["public"]['Enums']["activity_type"] }; Returns: {
              "archived_at": string | null,
"archived_by": string | null,
"budget_sen": number,
"closing_revision": number,
"club_id": string,
"created_at": string,
"currency": Database["public"]['Enums']["currency_code"],
"description": string,
"end_date": string,
"financial_state": string,
"id": string,
"legal_hold": boolean,
"name": string,
"retain_until": string | null,
"start_date": string,
"status": Database["public"]['Enums']["activity_status"],
"type": Database["public"]['Enums']["activity_type"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "activities"
        isOneToOne: true
        isSetofReturn: false
      } },
"save_department_setup":
{ Args: { "p_activity_id": string,"p_allocation_sen": number,"p_department_id": string,"p_description": string,"p_head_label": string,"p_hod_user_id": string,"p_member_user_ids": (string)[],"p_name": string }; Returns: string
                           },
"save_my_claim_baseline":
{ Args: { "p_claim_id": string,"p_expected_updated_at": string,"p_lines": Json,"p_merchant": string,"p_method": string,"p_purchase_date": string,"p_raw_text": string,"p_receipt_id": string,"p_total_sen": number }; Returns: string
                           },
"save_my_claim_preferences":
{ Args: { "p_account_id": string,"p_claim_id": string,"p_expected_updated_at": string,"p_justification": string }; Returns: string
                           },
"save_my_payment_account":
{ Args: { "p_account_id": string,"p_expected_updated_at": string,"p_holder": string,"p_identifier": string,"p_institution": string,"p_is_default": boolean,"p_kind": string,"p_label": string }; Returns: string
                           },
"save_purchase_task":
{ Args: { "p_activity_id": string,"p_assigned_member_id": string,"p_department_id": string,"p_description": string,"p_due_date": string,"p_estimated_budget_sen": number,"p_expected_updated_at": string,"p_id": string,"p_item_name": string,"p_priority": Database["public"]['Enums']["purchase_priority"],"p_request_key": string }; Returns: {
              "activity_id": string,
"assigned_member_id": string,
"closing_resolution": Json | null,
"club_id": string,
"completed_at": string | null,
"created_at": string,
"created_by_hod": string,
"department_id": string,
"description": string,
"due_date": string,
"estimated_budget_sen": number,
"id": string,
"item_name": string,
"priority": Database["public"]['Enums']["purchase_priority"],
"request_key": string,
"status": Database["public"]['Enums']["purchase_task_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "purchase_tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_activity_archive_retention":
{ Args: { "p_activity": string,"p_days": number,"p_hold": boolean,"p_policy": string }; Returns: undefined
                           },
"set_my_payment_account_default":
{ Args: { "p_account_id": string }; Returns: undefined
                           },
"sign_activity_reconciliation":
{ Args: { "p_activity": string,"p_request_key": string,"p_revision": number }; Returns: string
                           },
"submit_my_claim":
{ Args: { "p_account_updated_at": string,"p_claim_id": string,"p_expected_updated_at": string,"p_submission_key": string,"p_task_updated_at": string }; Returns: string
                           },
"transition_claim":
{ Args: { "p_claim_id": string,"p_expected_updated_at": string,"p_reason"?: string,"p_request_key": string,"p_target": Database["public"]['Enums']["claim_status"] }; Returns: string
                           },
"update_hod_purchase_task_status":
{ Args: { "p_expected_updated_at": string,"p_status": Database["public"]['Enums']["purchase_task_status"],"p_task_id": string }; Returns: {
              "activity_id": string,
"assigned_member_id": string,
"closing_resolution": Json | null,
"club_id": string,
"completed_at": string | null,
"created_at": string,
"created_by_hod": string,
"department_id": string,
"description": string,
"due_date": string,
"estimated_budget_sen": number,
"id": string,
"item_name": string,
"priority": Database["public"]['Enums']["purchase_priority"],
"request_key": string,
"status": Database["public"]['Enums']["purchase_task_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "purchase_tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"update_my_purchase_progress":
{ Args: { "p_expected_updated_at": string,"p_status": Database["public"]['Enums']["purchase_task_status"],"p_task_id": string }; Returns: {
              "activity_id": string,
"assigned_member_id": string,
"closing_resolution": Json | null,
"club_id": string,
"completed_at": string | null,
"created_at": string,
"created_by_hod": string,
"department_id": string,
"description": string,
"due_date": string,
"estimated_budget_sen": number,
"id": string,
"item_name": string,
"priority": Database["public"]['Enums']["purchase_priority"],
"request_key": string,
"status": Database["public"]['Enums']["purchase_task_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "purchase_tasks"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "activity_role": "Treasurer","activity_status": "Planning"|"Active"|"Completed","activity_type": "Workshop"|"Large-scale event"|"Community"|"Other"|"Small Event","claim_status": "Draft"|"Pending"|"Under Review"|"Approved"|"Rejected"|"Payment Pending"|"Paid"|"Received","club_role": "Director"|"Treasurer","currency_code": "MYR"|"SGD"|"USD","department_role": "HOD"|"Member","purchase_priority": "Low"|"Medium"|"High","purchase_task_status": "Not Started"|"In Progress"|"Purchased"|"Completed"|"Cancelled","receipt_modification_type": "OCR Correction"|"Item Exclusion"|"Item Inclusion"|"Amount Adjustment"|"Description Correction","receipt_upload_status": "uploading"|"ready"|"abandoned"
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
            "activity_role": ["Treasurer"],"activity_status": ["Planning", "Active", "Completed"],"activity_type": ["Workshop", "Large-scale event", "Community", "Other", "Small Event"],"claim_status": ["Draft", "Pending", "Under Review", "Approved", "Rejected", "Payment Pending", "Paid", "Received"],"club_role": ["Director", "Treasurer"],"currency_code": ["MYR", "SGD", "USD"],"department_role": ["HOD", "Member"],"purchase_priority": ["Low", "Medium", "High"],"purchase_task_status": ["Not Started", "In Progress", "Purchased", "Completed", "Cancelled"],"receipt_modification_type": ["OCR Correction", "Item Exclusion", "Item Inclusion", "Amount Adjustment", "Description Correction"],"receipt_upload_status": ["uploading", "ready", "abandoned"]
          }
        }
} as const
