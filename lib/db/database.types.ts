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
      ai_runs: {
        Row: {
          cached: boolean
          cost_usd: number
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_code: string | null
          feature: Database["public"]["Enums"]["ai_feature"]
          id: string
          input_hash: string
          latency_ms: number | null
          model: string
          prompt_version: string
          request_id: string | null
          status: Database["public"]["Enums"]["ai_run_status"]
          tokens_in: number
          tokens_out: number
          user_id: string
        }
        Insert: {
          cached?: boolean
          cost_usd?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          feature: Database["public"]["Enums"]["ai_feature"]
          id?: string
          input_hash: string
          latency_ms?: number | null
          model: string
          prompt_version: string
          request_id?: string | null
          status: Database["public"]["Enums"]["ai_run_status"]
          tokens_in?: number
          tokens_out?: number
          user_id: string
        }
        Update: {
          cached?: boolean
          cost_usd?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          feature?: Database["public"]["Enums"]["ai_feature"]
          id?: string
          input_hash?: string
          latency_ms?: number | null
          model?: string
          prompt_version?: string
          request_id?: string | null
          status?: Database["public"]["Enums"]["ai_run_status"]
          tokens_in?: number
          tokens_out?: number
          user_id?: string
        }
        Relationships: []
      }
      application_events: {
        Row: {
          application_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["application_event_type"]
          from_stage: Database["public"]["Enums"]["application_stage"] | null
          id: string
          occurred_at: string
          payload: Json
          to_stage: Database["public"]["Enums"]["application_stage"] | null
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["application_event_type"]
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          occurred_at?: string
          payload?: Json
          to_stage?: Database["public"]["Enums"]["application_stage"] | null
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["application_event_type"]
          from_stage?: Database["public"]["Enums"]["application_stage"] | null
          id?: string
          occurred_at?: string
          payload?: Json
          to_stage?: Database["public"]["Enums"]["application_stage"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applied_at: string | null
          archived_at: string | null
          company_id: string | null
          company_name: string
          cover_letter_document_id: string | null
          created_at: string
          id: string
          is_archived: boolean
          is_stale: boolean
          job_id: string | null
          job_url: string | null
          last_event_at: string
          next_action: string | null
          next_action_at: string | null
          notes: string | null
          origin: string
          recruiter_id: string | null
          resume_version_id: string | null
          role_title: string
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_period: Database["public"]["Enums"]["salary_period"] | null
          score_at_apply: number | null
          stage: Database["public"]["Enums"]["application_stage"]
          stage_changed_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          archived_at?: string | null
          company_id?: string | null
          company_name: string
          cover_letter_document_id?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_stale?: boolean
          job_id?: string | null
          job_url?: string | null
          last_event_at?: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          origin?: string
          recruiter_id?: string | null
          resume_version_id?: string | null
          role_title: string
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: Database["public"]["Enums"]["salary_period"] | null
          score_at_apply?: number | null
          stage?: Database["public"]["Enums"]["application_stage"]
          stage_changed_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          archived_at?: string | null
          company_id?: string | null
          company_name?: string
          cover_letter_document_id?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_stale?: boolean
          job_id?: string | null
          job_url?: string | null
          last_event_at?: string
          next_action?: string | null
          next_action_at?: string | null
          notes?: string | null
          origin?: string
          recruiter_id?: string | null
          resume_version_id?: string | null
          role_title?: string
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: Database["public"]["Enums"]["salary_period"] | null
          score_at_apply?: number | null
          stage?: Database["public"]["Enums"]["application_stage"]
          stage_changed_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_cover_letter_document_id_fkey"
            columns: ["cover_letter_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "recruiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_resume_version_fk"
            columns: ["resume_version_id"]
            isOneToOne: false
            referencedRelation: "resume_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_messages: {
        Row: {
          ai_run_id: string | null
          artifact: Json | null
          artifact_type: string | null
          content: string | null
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          ai_run_id?: string | null
          artifact?: Json | null
          artifact_type?: string | null
          content?: string | null
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          ai_run_id?: string | null
          artifact?: Json | null
          artifact_type?: string | null
          content?: string | null
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_messages_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "assistant_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_threads: {
        Row: {
          application_id: string | null
          created_at: string
          id: string
          job_id: string | null
          kind: Database["public"]["Enums"]["ai_feature"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind: Database["public"]["Enums"]["ai_feature"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: Database["public"]["Enums"]["ai_feature"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_threads_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_threads_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_hash: string | null
          metadata: Json
          request_id: string | null
          user_agent_hash: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json
          request_id?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_hash?: string | null
          metadata?: Json
          request_id?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      career_goals: {
        Row: {
          created_at: string
          current_value: number | null
          due_date: string | null
          id: string
          metric: string | null
          status: Database["public"]["Enums"]["item_status"]
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          due_date?: string | null
          id?: string
          metric?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number | null
          due_date?: string | null
          id?: string
          metric?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      career_milestones: {
        Row: {
          created_at: string
          description: string | null
          document_id: string | null
          id: string
          kind: string
          occurred_at: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_id?: string | null
          id?: string
          kind: string
          occurred_at: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          document_id?: string | null
          id?: string
          kind?: string
          occurred_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_milestones_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      career_profile_experiences: {
        Row: {
          career_profile_id: string
          display_order: number
          experience_id: string
          user_id: string
        }
        Insert: {
          career_profile_id: string
          display_order?: number
          experience_id: string
          user_id: string
        }
        Update: {
          career_profile_id?: string
          display_order?: number
          experience_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_profile_experiences_career_profile_id_fkey"
            columns: ["career_profile_id"]
            isOneToOne: false
            referencedRelation: "career_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_profile_experiences_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      career_profile_skills: {
        Row: {
          career_profile_id: string
          importance: number
          skill_id: string
          user_id: string
        }
        Insert: {
          career_profile_id: string
          importance?: number
          skill_id: string
          user_id: string
        }
        Update: {
          career_profile_id?: string
          importance?: number
          skill_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_profile_skills_career_profile_id_fkey"
            columns: ["career_profile_id"]
            isOneToOne: false
            referencedRelation: "career_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_profile_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      career_profiles: {
        Row: {
          completeness: number
          created_at: string
          id: string
          is_primary: boolean
          name: string
          normalized_target_title: string | null
          seniority: Database["public"]["Enums"]["seniority_level"] | null
          summary: string | null
          target_title: string | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          completeness?: number
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          normalized_target_title?: string | null
          seniority?: Database["public"]["Enums"]["seniority_level"] | null
          summary?: string | null
          target_title?: string | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          completeness?: number
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          normalized_target_title?: string | null
          seniority?: Database["public"]["Enums"]["seniority_level"] | null
          summary?: string | null
          target_title?: string | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      certifications: {
        Row: {
          created_at: string
          credential_id: string | null
          credential_url: string | null
          document_id: string | null
          expires_at: string | null
          id: string
          issued_at: string | null
          issuer: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          document_id?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          document_id?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      collector_queue: {
        Row: {
          attempts: number
          created_at: string
          cursor: string | null
          dedupe_key: string
          finished_at: string | null
          id: string
          last_error: string | null
          priority: number
          scheduled_for: string
          search_profile_id: string
          source_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["queue_status"]
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          cursor?: string | null
          dedupe_key: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          priority?: number
          scheduled_for?: string
          search_profile_id: string
          source_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          cursor?: string | null
          dedupe_key?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          priority?: number
          scheduled_for?: string
          search_profile_id?: string
          source_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["queue_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collector_queue_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collector_queue_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      collector_runs: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          filtered_reasons: Json
          finished_at: string | null
          id: string
          items_duplicated: number
          items_failed: number
          items_filtered: number
          items_found: number
          items_new: number
          items_updated: number
          request_count: number
          request_id: string | null
          scope: string
          search_profile_id: string | null
          source_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          trigger: Database["public"]["Enums"]["run_trigger"]
          user_id: string | null
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          filtered_reasons?: Json
          finished_at?: string | null
          id?: string
          items_duplicated?: number
          items_failed?: number
          items_filtered?: number
          items_found?: number
          items_new?: number
          items_updated?: number
          request_count?: number
          request_id?: string | null
          scope?: string
          search_profile_id?: string | null
          source_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          trigger?: Database["public"]["Enums"]["run_trigger"]
          user_id?: string | null
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          filtered_reasons?: Json
          finished_at?: string | null
          id?: string
          items_duplicated?: number
          items_failed?: number
          items_filtered?: number
          items_found?: number
          items_new?: number
          items_updated?: number
          request_count?: number
          request_id?: string | null
          scope?: string
          search_profile_id?: string | null
          source_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          trigger?: Database["public"]["Enums"]["run_trigger"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collector_runs_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collector_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          careers_url: string | null
          city: string | null
          country: string | null
          created_at: string
          domain: string | null
          id: string
          industry: string | null
          linkedin_url: string | null
          name: string
          normalized_name: string
          size_range: string | null
          state: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          careers_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          name: string
          normalized_name: string
          size_range?: string | null
          state?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          careers_url?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          industry?: string | null
          linkedin_url?: string | null
          name?: string
          normalized_name?: string
          size_range?: string | null
          state?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      company_blocklist: {
        Row: {
          company_id: string | null
          company_name_pattern: string | null
          created_at: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          company_name_pattern?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          company_name_pattern?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_blocklist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_watchlist: {
        Row: {
          alert_on_new_job: boolean
          company_id: string
          created_at: string
          id: string
          notes: string | null
          rating: number | null
          relationship: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_on_new_job?: boolean
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          rating?: number | null
          relationship?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_on_new_job?: boolean
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          rating?: number | null
          relationship?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_watchlist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      current_employment: {
        Row: {
          base_salary: number | null
          benefits: Json
          bonus_annual: number | null
          commute_cost_monthly: number | null
          commute_minutes_daily: number | null
          company_id: string | null
          company_name: string
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          currency: string
          id: string
          notes: string | null
          role_title: string
          salary_period: Database["public"]["Enums"]["salary_period"]
          satisfaction: number | null
          started_at: string | null
          updated_at: string
          user_id: string
          work_model: Database["public"]["Enums"]["work_model"] | null
        }
        Insert: {
          base_salary?: number | null
          benefits?: Json
          bonus_annual?: number | null
          commute_cost_monthly?: number | null
          commute_minutes_daily?: number | null
          company_id?: string | null
          company_name: string
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          role_title: string
          salary_period?: Database["public"]["Enums"]["salary_period"]
          satisfaction?: number | null
          started_at?: string | null
          updated_at?: string
          user_id: string
          work_model?: Database["public"]["Enums"]["work_model"] | null
        }
        Update: {
          base_salary?: number | null
          benefits?: Json
          bonus_annual?: number | null
          commute_cost_monthly?: number | null
          commute_minutes_daily?: number | null
          company_id?: string | null
          company_name?: string
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          role_title?: string
          salary_period?: Database["public"]["Enums"]["salary_period"]
          satisfaction?: number | null
          started_at?: string | null
          updated_at?: string
          user_id?: string
          work_model?: Database["public"]["Enums"]["work_model"] | null
        }
        Relationships: [
          {
            foreignKeyName: "current_employment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_links: {
        Row: {
          created_at: string
          document_id: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          checksum: string | null
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          extracted_text: string | null
          id: string
          is_sensitive: boolean
          issued_at: string | null
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type: string
          size_bytes: number
          storage_path: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          extracted_text?: string | null
          id?: string
          is_sensitive?: boolean
          issued_at?: string | null
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type: string
          size_bytes: number
          storage_path: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          extracted_text?: string | null
          id?: string
          is_sensitive?: boolean
          issued_at?: string | null
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      educations: {
        Row: {
          created_at: string
          degree: string | null
          end_date: string | null
          field: string | null
          id: string
          institution: string
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          degree?: string | null
          end_date?: string | null
          field?: string | null
          id?: string
          institution: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          degree?: string | null
          end_date?: string | null
          field?: string | null
          id?: string
          institution?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      experiences: {
        Row: {
          achievements: string[]
          company_id: string | null
          company_name: string
          contract_type: Database["public"]["Enums"]["contract_type"] | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_current: boolean
          location: string | null
          role_title: string
          start_date: string
          technologies: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          achievements?: string[]
          company_id?: string | null
          company_name: string
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          role_title: string
          start_date: string
          technologies?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          achievements?: string[]
          company_id?: string | null
          company_name?: string
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          role_title?: string
          start_date?: string
          technologies?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          provider: string
          secret_ciphertext: string
          secret_last4: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          last_used_at?: string | null
          provider: string
          secret_ciphertext: string
          secret_last4: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          provider?: string
          secret_ciphertext?: string
          secret_last4?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          application_id: string
          created_at: string
          duration_minutes: number | null
          feedback_notes: string | null
          id: string
          interviewers: Json
          kind: Database["public"]["Enums"]["interview_kind"]
          location_or_link: string | null
          mode: string | null
          outcome: string | null
          preparation_notes: string | null
          scheduled_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          duration_minutes?: number | null
          feedback_notes?: string | null
          id?: string
          interviewers?: Json
          kind?: Database["public"]["Enums"]["interview_kind"]
          location_or_link?: string | null
          mode?: string | null
          outcome?: string | null
          preparation_notes?: string | null
          scheduled_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          duration_minutes?: number | null
          feedback_notes?: string | null
          id?: string
          interviewers?: Json
          kind?: Database["public"]["Enums"]["interview_kind"]
          location_or_link?: string | null
          mode?: string | null
          outcome?: string | null
          preparation_notes?: string | null
          scheduled_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      job_duplicates: {
        Row: {
          canonical_job_id: string
          detected_at: string
          id: string
          job_id: string
          similarity: number | null
          strategy: Database["public"]["Enums"]["duplicate_strategy"]
        }
        Insert: {
          canonical_job_id: string
          detected_at?: string
          id?: string
          job_id: string
          similarity?: number | null
          strategy: Database["public"]["Enums"]["duplicate_strategy"]
        }
        Update: {
          canonical_job_id?: string
          detected_at?: string
          id?: string
          job_id?: string
          similarity?: number | null
          strategy?: Database["public"]["Enums"]["duplicate_strategy"]
        }
        Relationships: [
          {
            foreignKeyName: "job_duplicates_canonical_job_id_fkey"
            columns: ["canonical_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_duplicates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_matches: {
        Row: {
          created_at: string
          data_coverage: number | null
          dismissed_at: string | null
          dismissed_reason: string | null
          id: string
          job_id: string
          low_confidence: boolean | null
          matched_at: string
          notified_at: string | null
          score: number | null
          score_breakdown: Json | null
          score_version: string | null
          scored_at: string | null
          search_profile_id: string
          status: Database["public"]["Enums"]["job_match_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_coverage?: number | null
          dismissed_at?: string | null
          dismissed_reason?: string | null
          id?: string
          job_id: string
          low_confidence?: boolean | null
          matched_at?: string
          notified_at?: string | null
          score?: number | null
          score_breakdown?: Json | null
          score_version?: string | null
          scored_at?: string | null
          search_profile_id: string
          status?: Database["public"]["Enums"]["job_match_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_coverage?: number | null
          dismissed_at?: string | null
          dismissed_reason?: string | null
          id?: string
          job_id?: string
          low_confidence?: boolean | null
          matched_at?: string
          notified_at?: string | null
          score?: number | null
          score_breakdown?: Json | null
          score_version?: string | null
          scored_at?: string | null
          search_profile_id?: string
          status?: Database["public"]["Enums"]["job_match_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_matches_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_offers: {
        Row: {
          application_id: string | null
          assumptions: Json
          base_salary: number
          bonus_annual: number | null
          commute_cost_monthly: number | null
          commute_minutes_daily: number | null
          company_id: string | null
          company_name: string
          computed: Json | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          currency: string
          decided_at: string | null
          decision: string | null
          decision_reason: string | null
          equity_annualized: number | null
          health_plan_value_monthly: number | null
          id: string
          meal_allowance_monthly: number | null
          other_allowances: Json
          pj_effective_tax_rate: number | null
          profit_sharing: number | null
          response_deadline: string | null
          role_title: string
          salary_period: Database["public"]["Enums"]["salary_period"]
          status: Database["public"]["Enums"]["offer_status"]
          tax_table_version: string
          updated_at: string
          user_id: string
          vacation_days: number | null
          work_model: Database["public"]["Enums"]["work_model"] | null
        }
        Insert: {
          application_id?: string | null
          assumptions: Json
          base_salary: number
          bonus_annual?: number | null
          commute_cost_monthly?: number | null
          commute_minutes_daily?: number | null
          company_id?: string | null
          company_name: string
          computed?: Json | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          currency?: string
          decided_at?: string | null
          decision?: string | null
          decision_reason?: string | null
          equity_annualized?: number | null
          health_plan_value_monthly?: number | null
          id?: string
          meal_allowance_monthly?: number | null
          other_allowances?: Json
          pj_effective_tax_rate?: number | null
          profit_sharing?: number | null
          response_deadline?: string | null
          role_title: string
          salary_period?: Database["public"]["Enums"]["salary_period"]
          status?: Database["public"]["Enums"]["offer_status"]
          tax_table_version: string
          updated_at?: string
          user_id: string
          vacation_days?: number | null
          work_model?: Database["public"]["Enums"]["work_model"] | null
        }
        Update: {
          application_id?: string | null
          assumptions?: Json
          base_salary?: number
          bonus_annual?: number | null
          commute_cost_monthly?: number | null
          commute_minutes_daily?: number | null
          company_id?: string | null
          company_name?: string
          computed?: Json | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          currency?: string
          decided_at?: string | null
          decision?: string | null
          decision_reason?: string | null
          equity_annualized?: number | null
          health_plan_value_monthly?: number | null
          id?: string
          meal_allowance_monthly?: number | null
          other_allowances?: Json
          pj_effective_tax_rate?: number | null
          profit_sharing?: number | null
          response_deadline?: string | null
          role_title?: string
          salary_period?: Database["public"]["Enums"]["salary_period"]
          status?: Database["public"]["Enums"]["offer_status"]
          tax_table_version?: string
          updated_at?: string
          user_id?: string
          vacation_days?: number | null
          work_model?: Database["public"]["Enums"]["work_model"] | null
        }
        Relationships: [
          {
            foreignKeyName: "job_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_raw_payloads: {
        Row: {
          fetched_at: string
          http_meta: Json
          id: string
          job_id: string
          payload: Json
          source_id: string
        }
        Insert: {
          fetched_at?: string
          http_meta?: Json
          id?: string
          job_id: string
          payload: Json
          source_id: string
        }
        Update: {
          fetched_at?: string
          http_meta?: Json
          id?: string
          job_id?: string
          payload?: Json
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_raw_payloads_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_raw_payloads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      job_skills: {
        Row: {
          extraction: string
          job_id: string
          occurrences: number
          skill_id: string
        }
        Insert: {
          extraction?: string
          job_id: string
          occurrences?: number
          skill_id: string
        }
        Update: {
          extraction?: string
          job_id?: string
          occurrences?: number
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_skills_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sources: {
        Row: {
          adapter_key: string
          capabilities: Json
          config: Json
          consecutive_failures: number
          created_at: string
          display_name: string
          id: string
          kind: Database["public"]["Enums"]["source_kind"]
          last_error: string | null
          last_run_at: string | null
          last_success_at: string | null
          legal_notes: string | null
          legal_status: Database["public"]["Enums"]["source_legal_status"]
          rate_limit_per_min: number
          requires_user_key: boolean
          robots_checked_at: string | null
          slug: string
          status: Database["public"]["Enums"]["source_status"]
          terms_url: string | null
          updated_at: string
        }
        Insert: {
          adapter_key: string
          capabilities?: Json
          config?: Json
          consecutive_failures?: number
          created_at?: string
          display_name: string
          id?: string
          kind: Database["public"]["Enums"]["source_kind"]
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          legal_notes?: string | null
          legal_status?: Database["public"]["Enums"]["source_legal_status"]
          rate_limit_per_min?: number
          requires_user_key?: boolean
          robots_checked_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["source_status"]
          terms_url?: string | null
          updated_at?: string
        }
        Update: {
          adapter_key?: string
          capabilities?: Json
          config?: Json
          consecutive_failures?: number
          created_at?: string
          display_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["source_kind"]
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          legal_notes?: string | null
          legal_status?: Database["public"]["Enums"]["source_legal_status"]
          rate_limit_per_min?: number
          requires_user_key?: boolean
          robots_checked_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["source_status"]
          terms_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          apply_url: string
          canonical_url: string | null
          city: string | null
          closed_at: string | null
          company_id: string
          contract_type: Database["public"]["Enums"]["contract_type"] | null
          country: string | null
          created_at: string
          description_html: string | null
          description_text: string | null
          external_id: string
          fingerprint: string
          first_seen_at: string
          id: string
          is_active: boolean
          last_seen_at: string
          location_raw: string | null
          missed_count: number
          normalized_title: string
          published_at: string | null
          published_at_confidence: Database["public"]["Enums"]["confidence_level"]
          published_at_source:
            | Database["public"]["Enums"]["published_at_source"]
            | null
          recruiter_id: string | null
          salary_currency: string | null
          salary_is_estimated: boolean
          salary_max: number | null
          salary_min: number | null
          salary_period: Database["public"]["Enums"]["salary_period"] | null
          salary_raw: string | null
          search_vector: unknown
          seniority: Database["public"]["Enums"]["seniority_level"] | null
          source_id: string
          state: string | null
          title: string
          updated_at: string
          work_model: Database["public"]["Enums"]["work_model"] | null
        }
        Insert: {
          apply_url: string
          canonical_url?: string | null
          city?: string | null
          closed_at?: string | null
          company_id: string
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          country?: string | null
          created_at?: string
          description_html?: string | null
          description_text?: string | null
          external_id: string
          fingerprint: string
          first_seen_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          location_raw?: string | null
          missed_count?: number
          normalized_title: string
          published_at?: string | null
          published_at_confidence?: Database["public"]["Enums"]["confidence_level"]
          published_at_source?:
            | Database["public"]["Enums"]["published_at_source"]
            | null
          recruiter_id?: string | null
          salary_currency?: string | null
          salary_is_estimated?: boolean
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: Database["public"]["Enums"]["salary_period"] | null
          salary_raw?: string | null
          search_vector?: unknown
          seniority?: Database["public"]["Enums"]["seniority_level"] | null
          source_id: string
          state?: string | null
          title: string
          updated_at?: string
          work_model?: Database["public"]["Enums"]["work_model"] | null
        }
        Update: {
          apply_url?: string
          canonical_url?: string | null
          city?: string | null
          closed_at?: string | null
          company_id?: string
          contract_type?: Database["public"]["Enums"]["contract_type"] | null
          country?: string | null
          created_at?: string
          description_html?: string | null
          description_text?: string | null
          external_id?: string
          fingerprint?: string
          first_seen_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          location_raw?: string | null
          missed_count?: number
          normalized_title?: string
          published_at?: string | null
          published_at_confidence?: Database["public"]["Enums"]["confidence_level"]
          published_at_source?:
            | Database["public"]["Enums"]["published_at_source"]
            | null
          recruiter_id?: string | null
          salary_currency?: string | null
          salary_is_estimated?: boolean
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: Database["public"]["Enums"]["salary_period"] | null
          salary_raw?: string | null
          search_vector?: unknown
          seniority?: Database["public"]["Enums"]["seniority_level"] | null
          source_id?: string
          state?: string | null
          title?: string
          updated_at?: string
          work_model?: Database["public"]["Enums"]["work_model"] | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_recruiter_fk"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "recruiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_items: {
        Row: {
          completed_at: string | null
          completed_hours: number
          cost: number | null
          created_at: string
          currency: string | null
          display_order: number
          due_date: string | null
          estimated_hours: number | null
          id: string
          is_user_provided: boolean
          plan_id: string
          provider: string | null
          skill_id: string | null
          status: Database["public"]["Enums"]["item_status"]
          title: string
          type: Database["public"]["Enums"]["learning_item_type"]
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_hours?: number
          cost?: number | null
          created_at?: string
          currency?: string | null
          display_order?: number
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_user_provided?: boolean
          plan_id: string
          provider?: string | null
          skill_id?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          title: string
          type: Database["public"]["Enums"]["learning_item_type"]
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_hours?: number
          cost?: number | null
          created_at?: string
          currency?: string | null
          display_order?: number
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_user_provided?: boolean
          plan_id?: string
          provider?: string | null
          skill_id?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          title?: string
          type?: Database["public"]["Enums"]["learning_item_type"]
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_items_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_plans: {
        Row: {
          career_profile_id: string | null
          created_at: string
          due_date: string | null
          id: string
          start_date: string | null
          status: Database["public"]["Enums"]["item_status"]
          target_role: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          career_profile_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          target_role?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          career_profile_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          target_role?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_plans_career_profile_id_fkey"
            columns: ["career_profile_id"]
            isOneToOne: false
            referencedRelation: "career_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_audit_findings: {
        Row: {
          audit_id: string
          created_at: string
          example_text: string
          has_placeholder: boolean
          how_to_fix: string
          id: string
          impact: string
          issue: string
          priority: number
          section_key: string
          severity: Database["public"]["Enums"]["finding_severity"]
          status: Database["public"]["Enums"]["finding_status"]
          status_changed_at: string | null
          used_facts: Json
          user_id: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          example_text: string
          has_placeholder?: boolean
          how_to_fix: string
          id?: string
          impact: string
          issue: string
          priority: number
          section_key: string
          severity: Database["public"]["Enums"]["finding_severity"]
          status?: Database["public"]["Enums"]["finding_status"]
          status_changed_at?: string | null
          used_facts?: Json
          user_id: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          example_text?: string
          has_placeholder?: boolean
          how_to_fix?: string
          id?: string
          impact?: string
          issue?: string
          priority?: number
          section_key?: string
          severity?: Database["public"]["Enums"]["finding_severity"]
          status?: Database["public"]["Enums"]["finding_status"]
          status_changed_at?: string | null
          used_facts?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_audit_findings_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "linkedin_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_audit_sections: {
        Row: {
          ai_score: number | null
          audit_id: string
          created_at: string
          deterministic_score: number | null
          id: string
          optimized_text: string | null
          original_text: string | null
          rationale: string | null
          score_0_10: number | null
          section_key: string
          status: Database["public"]["Enums"]["section_status"]
          user_id: string
          weight: number
          weighted_points: number | null
        }
        Insert: {
          ai_score?: number | null
          audit_id: string
          created_at?: string
          deterministic_score?: number | null
          id?: string
          optimized_text?: string | null
          original_text?: string | null
          rationale?: string | null
          score_0_10?: number | null
          section_key: string
          status: Database["public"]["Enums"]["section_status"]
          user_id: string
          weight: number
          weighted_points?: number | null
        }
        Update: {
          ai_score?: number | null
          audit_id?: string
          created_at?: string
          deterministic_score?: number | null
          id?: string
          optimized_text?: string | null
          original_text?: string | null
          rationale?: string | null
          score_0_10?: number | null
          section_key?: string
          status?: Database["public"]["Enums"]["section_status"]
          user_id?: string
          weight?: number
          weighted_points?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_audit_sections_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "linkedin_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_audits: {
        Row: {
          ai_run_id: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          evaluated_weight: number | null
          finished_at: string | null
          id: string
          overall_score: number | null
          previous_audit_id: string | null
          profile_coverage: number | null
          profile_version_id: string
          prompt_version: string | null
          score_version: string
          search_profile_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["audit_status"]
          user_id: string
          weights: Json
        }
        Insert: {
          ai_run_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          evaluated_weight?: number | null
          finished_at?: string | null
          id?: string
          overall_score?: number | null
          previous_audit_id?: string | null
          profile_coverage?: number | null
          profile_version_id: string
          prompt_version?: string | null
          score_version: string
          search_profile_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["audit_status"]
          user_id: string
          weights: Json
        }
        Update: {
          ai_run_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          evaluated_weight?: number | null
          finished_at?: string | null
          id?: string
          overall_score?: number | null
          previous_audit_id?: string | null
          profile_coverage?: number | null
          profile_version_id?: string
          prompt_version?: string | null
          score_version?: string
          search_profile_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["audit_status"]
          user_id?: string
          weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_audits_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_audits_previous_audit_id_fkey"
            columns: ["previous_audit_id"]
            isOneToOne: false
            referencedRelation: "linkedin_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_audits_profile_version_id_fkey"
            columns: ["profile_version_id"]
            isOneToOne: false
            referencedRelation: "linkedin_profile_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_audits_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_profile_versions: {
        Row: {
          captured_at: string
          coverage: Json
          created_at: string
          document_id: string | null
          id: string
          input_method: Database["public"]["Enums"]["linkedin_input_method"]
          raw_text: string | null
          reviewed_at: string
          snapshot: Json
          source_url: string | null
          user_id: string
        }
        Insert: {
          captured_at?: string
          coverage: Json
          created_at?: string
          document_id?: string | null
          id?: string
          input_method: Database["public"]["Enums"]["linkedin_input_method"]
          raw_text?: string | null
          reviewed_at: string
          snapshot: Json
          source_url?: string | null
          user_id: string
        }
        Update: {
          captured_at?: string
          coverage?: Json
          created_at?: string
          document_id?: string | null
          id?: string
          input_method?: Database["public"]["Enums"]["linkedin_input_method"]
          raw_text?: string | null
          reviewed_at?: string
          snapshot?: Json
          source_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_profile_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      market_insights: {
        Row: {
          computed_at: string
          id: string
          insight_version: string
          metric: string
          period_end: string
          period_start: string
          sample_size: number
          scope: Json
          scope_hash: string
          value: Json
        }
        Insert: {
          computed_at?: string
          id?: string
          insight_version?: string
          metric: string
          period_end: string
          period_start: string
          sample_size: number
          scope: Json
          scope_hash: string
          value: Json
        }
        Update: {
          computed_at?: string
          id?: string
          insight_version?: string
          metric?: string
          period_end?: string
          period_start?: string
          sample_size?: number
          scope?: Json
          scope_hash?: string
          value?: Json
        }
        Relationships: []
      }
      notification_digests: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          items: Json
          scheduled_for: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          items?: Json
          scheduled_for: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          items?: Json
          scheduled_for?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          digest_id: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          read_at: string | null
          sent_at: string | null
          severity: string
          suppressed_by_stealth: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          digest_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          severity?: string
          suppressed_by_stealth?: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          digest_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          severity?: string
          suppressed_by_stealth?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_digest_id_fkey"
            columns: ["digest_id"]
            isOneToOne: false
            referencedRelation: "notification_digests"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_criteria_scores: {
        Row: {
          criterion: string
          notes: string | null
          offer_id: string
          score_0_10: number
          user_id: string
        }
        Insert: {
          criterion: string
          notes?: string | null
          offer_id: string
          score_0_10: number
          user_id: string
        }
        Update: {
          criterion?: string
          notes?: string | null
          offer_id?: string
          score_0_10?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_criteria_scores_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "job_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_criteria_weights: {
        Row: {
          criterion: string
          user_id: string
          weight: number
        }
        Insert: {
          criterion: string
          user_id: string
          weight?: number
        }
        Update: {
          criterion?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      profile_links: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          notes: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          notes?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          notes?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepted_contract_types: Database["public"]["Enums"]["contract_type"][]
          accepted_work_models: Database["public"]["Enums"]["work_model"][]
          avatar_url: string | null
          city: string | null
          country: string
          created_at: string
          full_name: string | null
          headline: string | null
          locale: string
          onboarding_completed_at: string | null
          salary_expectation_currency: string
          salary_expectation_max: number | null
          salary_expectation_min: number | null
          salary_expectation_period: Database["public"]["Enums"]["salary_period"]
          state: string | null
          timezone: string
          updated_at: string
          user_id: string
          willing_to_relocate: boolean
          willing_to_travel: boolean
        }
        Insert: {
          accepted_contract_types?: Database["public"]["Enums"]["contract_type"][]
          accepted_work_models?: Database["public"]["Enums"]["work_model"][]
          avatar_url?: string | null
          city?: string | null
          country?: string
          created_at?: string
          full_name?: string | null
          headline?: string | null
          locale?: string
          onboarding_completed_at?: string | null
          salary_expectation_currency?: string
          salary_expectation_max?: number | null
          salary_expectation_min?: number | null
          salary_expectation_period?: Database["public"]["Enums"]["salary_period"]
          state?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
          willing_to_relocate?: boolean
          willing_to_travel?: boolean
        }
        Update: {
          accepted_contract_types?: Database["public"]["Enums"]["contract_type"][]
          accepted_work_models?: Database["public"]["Enums"]["work_model"][]
          avatar_url?: string | null
          city?: string | null
          country?: string
          created_at?: string
          full_name?: string | null
          headline?: string | null
          locale?: string
          onboarding_completed_at?: string | null
          salary_expectation_currency?: string
          salary_expectation_max?: number | null
          salary_expectation_min?: number | null
          salary_expectation_period?: Database["public"]["Enums"]["salary_period"]
          state?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          willing_to_relocate?: boolean
          willing_to_travel?: boolean
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          id: string
          user_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          id?: string
          user_id: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      recruiter_activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["recruiter_activity_type"]
          created_at: string
          created_by: string
          excerpt: string | null
          id: string
          is_recruiting_related: boolean
          job_id: string | null
          observed_at: string
          occurred_at: string | null
          occurred_at_confidence: Database["public"]["Enums"]["confidence_level"]
          recruiter_id: string
          source_id: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["recruiter_activity_type"]
          created_at?: string
          created_by?: string
          excerpt?: string | null
          id?: string
          is_recruiting_related: boolean
          job_id?: string | null
          observed_at?: string
          occurred_at?: string | null
          occurred_at_confidence?: Database["public"]["Enums"]["confidence_level"]
          recruiter_id: string
          source_id?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["recruiter_activity_type"]
          created_at?: string
          created_by?: string
          excerpt?: string | null
          id?: string
          is_recruiting_related?: boolean
          job_id?: string | null
          observed_at?: string
          occurred_at?: string | null
          occurred_at_confidence?: Database["public"]["Enums"]["confidence_level"]
          recruiter_id?: string
          source_id?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_activities_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_activities_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "recruiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_activities_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiter_contacts: {
        Row: {
          application_id: string | null
          channel: Database["public"]["Enums"]["contact_channel"]
          created_at: string
          direction: Database["public"]["Enums"]["contact_direction"]
          follow_up_at: string | null
          follow_up_done: boolean
          id: string
          notes: string | null
          occurred_at: string
          outcome: string | null
          recruiter_id: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          channel: Database["public"]["Enums"]["contact_channel"]
          created_at?: string
          direction: Database["public"]["Enums"]["contact_direction"]
          follow_up_at?: string | null
          follow_up_done?: boolean
          id?: string
          notes?: string | null
          occurred_at?: string
          outcome?: string | null
          recruiter_id: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          channel?: Database["public"]["Enums"]["contact_channel"]
          created_at?: string
          direction?: Database["public"]["Enums"]["contact_direction"]
          follow_up_at?: string | null
          follow_up_done?: boolean
          id?: string
          notes?: string | null
          occurred_at?: string
          outcome?: string | null
          recruiter_id?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruiter_contacts_application_fk"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiter_contacts_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "recruiters"
            referencedColumns: ["id"]
          },
        ]
      }
      recruiters: {
        Row: {
          activity_status: Database["public"]["Enums"]["recruiter_activity_status"]
          activity_status_reason: string | null
          activity_status_updated_at: string | null
          company_id: string | null
          company_name_raw: string | null
          created_at: string
          full_name: string
          headline: string | null
          id: string
          last_activity_at: string | null
          last_activity_confidence:
            | Database["public"]["Enums"]["confidence_level"]
            | null
          last_activity_id: string | null
          merged_at: string | null
          merged_into_id: string | null
          next_review_at: string | null
          normalized_name: string
          normalized_profile_url: string | null
          notes: string | null
          profile_url: string | null
          source: string
          specialties: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activity_status?: Database["public"]["Enums"]["recruiter_activity_status"]
          activity_status_reason?: string | null
          activity_status_updated_at?: string | null
          company_id?: string | null
          company_name_raw?: string | null
          created_at?: string
          full_name: string
          headline?: string | null
          id?: string
          last_activity_at?: string | null
          last_activity_confidence?:
            | Database["public"]["Enums"]["confidence_level"]
            | null
          last_activity_id?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          next_review_at?: string | null
          normalized_name: string
          normalized_profile_url?: string | null
          notes?: string | null
          profile_url?: string | null
          source?: string
          specialties?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activity_status?: Database["public"]["Enums"]["recruiter_activity_status"]
          activity_status_reason?: string | null
          activity_status_updated_at?: string | null
          company_id?: string | null
          company_name_raw?: string | null
          created_at?: string
          full_name?: string
          headline?: string | null
          id?: string
          last_activity_at?: string | null
          last_activity_confidence?:
            | Database["public"]["Enums"]["confidence_level"]
            | null
          last_activity_id?: string | null
          merged_at?: string | null
          merged_into_id?: string | null
          next_review_at?: string | null
          normalized_name?: string
          normalized_profile_url?: string | null
          notes?: string | null
          profile_url?: string | null
          source?: string
          specialties?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruiters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiters_last_activity_fk"
            columns: ["last_activity_id"]
            isOneToOne: false
            referencedRelation: "recruiter_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruiters_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "recruiters"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_versions: {
        Row: {
          ai_run_id: string | null
          content: Json
          created_at: string
          document_id: string | null
          generated_for_job_id: string | null
          id: string
          notes: string | null
          resume_id: string
          user_id: string
          version_number: number
        }
        Insert: {
          ai_run_id?: string | null
          content: Json
          created_at?: string
          document_id?: string | null
          generated_for_job_id?: string | null
          id?: string
          notes?: string | null
          resume_id: string
          user_id: string
          version_number: number
        }
        Update: {
          ai_run_id?: string | null
          content?: Json
          created_at?: string
          document_id?: string | null
          generated_for_job_id?: string | null
          id?: string
          notes?: string | null
          resume_id?: string
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "resume_versions_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_versions_generated_for_job_id_fkey"
            columns: ["generated_for_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resume_versions_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          career_profile_id: string | null
          created_at: string
          current_version_id: string | null
          id: string
          is_master: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          career_profile_id?: string | null
          created_at?: string
          current_version_id?: string | null
          id?: string
          is_master?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          career_profile_id?: string | null
          created_at?: string
          current_version_id?: string | null
          id?: string
          is_master?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_career_profile_id_fkey"
            columns: ["career_profile_id"]
            isOneToOne: false
            referencedRelation: "career_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resumes_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "resume_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      search_profile_sources: {
        Row: {
          config: Json
          created_at: string
          is_enabled: boolean
          search_profile_id: string
          source_id: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          is_enabled?: boolean
          search_profile_id: string
          source_id: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          is_enabled?: boolean
          search_profile_id?: string
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_profile_sources_search_profile_id_fkey"
            columns: ["search_profile_id"]
            isOneToOne: false
            referencedRelation: "search_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_profile_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      search_profiles: {
        Row: {
          areas: string[]
          career_profile_id: string | null
          collect_frequency: string
          contract_types: Database["public"]["Enums"]["contract_type"][]
          created_at: string
          currency: string
          excluded_keywords: string[]
          id: string
          is_active: boolean
          keywords: string[]
          last_result_count: number | null
          last_run_at: string | null
          locations: Json
          min_notify_score: number | null
          name: string
          recency_hours: number
          salary_min: number | null
          score_weights: Json
          seniorities: Database["public"]["Enums"]["seniority_level"][]
          titles: string[]
          updated_at: string
          user_id: string
          work_models: Database["public"]["Enums"]["work_model"][]
        }
        Insert: {
          areas?: string[]
          career_profile_id?: string | null
          collect_frequency?: string
          contract_types?: Database["public"]["Enums"]["contract_type"][]
          created_at?: string
          currency?: string
          excluded_keywords?: string[]
          id?: string
          is_active?: boolean
          keywords?: string[]
          last_result_count?: number | null
          last_run_at?: string | null
          locations?: Json
          min_notify_score?: number | null
          name: string
          recency_hours?: number
          salary_min?: number | null
          score_weights?: Json
          seniorities?: Database["public"]["Enums"]["seniority_level"][]
          titles?: string[]
          updated_at?: string
          user_id: string
          work_models?: Database["public"]["Enums"]["work_model"][]
        }
        Update: {
          areas?: string[]
          career_profile_id?: string | null
          collect_frequency?: string
          contract_types?: Database["public"]["Enums"]["contract_type"][]
          created_at?: string
          currency?: string
          excluded_keywords?: string[]
          id?: string
          is_active?: boolean
          keywords?: string[]
          last_result_count?: number | null
          last_run_at?: string | null
          locations?: Json
          min_notify_score?: number | null
          name?: string
          recency_hours?: number
          salary_min?: number | null
          score_weights?: Json
          seniorities?: Database["public"]["Enums"]["seniority_level"][]
          titles?: string[]
          updated_at?: string
          user_id?: string
          work_models?: Database["public"]["Enums"]["work_model"][]
        }
        Relationships: [
          {
            foreignKeyName: "search_profiles_career_profile_id_fkey"
            columns: ["career_profile_id"]
            isOneToOne: false
            referencedRelation: "career_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          aliases: string[]
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          aliases?: string[]
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          aliases?: string[]
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      user_job_sources: {
        Row: {
          config: Json
          created_at: string
          credential_id: string | null
          is_enabled: boolean
          source_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          credential_id?: string | null
          is_enabled?: boolean
          source_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          credential_id?: string | null
          is_enabled?: boolean
          source_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_job_sources_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "integration_credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_job_sources_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "integration_credentials_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_job_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      user_limits: {
        Row: {
          ai_cycle_started_on: string
          ai_monthly_cost_cap_usd: number
          created_at: string
          manual_runs_per_hour: number
          max_active_search_profiles: number
          max_sources_per_profile: number
          max_upload_mb: number
          plan: string
          storage_quota_mb: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_cycle_started_on?: string
          ai_monthly_cost_cap_usd?: number
          created_at?: string
          manual_runs_per_hour?: number
          max_active_search_profiles?: number
          max_sources_per_profile?: number
          max_upload_mb?: number
          plan?: string
          storage_quota_mb?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_cycle_started_on?: string
          ai_monthly_cost_cap_usd?: number
          created_at?: string
          manual_runs_per_hour?: number
          max_active_search_profiles?: number
          max_sources_per_profile?: number
          max_upload_mb?: number
          plan?: string
          storage_quota_mb?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          activity_logging_enabled: boolean
          created_at: string
          data_retention_days: number
          default_recency_hours: number
          density: string
          digest_time: string
          email_neutral_subject: string
          mask_sensitive_values: boolean
          min_notify_score: number
          neutral_title: string
          notification_channels: Json
          pin_hash: string | null
          pin_timeout_minutes: number | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          recruiter_monitoring_enabled: boolean
          stale_after_days: number
          stealth_mode: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_logging_enabled?: boolean
          created_at?: string
          data_retention_days?: number
          default_recency_hours?: number
          density?: string
          digest_time?: string
          email_neutral_subject?: string
          mask_sensitive_values?: boolean
          min_notify_score?: number
          neutral_title?: string
          notification_channels?: Json
          pin_hash?: string | null
          pin_timeout_minutes?: number | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          recruiter_monitoring_enabled?: boolean
          stale_after_days?: number
          stealth_mode?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_logging_enabled?: boolean
          created_at?: string
          data_retention_days?: number
          default_recency_hours?: number
          density?: string
          digest_time?: string
          email_neutral_subject?: string
          mask_sensitive_values?: boolean
          min_notify_score?: number
          neutral_title?: string
          notification_channels?: Json
          pin_hash?: string | null
          pin_timeout_minutes?: number | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          recruiter_monitoring_enabled?: boolean
          stale_after_days?: number
          stealth_mode?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_skills: {
        Row: {
          created_at: string
          evidence: string | null
          last_used_at: string | null
          level: number
          skill_id: string
          updated_at: string
          user_id: string
          years_practice: number | null
        }
        Insert: {
          created_at?: string
          evidence?: string | null
          last_used_at?: string | null
          level: number
          skill_id: string
          updated_at?: string
          user_id: string
          years_practice?: number | null
        }
        Update: {
          created_at?: string
          evidence?: string | null
          last_used_at?: string | null
          level?: number
          skill_id?: string
          updated_at?: string
          user_id?: string
          years_practice?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      integration_credentials_safe: {
        Row: {
          created_at: string | null
          id: string | null
          label: string | null
          last_used_at: string | null
          provider: string | null
          secret_last4: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          label?: string | null
          last_used_at?: string | null
          provider?: string | null
          secret_last4?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          label?: string | null
          last_used_at?: string | null
          provider?: string | null
          secret_last4?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      careeros_normalize: { Args: { p_text: string }; Returns: string }
      current_ai_cycle_cost: { Args: { p_user_id?: string }; Returns: number }
      dashboard_counters: { Args: { p_user_id?: string }; Returns: Json }
    }
    Enums: {
      ai_feature:
        | "linkedin_audit"
        | "job_analysis"
        | "resume_tailor"
        | "cover_letter"
        | "recruiter_message"
        | "interview_sim"
        | "interview_feedback"
        | "ats_check"
        | "profile_import"
      ai_run_status:
        | "success"
        | "validation_failed"
        | "blocked_by_cap"
        | "provider_error"
        | "cached"
      application_event_type:
        | "stage_change"
        | "note"
        | "contact"
        | "interview_scheduled"
        | "interview_done"
        | "document_attached"
        | "next_action_set"
        | "archived"
        | "restored"
      application_stage:
        | "radar"
        | "interested"
        | "applied"
        | "screening"
        | "interview"
        | "technical_test"
        | "offer"
        | "accepted"
        | "rejected"
        | "withdrawn"
      audit_status: "queued" | "running" | "completed" | "failed"
      confidence_level: "exact" | "approximate" | "unknown"
      contact_channel:
        | "linkedin"
        | "email"
        | "phone"
        | "whatsapp"
        | "event"
        | "referral"
        | "other"
      contact_direction: "inbound" | "outbound"
      contract_type:
        | "clt"
        | "pj"
        | "internship"
        | "temporary"
        | "freelance"
        | "other"
      document_kind:
        | "resume"
        | "cover_letter"
        | "certificate"
        | "diploma"
        | "linkedin_pdf"
        | "offer"
        | "portfolio"
        | "other"
      duplicate_strategy: "source_identity" | "fingerprint" | "fuzzy" | "manual"
      finding_severity: "critical" | "high" | "medium" | "low"
      finding_status: "pending" | "applied" | "ignored"
      interview_kind:
        | "screening"
        | "technical"
        | "panel"
        | "cultural"
        | "final"
        | "other"
      item_status: "planned" | "in_progress" | "done" | "dropped"
      job_match_status:
        | "new"
        | "seen"
        | "saved"
        | "dismissed"
        | "sent_to_kanban"
        | "blocked"
      learning_item_type:
        | "course"
        | "book"
        | "certification"
        | "project"
        | "practice"
        | "other"
      linkedin_input_method:
        | "public_url"
        | "pasted_text"
        | "pdf_export"
        | "manual_form"
      notification_channel: "in_app" | "email"
      notification_type:
        | "new_jobs"
        | "follow_up_due"
        | "interview_soon"
        | "certification_expiring"
        | "source_degraded"
        | "ai_cap_reached"
        | "stale_application"
        | "offer_deadline"
        | "target_company_job"
      offer_status:
        | "draft"
        | "received"
        | "negotiating"
        | "accepted"
        | "declined"
        | "expired"
      published_at_source:
        | "api_field"
        | "page_metadata"
        | "http_header"
        | "source_relative"
        | "first_seen"
      queue_status: "pending" | "processing" | "done" | "failed" | "dead"
      recruiter_activity_status:
        | "active_recent"
        | "possibly_active"
        | "no_activity_found"
      recruiter_activity_type:
        | "job_post"
        | "recruiting_post"
        | "hiring_comment"
        | "direct_contact"
        | "event"
        | "generic_post"
        | "profile_update"
        | "user_observation"
      run_status: "running" | "success" | "partial" | "failed"
      run_trigger: "cron" | "manual" | "backfill"
      salary_period: "hour" | "month" | "year"
      section_status: "evaluated" | "not_evaluable"
      seniority_level:
        | "intern"
        | "junior"
        | "mid"
        | "senior"
        | "specialist"
        | "lead"
        | "manager"
      source_kind:
        | "official_api"
        | "ats_public_api"
        | "rss"
        | "jsonld_page"
        | "manual"
        | "email_alert"
      source_legal_status:
        | "allowed"
        | "review_needed"
        | "disallowed"
        | "requires_user_key"
      source_status: "active" | "paused" | "degraded" | "disabled"
      work_model: "onsite" | "hybrid" | "remote"
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
      ai_feature: [
        "linkedin_audit",
        "job_analysis",
        "resume_tailor",
        "cover_letter",
        "recruiter_message",
        "interview_sim",
        "interview_feedback",
        "ats_check",
        "profile_import",
      ],
      ai_run_status: [
        "success",
        "validation_failed",
        "blocked_by_cap",
        "provider_error",
        "cached",
      ],
      application_event_type: [
        "stage_change",
        "note",
        "contact",
        "interview_scheduled",
        "interview_done",
        "document_attached",
        "next_action_set",
        "archived",
        "restored",
      ],
      application_stage: [
        "radar",
        "interested",
        "applied",
        "screening",
        "interview",
        "technical_test",
        "offer",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      audit_status: ["queued", "running", "completed", "failed"],
      confidence_level: ["exact", "approximate", "unknown"],
      contact_channel: [
        "linkedin",
        "email",
        "phone",
        "whatsapp",
        "event",
        "referral",
        "other",
      ],
      contact_direction: ["inbound", "outbound"],
      contract_type: [
        "clt",
        "pj",
        "internship",
        "temporary",
        "freelance",
        "other",
      ],
      document_kind: [
        "resume",
        "cover_letter",
        "certificate",
        "diploma",
        "linkedin_pdf",
        "offer",
        "portfolio",
        "other",
      ],
      duplicate_strategy: ["source_identity", "fingerprint", "fuzzy", "manual"],
      finding_severity: ["critical", "high", "medium", "low"],
      finding_status: ["pending", "applied", "ignored"],
      interview_kind: [
        "screening",
        "technical",
        "panel",
        "cultural",
        "final",
        "other",
      ],
      item_status: ["planned", "in_progress", "done", "dropped"],
      job_match_status: [
        "new",
        "seen",
        "saved",
        "dismissed",
        "sent_to_kanban",
        "blocked",
      ],
      learning_item_type: [
        "course",
        "book",
        "certification",
        "project",
        "practice",
        "other",
      ],
      linkedin_input_method: [
        "public_url",
        "pasted_text",
        "pdf_export",
        "manual_form",
      ],
      notification_channel: ["in_app", "email"],
      notification_type: [
        "new_jobs",
        "follow_up_due",
        "interview_soon",
        "certification_expiring",
        "source_degraded",
        "ai_cap_reached",
        "stale_application",
        "offer_deadline",
        "target_company_job",
      ],
      offer_status: [
        "draft",
        "received",
        "negotiating",
        "accepted",
        "declined",
        "expired",
      ],
      published_at_source: [
        "api_field",
        "page_metadata",
        "http_header",
        "source_relative",
        "first_seen",
      ],
      queue_status: ["pending", "processing", "done", "failed", "dead"],
      recruiter_activity_status: [
        "active_recent",
        "possibly_active",
        "no_activity_found",
      ],
      recruiter_activity_type: [
        "job_post",
        "recruiting_post",
        "hiring_comment",
        "direct_contact",
        "event",
        "generic_post",
        "profile_update",
        "user_observation",
      ],
      run_status: ["running", "success", "partial", "failed"],
      run_trigger: ["cron", "manual", "backfill"],
      salary_period: ["hour", "month", "year"],
      section_status: ["evaluated", "not_evaluable"],
      seniority_level: [
        "intern",
        "junior",
        "mid",
        "senior",
        "specialist",
        "lead",
        "manager",
      ],
      source_kind: [
        "official_api",
        "ats_public_api",
        "rss",
        "jsonld_page",
        "manual",
        "email_alert",
      ],
      source_legal_status: [
        "allowed",
        "review_needed",
        "disallowed",
        "requires_user_key",
      ],
      source_status: ["active", "paused", "degraded", "disabled"],
      work_model: ["onsite", "hybrid", "remote"],
    },
  },
} as const
