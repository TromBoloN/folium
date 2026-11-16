
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
                    "archived_at": string | null,"color": string,"created_at": string,"currency": string,"icon": string | null,"id": string,"name": string,"opening_balance": number,"sort_order": number,"type": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"currency"?: string,"icon"?: string | null,"id"?: string,"name": string,"opening_balance"?: number,"sort_order"?: number,"type": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"color"?: string,"created_at"?: string,"currency"?: string,"icon"?: string | null,"id"?: string,"name"?: string,"opening_balance"?: number,"sort_order"?: number,"type"?: string,"updated_at"?: string,"user_id"?: string
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
                    "change_id": string | null,"course_id": string,"created_at": string,"id": string,"occurs_on": string | null,"slot_id": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "change_id"?: string | null,"course_id": string,"created_at"?: string,"id"?: string,"occurs_on"?: string | null,"slot_id"?: string | null,"status": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "change_id"?: string | null,"course_id"?: string,"created_at"?: string,"id"?: string,"occurs_on"?: string | null,"slot_id"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
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
                    "archived_at": string | null,"code": string | null,"color": string,"created_at": string,"credits": number,"id": string,"lecturer": string | null,"lecturer_email": string | null,"lecturer_phone": string | null,"name": string,"room": string | null,"semester": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"code"?: string | null,"color"?: string,"created_at"?: string,"credits"?: number,"id"?: string,"lecturer"?: string | null,"lecturer_email"?: string | null,"lecturer_phone"?: string | null,"name": string,"room"?: string | null,"semester"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"code"?: string | null,"color"?: string,"created_at"?: string,"credits"?: number,"id"?: string,"lecturer"?: string | null,"lecturer_email"?: string | null,"lecturer_phone"?: string | null,"name"?: string,"room"?: string | null,"semester"?: string | null,"updated_at"?: string,"user_id"?: string
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
                    "account_id": string,"adjustment_direction": string | null,"amount": number,"category_id": string | null,"created_at": string,"fee_amount": number,"id": string,"kind": string,"note": string | null,"occurred_on": string,"payee": string | null,"status": string,"to_account_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"adjustment_direction"?: string | null,"amount": number,"category_id"?: string | null,"created_at"?: string,"fee_amount"?: number,"id"?: string,"kind": string,"note"?: string | null,"occurred_on": string,"payee"?: string | null,"status"?: string,"to_account_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "account_id"?: string,"adjustment_direction"?: string | null,"amount"?: number,"category_id"?: string | null,"created_at"?: string,"fee_amount"?: number,"id"?: string,"kind"?: string,"note"?: string | null,"occurred_on"?: string,"payee"?: string | null,"status"?: string,"to_account_id"?: string | null,"updated_at"?: string,"user_id"?: string
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
                }
          }
          Functions: {
            "ensure_finance_defaults":
{ Args: Record<PropertyKey, never>; Returns: undefined
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
