export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          checked_at: string
          course_id: string
          id: string
          is_demo: boolean
          session_id: string | null
          user_id: string
        }
        Insert: {
          checked_at?: string
          course_id: string
          id?: string
          is_demo?: boolean
          session_id?: string | null
          user_id: string
        }
        Update: {
          checked_at?: string
          course_id?: string
          id?: string
          is_demo?: boolean
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          cert_no: string
          course_id: string
          id: string
          issued_at: string
          score: number | null
          user_id: string
        }
        Insert: {
          cert_no: string
          course_id: string
          id?: string
          issued_at?: string
          score?: number | null
          user_id: string
        }
        Update: {
          cert_no?: string
          course_id?: string
          id?: string
          issued_at?: string
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_access: {
        Row: {
          course_id: string
          created_at: string
          id: string
          kind: string
          value: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          kind: string
          value: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          kind?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_access_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_activity_photos: {
        Row: {
          caption: string | null
          course_id: string
          created_at: string
          created_by: string | null
          id: string
          photo_url: string
          session_id: string | null
          sort_order: number
        }
        Insert: {
          caption?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          photo_url: string
          session_id?: string | null
          sort_order?: number
        }
        Update: {
          caption?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          photo_url?: string
          session_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_activity_photos_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_activity_photos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      course_documents: {
        Row: {
          amount: number | null
          category: string
          course_id: string
          created_at: string
          created_by: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          title: string
          visibility: string
        }
        Insert: {
          amount?: number | null
          category?: string
          course_id: string
          created_at?: string
          created_by?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          title: string
          visibility?: string
        }
        Update: {
          amount?: number | null
          category?: string
          course_id?: string
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_documents_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sessions: {
        Row: {
          capacity: number | null
          checkin_code: string
          course_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          ends_at: string | null
          id: string
          location: string
          round_no: number
          starts_at: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          capacity?: number | null
          checkin_code?: string
          course_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          ends_at?: string | null
          id?: string
          location?: string
          round_no?: number
          starts_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          capacity?: number | null
          checkin_code?: string
          course_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          ends_at?: string | null
          id?: string
          location?: string
          round_no?: number
          starts_at?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          audience: string
          category: string | null
          certificate_background_url: string | null
          checkin_code: string
          course_logo_url: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          department_subtitle: string | null
          description: string | null
          hospital_logo_url: string | null
          hours: number | null
          id: string
          instructor_name: string | null
          instructor_signature_url: string | null
          instructor_title: string | null
          issue_certificate: boolean
          organization_name: string | null
          pass_score: number
          published: boolean
          require_posttest: boolean
          require_pretest: boolean
          require_survey: boolean
          title: string
          training_type: string
          training_year: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          audience?: string
          category?: string | null
          certificate_background_url?: string | null
          checkin_code?: string
          course_logo_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department_subtitle?: string | null
          description?: string | null
          hospital_logo_url?: string | null
          hours?: number | null
          id?: string
          instructor_name?: string | null
          instructor_signature_url?: string | null
          instructor_title?: string | null
          issue_certificate?: boolean
          organization_name?: string | null
          pass_score?: number
          published?: boolean
          require_posttest?: boolean
          require_pretest?: boolean
          require_survey?: boolean
          title: string
          training_type?: string
          training_year?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          audience?: string
          category?: string | null
          certificate_background_url?: string | null
          checkin_code?: string
          course_logo_url?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department_subtitle?: string | null
          description?: string | null
          hospital_logo_url?: string | null
          hours?: number | null
          id?: string
          instructor_name?: string | null
          instructor_signature_url?: string | null
          instructor_title?: string | null
          issue_certificate?: boolean
          organization_name?: string | null
          pass_score?: number
          published?: boolean
          require_posttest?: boolean
          require_pretest?: boolean
          require_survey?: boolean
          title?: string
          training_type?: string
          training_year?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "course_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          user_id?: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          body: string | null
          course_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          file_url: string | null
          id: string
          kind: string
          position: number
          title: string
          updated_at: string | null
          updated_by: string | null
          video_url: string | null
        }
        Insert: {
          body?: string | null
          course_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          file_url?: string | null
          id?: string
          kind?: string
          position?: number
          title: string
          updated_at?: string | null
          updated_by?: string | null
          video_url?: string | null
        }
        Update: {
          body?: string | null
          course_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          file_url?: string | null
          id?: string
          kind?: string
          position?: number
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      member_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
        }
        Relationships: []
      }
      org_unit_managers: {
        Row: { created_at: string; org_unit_id: string; user_id: string }
        Insert: { created_at?: string; org_unit_id: string; user_id: string }
        Update: { created_at?: string; org_unit_id?: string; user_id?: string }
        Relationships: []
      }
      org_units: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          kind: string
          name: string
          parent_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kind: string
          name: string
          parent_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kind?: string
          name?: string
          parent_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          department: string | null
          division: string | null
          email: string | null
          full_name: string
          id: string
          org_unit_id: string | null
          position: string | null
          license_no: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          approved?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          division?: string | null
          email?: string | null
          full_name?: string
          id: string
          org_unit_id?: string | null
          position?: string | null
          license_no?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          approved?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department?: string | null
          division?: string | null
          email?: string | null
          full_name?: string
          id?: string
          org_unit_id?: string | null
          position?: string | null
          license_no?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_index: number
          course_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          options: Json
          position: number
          question: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          correct_index?: number
          course_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          options?: Json
          position?: number
          question: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          correct_index?: number
          course_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          options?: Json
          position?: number
          question?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          kind: string
          position: number
          prompt: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kind?: string
          position?: number
          prompt: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kind?: string
          position?: number
          prompt?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answers: Json
          course_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          answers?: Json
          course_id: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Update: {
          answers?: Json
          course_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_summaries: {
        Row: {
          course_id: string
          created_at: string
          created_by: string | null
          response_count: number
          summary: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          created_by?: string | null
          response_count?: number
          summary: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          created_by?: string | null
          response_count?: number
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_summaries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      test_attempts: {
        Row: {
          answers: Json | null
          course_id: string
          created_at: string
          id: string
          kind: string
          passed: boolean
          percent: number
          score: number
          total: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          course_id: string
          created_at?: string
          id?: string
          kind: string
          passed: boolean
          percent: number
          score: number
          total: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          course_id?: string
          created_at?: string
          id?: string
          kind?: string
          passed?: boolean
          percent?: number
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_course: {
        Args: { _course: string; _user: string }
        Returns: boolean
      }
      can_edit_course: { Args: { _course: string }; Returns: boolean }
      check_in: { Args: { _code: string; _course: string }; Returns: Json }
      choose_session: { Args: { _session: string }; Returns: undefined }
      get_session_roster: {
        Args: { _session: string }
        Returns: {
          user_id: string
          full_name: string
          division: string
          department: string
          enrolled_at: string
        }[]
      }
      get_course_item_analytics: {
        Args: { _course: string }
        Returns: Json
      }
      get_test_questions: {
        Args: { _course: string }
        Returns: {
          id: string
          options: Json
          question: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      report_overview: { Args: { _year?: number }; Returns: Json }
      report_rows: {
        Args: { _year?: number }
        Returns: {
          cert_no: string
          course_title: string
          department: string
          division: string
          full_name: string
          issued_at: string
          post: number
          pre: number
          training_year: number
        }[]
      }
      get_team_members: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          full_name: string
          position: string
          division: string
          department: string
          org_unit_id: string | null
          approved: boolean
        }[]
      }
      get_my_enrollments: {
        Args: Record<PropertyKey, never>
        Returns: {
          course_id: string
          course_title: string
          category: string | null
          hours: number | null
          cover_url: string | null
          description: string | null
          pass_score: number
          training_year: number
          session_id: string | null
          round_no: number | null
          starts_at: string | null
          has_sessions: boolean
          require_pretest: boolean
          pre_done: boolean
          attended: boolean
          total_lessons: number
          lessons_done: number
          require_posttest: boolean
          post_done: boolean
          require_survey: boolean
          survey_done: boolean
          issue_certificate: boolean
          has_cert: boolean
          pre_score: number | null
          post_score: number | null
          cert_id: string | null
        }[]
      }
      get_calendar_sessions: {
        Args: {
          _start?: string | null
          _end?: string | null
        }
        Returns: {
          session_id: string
          course_id: string
          course_title: string
          course_category: string | null
          course_hours: number | null
          instructor_name: string | null
          audience: string
          published: boolean
          round_no: number
          starts_at: string | null
          ends_at: string | null
          location: string
          capacity: number | null
          checkin_code: string
          taken_seats: number
          is_my_session: boolean
          my_checked_in: boolean
          team_attendees_count: number
        }[]
      }
      get_team_enrollments: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          course_id: string
          course_title: string
          session_id: string | null
          round_no: number | null
          starts_at: string | null
          has_sessions: boolean
          require_pretest: boolean
          pre_done: boolean
          attended: boolean
          total_lessons: number
          lessons_done: number
          require_posttest: boolean
          post_done: boolean
          require_survey: boolean
          survey_done: boolean
          issue_certificate: boolean
          has_cert: boolean
        }[]
      }
      is_team_manager: { Args: { _user: string }; Returns: boolean }
      can_manage_user: { Args: { _manager: string; _target: string }; Returns: boolean }
      manager_assign_course: {
        Args: { _course: string; _session: string | null; _user_ids: string[] }
        Returns: Json
      }
      session_seats: {
        Args: { _course: string }
        Returns: {
          session_id: string
          taken: number
        }[]
      }
      staff_check_in: {
        Args: { _course: string; _session?: string; _user: string }
        Returns: Json
      }
      staff_enroll_user: {
        Args: { _course: string; _session?: string | null; _user: string }
        Returns: boolean
      }
      staff_remove_attendance: {
        Args: { _course: string; _user: string }
        Returns: boolean
      }
      staff_restore_enrollment: {
        Args: { _course: string; _user: string }
        Returns: boolean
      }
      staff_soft_delete_enrollment: {
        Args: { _course: string; _user: string }
        Returns: boolean
      }
      submit_test: {
        Args: { _answers: Json; _course: string; _kind: string }
        Returns: Json
      }
      try_issue_certificate: { Args: { _course: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "instructor" | "learner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "instructor", "learner"],
    },
  },
} as const
