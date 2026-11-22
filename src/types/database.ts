
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
            "accounts": {
                  Row: {
                    "archived_at": string | null,"color": string,"created_at": string,"currency": string,"icon": string | null,"id": string,"is_spendable": boolean,"name": string,"opening_balance": number,"sort_order": number,"type": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"currency"?: string,"icon"?: string | null,"id"?: string,"is_spendable"?: boolean,"name": string,"opening_balance"?: number,"sort_order"?: number,"type": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"currency"?: string,"icon"?: string | null,"id"?: string,"is_spendable"?: boolean,"name"?: string,"opening_balance"?: number,"sort_order"?: number,"type"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"assessments": {
                  Row: {
                    "course_id": string,"created_at": string,"due_at": string | null,"id": string,"max_score": number,"name": string,"score": number | null,"updated_at": string,"user_id": string,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"due_at"?: string | null,"id"?: string,"max_score"?: number,"name": string,"score"?: number | null,"updated_at"?: string,"user_id"?: string,"weight": number
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"due_at"?: string | null,"id"?: string,"max_score"?: number,"name"?: string,"score"?: number | null,"updated_at"?: string,"user_id"?: string,"weight"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessments_course_fk"
      columns: ["course_id","user_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"attendance": {
                  Row: {
                    "change_id": string | null,"course_id": string,"created_at": string,"id": string,"meeting_number": number | null,"occurs_on": string | null,"slot_id": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "change_id"?: string | null,"course_id": string,"created_at"?: string,"id"?: string,"meeting_number"?: number | null,"occurs_on"?: string | null,"slot_id"?: string | null,"status": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "change_id"?: string | null,"course_id"?: string,"created_at"?: string,"id"?: string,"meeting_number"?: number | null,"occurs_on"?: string | null,"slot_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_change_fk"
      columns: ["change_id","course_id","user_id"]
isOneToOne: false
      referencedRelation: "class_changes"
      referencedColumns: ["id","course_id","user_id"]
    },{
      foreignKeyName: "attendance_course_fk"
      columns: ["course_id","user_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "attendance_slot_fk"
      columns: ["slot_id","course_id","user_id"]
isOneToOne: false
      referencedRelation: "timetable_slots"
      referencedColumns: ["id","course_id","user_id"]
    }
                  ]
                },"budgets": {
                  Row: {
                    "amount": number,"category_id": string,"category_kind": string,"created_at": string,"id": string,"month": string,"rollover": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category_id": string,"category_kind"?: string,"created_at"?: string,"id"?: string,"month": string,"rollover"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount"?: number,"category_id"?: string,"category_kind"?: string,"created_at"?: string,"id"?: string,"month"?: string,"rollover"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "budgets_category_fk"
      columns: ["category_id","user_id","category_kind"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id","kind"]
    }
                  ]
                },"categories": {
                  Row: {
                    "archived_at": string | null,"color": string,"created_at": string,"icon": string | null,"id": string,"kind": string,"name": string,"parent_id": string | null,"sort_order": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"icon"?: string | null,"id"?: string,"kind": string,"name": string,"parent_id"?: string | null,"sort_order"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"icon"?: string | null,"id"?: string,"kind"?: string,"name"?: string,"parent_id"?: string | null,"sort_order"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_fk"
      columns: ["parent_id","user_id","kind"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id","kind"]
    }
                  ]
                },"class_breaks": {
                  Row: {
                    "created_at": string,"ends_on": string,"id": string,"label": string,"starts_on": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_on": string,"id"?: string,"label": string,"starts_on": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"ends_on"?: string,"id"?: string,"label"?: string,"starts_on"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"class_changes": {
                  Row: {
                    "course_id": string,"created_at": string,"end_time": string | null,"id": string,"kind": string,"label": string | null,"location": string | null,"new_date": string | null,"note": string | null,"original_date": string | null,"slot_id": string | null,"start_time": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"end_time"?: string | null,"id"?: string,"kind": string,"label"?: string | null,"location"?: string | null,"new_date"?: string | null,"note"?: string | null,"original_date"?: string | null,"slot_id"?: string | null,"start_time"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"end_time"?: string | null,"id"?: string,"kind"?: string,"label"?: string | null,"location"?: string | null,"new_date"?: string | null,"note"?: string | null,"original_date"?: string | null,"slot_id"?: string | null,"start_time"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_changes_course_fk"
      columns: ["course_id","user_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "class_changes_slot_fk"
      columns: ["slot_id","course_id","user_id"]
isOneToOne: false
      referencedRelation: "timetable_slots"
      referencedColumns: ["id","course_id","user_id"]
    }
                  ]
                },"courses": {
                  Row: {
                    "archived_at": string | null,"class_type": string | null,"code": string | null,"color": string,"created_at": string,"credits": number,"id": string,"kind": string,"lecturer": string | null,"lecturer_email": string | null,"lecturer_phone": string | null,"meetings_counted_from": string | null,"name": string,"room": string | null,"semester": string | null,"total_meetings": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"class_type"?: string | null,"code"?: string | null,"color"?: string,"created_at"?: string,"credits"?: number,"id"?: string,"kind"?: string,"lecturer"?: string | null,"lecturer_email"?: string | null,"lecturer_phone"?: string | null,"meetings_counted_from"?: string | null,"name": string,"room"?: string | null,"semester"?: string | null,"total_meetings"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"class_type"?: string | null,"code"?: string | null,"color"?: string,"created_at"?: string,"credits"?: number,"id"?: string,"kind"?: string,"lecturer"?: string | null,"lecturer_email"?: string | null,"lecturer_phone"?: string | null,"meetings_counted_from"?: string | null,"name"?: string,"room"?: string | null,"semester"?: string | null,"total_meetings"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"goals": {
                  Row: {
                    "account_id": string,"account_type": string,"created_at": string,"id": string,"name": string,"target_amount": number,"target_on": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"account_type"?: string,"created_at"?: string,"id"?: string,"name": string,"target_amount": number,"target_on"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"account_type"?: string,"created_at"?: string,"id"?: string,"name"?: string,"target_amount"?: number,"target_on"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goals_account_fk"
      columns: ["account_id","user_id","account_type"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id","type"]
    }
                  ]
                },"import_batches": {
                  Row: {
                    "account_id": string,"created_at": string,"filename": string | null,"id": string,"row_count": number,"source": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at"?: string,"filename"?: string | null,"id"?: string,"row_count"?: number,"source"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"filename"?: string | null,"id"?: string,"row_count"?: number,"source"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_batches_account_fk"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "import_batches_account_fk"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"notification_log": {
                  Row: {
                    "channel": string,"created_at": string,"id": string,"kind": string,"ref_key": string,"sent_at": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel"?: string,"created_at"?: string,"id"?: string,"kind": string,"ref_key": string,"sent_at"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"ref_key"?: string,"sent_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"people": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"campus": string | null,"created_at": string,"display_name": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"campus"?: string | null,"created_at"?: string,"display_name"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"campus"?: string | null,"created_at"?: string,"display_name"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recurring_rules": {
                  Row: {
                    "account_id": string,"active": boolean,"amount": number,"cadence": string,"category_id": string | null,"create_task": boolean,"created_at": string,"due_day": number | null,"ends_on": string | null,"generated_through": string | null,"id": string,"instalments_total": number | null,"interval_count": number,"is_estimate": boolean,"kind": string,"name": string,"paused_until": string | null,"payee": string | null,"remind_days_before": number,"starts_on": string,"to_account_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"active"?: boolean,"amount": number,"cadence": string,"category_id"?: string | null,"create_task"?: boolean,"created_at"?: string,"due_day"?: number | null,"ends_on"?: string | null,"generated_through"?: string | null,"id"?: string,"instalments_total"?: number | null,"interval_count"?: number,"is_estimate"?: boolean,"kind": string,"name": string,"paused_until"?: string | null,"payee"?: string | null,"remind_days_before"?: number,"starts_on": string,"to_account_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"active"?: boolean,"amount"?: number,"cadence"?: string,"category_id"?: string | null,"create_task"?: boolean,"created_at"?: string,"due_day"?: number | null,"ends_on"?: string | null,"generated_through"?: string | null,"id"?: string,"instalments_total"?: number | null,"interval_count"?: number,"is_estimate"?: boolean,"kind"?: string,"name"?: string,"paused_until"?: string | null,"payee"?: string | null,"remind_days_before"?: number,"starts_on"?: string,"to_account_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_rules_account_fk"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "recurring_rules_account_fk"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "recurring_rules_category_fk"
      columns: ["category_id","user_id","kind"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id","kind"]
    },{
      foreignKeyName: "recurring_rules_to_account_fk"
      columns: ["to_account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "recurring_rules_to_account_fk"
      columns: ["to_account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "completed_at": string | null,"course_id": string | null,"created_at": string,"due_at": string | null,"due_has_time": boolean,"id": string,"notes": string | null,"parent_id": string | null,"position": number,"priority": string,"status": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"due_at"?: string | null,"due_has_time"?: boolean,"id"?: string,"notes"?: string | null,"parent_id"?: string | null,"position"?: number,"priority"?: string,"status"?: string,"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "completed_at"?: string | null,"course_id"?: string | null,"created_at"?: string,"due_at"?: string | null,"due_has_time"?: boolean,"id"?: string,"notes"?: string | null,"parent_id"?: string | null,"position"?: number,"priority"?: string,"status"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_course_fk"
      columns: ["course_id","user_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "tasks_parent_fk"
      columns: ["parent_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"timetable_slots": {
                  Row: {
                    "course_id": string,"created_at": string,"end_time": string,"ends_on": string | null,"id": string,"is_online": boolean,"location": string | null,"meeting_url": string | null,"start_time": string,"starts_on": string | null,"updated_at": string,"user_id": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "course_id": string,"created_at"?: string,"end_time": string,"ends_on"?: string | null,"id"?: string,"is_online"?: boolean,"location"?: string | null,"meeting_url"?: string | null,"start_time": string,"starts_on"?: string | null,"updated_at"?: string,"user_id"?: string,"weekday": number
                  }
                  Update: {
                    "course_id"?: string,"created_at"?: string,"end_time"?: string,"ends_on"?: string | null,"id"?: string,"is_online"?: boolean,"location"?: string | null,"meeting_url"?: string | null,"start_time"?: string,"starts_on"?: string | null,"updated_at"?: string,"user_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "timetable_slots_course_fk"
      columns: ["course_id","user_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "account_id": string,"adjustment_direction": string | null,"amount": number,"category_id": string | null,"course_id": string | null,"created_at": string,"due_on": string | null,"fee_amount": number,"id": string,"import_batch_id": string | null,"import_key": string | null,"kind": string,"note": string | null,"occurred_on": string,"payee": string | null,"person_id": string | null,"recurring_rule_id": string | null,"status": string,"task_id": string | null,"to_account_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"adjustment_direction"?: string | null,"amount": number,"category_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"due_on"?: string | null,"fee_amount"?: number,"id"?: string,"import_batch_id"?: string | null,"import_key"?: string | null,"kind": string,"note"?: string | null,"occurred_on": string,"payee"?: string | null,"person_id"?: string | null,"recurring_rule_id"?: string | null,"status"?: string,"task_id"?: string | null,"to_account_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"adjustment_direction"?: string | null,"amount"?: number,"category_id"?: string | null,"course_id"?: string | null,"created_at"?: string,"due_on"?: string | null,"fee_amount"?: number,"id"?: string,"import_batch_id"?: string | null,"import_key"?: string | null,"kind"?: string,"note"?: string | null,"occurred_on"?: string,"payee"?: string | null,"person_id"?: string | null,"recurring_rule_id"?: string | null,"status"?: string,"task_id"?: string | null,"to_account_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_account_fk"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "transactions_account_fk"
      columns: ["account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_category_fk"
      columns: ["category_id","user_id","kind"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id","kind"]
    },{
      foreignKeyName: "transactions_course_fk"
      columns: ["course_id","user_id"]
isOneToOne: false
      referencedRelation: "courses"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_import_batch_fk"
      columns: ["import_batch_id","user_id"]
isOneToOne: false
      referencedRelation: "import_batches"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_person_fk"
      columns: ["person_id","user_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_person_fk"
      columns: ["person_id","user_id"]
isOneToOne: false
      referencedRelation: "person_balances"
      referencedColumns: ["person_id","user_id"]
    },{
      foreignKeyName: "transactions_recurring_rule_fk"
      columns: ["recurring_rule_id","user_id"]
isOneToOne: false
      referencedRelation: "recurring_rules"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_task_fk"
      columns: ["task_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "transactions_to_account_fk"
      columns: ["to_account_id","user_id"]
isOneToOne: false
      referencedRelation: "account_balances"
      referencedColumns: ["account_id","user_id"]
    },{
      foreignKeyName: "transactions_to_account_fk"
      columns: ["to_account_id","user_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"user_settings": {
                  Row: {
                    "created_at": string,"dashboard_layout": NonNullable<Json>,"preferences": NonNullable<Json>,"theme": NonNullable<Json>,"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dashboard_layout"?: NonNullable<Json>,"preferences"?: NonNullable<Json>,"theme"?: NonNullable<Json>,"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "created_at"?: string,"dashboard_layout"?: NonNullable<Json>,"preferences"?: NonNullable<Json>,"theme"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "account_balances": {
                  Row: {
                    "account_id": string,"balance": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"person_balances": {
                  Row: {
                    "balance": number | null,"person_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "adjust_account_balance":
{ Args: { "p_account_id": string,"p_note": string,"p_occurred_on": string,"p_real_balance": number }; Returns: boolean
                           },
"cleanup_bill_tasks":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"delete_all_finance_data":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"ensure_finance_defaults":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"generate_recurring_transactions":
{ Args: { "p_dates": (string)[],"p_expected_updated_at": string,"p_rule_id": string,"p_to": string }; Returns: number
                           },
"mark_attendance_batch":
{ Args: { "p_rows": Json,"p_status": string }; Returns: (string)[]
                           },
"match_account_balance":
{ Args: { "p_account_id": string,"p_real_balance": number }; Returns: undefined
                           },
"rollover_semester":
{ Args: { "p_archive_old": boolean,"p_copy_slots": boolean,"p_counted_from": string,"p_ends_on"?: string,"p_from"?: string,"p_starts_on"?: string,"p_to": string }; Returns: number
                           },
"set_current_meeting":
{ Args: { "p_course_id": string,"p_next": number }; Returns: undefined
                           },
"settle_person":
{ Args: { "p_account_id": string,"p_occurred_on": string,"p_person_id": string }; Returns: {
              "amount": string,"kind": string,"person_name": string
            }[]
                           },
"split_timetable_slot":
{ Args: { "p_end_time": string,"p_from": string,"p_location"?: string,"p_slot_id": string,"p_start_time": string,"p_weekday": number }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
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
            
          }
        }
} as const
