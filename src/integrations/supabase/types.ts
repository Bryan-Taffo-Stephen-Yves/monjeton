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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assistant_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      assistant_memory: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_role?: string
          user_id?: string
        }
        Relationships: []
      }
      brvm_cache: {
        Row: {
          data: Json
          fetched_at: string
          id: number
        }
        Insert: {
          data: Json
          fetched_at?: string
          id?: never
        }
        Update: {
          data?: Json
          fetched_at?: string
          id?: never
        }
        Relationships: []
      }
      budget_alerts_sent: {
        Row: {
          alert_type: string
          category_id: string | null
          id: string
          month: number
          sent_at: string
          user_id: string
          year: number
        }
        Insert: {
          alert_type: string
          category_id?: string | null
          id?: string
          month: number
          sent_at?: string
          user_id: string
          year: number
        }
        Update: {
          alert_type?: string
          category_id?: string | null
          id?: string
          month?: number
          sent_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      budget_coaching: {
        Row: {
          charges_fixes: Json | null
          conseils_par_categorie: Json | null
          created_at: string
          current_step: number | null
          dettes_details: Json | null
          dettes_mois: number | null
          habitude_depense: string | null
          id: string
          modified_categories: Json | null
          mois_special: string | null
          mois_special_note: string | null
          month: number
          nb_personnes: number | null
          objectifs: Json | null
          plan_genere: Json | null
          revenu_exceptionnel: number | null
          revenu_exceptionnel_source: string | null
          revenu_principal: number | null
          revenu_type: string | null
          situation_familiale: string | null
          statut: string | null
          updated_at: string
          user_id: string
          validated_categories: Json | null
          whatsapp_notifications: boolean | null
          year: number
        }
        Insert: {
          charges_fixes?: Json | null
          conseils_par_categorie?: Json | null
          created_at?: string
          current_step?: number | null
          dettes_details?: Json | null
          dettes_mois?: number | null
          habitude_depense?: string | null
          id?: string
          modified_categories?: Json | null
          mois_special?: string | null
          mois_special_note?: string | null
          month: number
          nb_personnes?: number | null
          objectifs?: Json | null
          plan_genere?: Json | null
          revenu_exceptionnel?: number | null
          revenu_exceptionnel_source?: string | null
          revenu_principal?: number | null
          revenu_type?: string | null
          situation_familiale?: string | null
          statut?: string | null
          updated_at?: string
          user_id: string
          validated_categories?: Json | null
          whatsapp_notifications?: boolean | null
          year: number
        }
        Update: {
          charges_fixes?: Json | null
          conseils_par_categorie?: Json | null
          created_at?: string
          current_step?: number | null
          dettes_details?: Json | null
          dettes_mois?: number | null
          habitude_depense?: string | null
          id?: string
          modified_categories?: Json | null
          mois_special?: string | null
          mois_special_note?: string | null
          month?: number
          nb_personnes?: number | null
          objectifs?: Json | null
          plan_genere?: Json | null
          revenu_exceptionnel?: number | null
          revenu_exceptionnel_source?: string | null
          revenu_principal?: number | null
          revenu_type?: string | null
          situation_familiale?: string | null
          statut?: string | null
          updated_at?: string
          user_id?: string
          validated_categories?: Json | null
          whatsapp_notifications?: boolean | null
          year?: number
        }
        Relationships: []
      }
      budget_plan_history: {
        Row: {
          action: string
          ai_suggestion: Json | null
          amount_after: number | null
          amount_before: number | null
          applied: boolean | null
          category_name: string | null
          coaching_id: string
          created_at: string
          difference: number | null
          id: string
          month: number
          user_id: string
          year: number
        }
        Insert: {
          action: string
          ai_suggestion?: Json | null
          amount_after?: number | null
          amount_before?: number | null
          applied?: boolean | null
          category_name?: string | null
          coaching_id: string
          created_at?: string
          difference?: number | null
          id?: string
          month: number
          user_id: string
          year: number
        }
        Update: {
          action?: string
          ai_suggestion?: Json | null
          amount_after?: number | null
          amount_before?: number | null
          applied?: boolean | null
          category_name?: string | null
          coaching_id?: string
          created_at?: string
          difference?: number | null
          id?: string
          month?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_plan_history_coaching_id_fkey"
            columns: ["coaching_id"]
            isOneToOne: false
            referencedRelation: "budget_coaching"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          id: string
          month: number
          total_budget: number
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          total_budget?: number
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          total_budget?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      caisse_collaborators: {
        Row: {
          caisse_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          caisse_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          caisse_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caisse_collaborators_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "tontines"
            referencedColumns: ["id"]
          },
        ]
      }
      caisse_cotisations: {
        Row: {
          amount: number
          caisse_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          cotisation_date: string
          created_at: string
          cycle_label: string | null
          id: string
          member_id: string
          note: string | null
          status: string
        }
        Insert: {
          amount: number
          caisse_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cotisation_date?: string
          created_at?: string
          cycle_label?: string | null
          id?: string
          member_id: string
          note?: string | null
          status?: string
        }
        Update: {
          amount?: number
          caisse_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          cotisation_date?: string
          created_at?: string
          cycle_label?: string | null
          id?: string
          member_id?: string
          note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "caisse_cotisations_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caisse_cotisations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "caisse_members"
            referencedColumns: ["id"]
          },
        ]
      }
      caisse_depenses: {
        Row: {
          amount: number
          beneficiaire: string | null
          caisse_id: string
          category: string | null
          created_at: string
          depense_date: string
          id: string
          label: string
          note: string | null
        }
        Insert: {
          amount: number
          beneficiaire?: string | null
          caisse_id: string
          category?: string | null
          created_at?: string
          depense_date?: string
          id?: string
          label: string
          note?: string | null
        }
        Update: {
          amount?: number
          beneficiaire?: string | null
          caisse_id?: string
          category?: string | null
          created_at?: string
          depense_date?: string
          id?: string
          label?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caisse_depenses_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
        ]
      }
      caisse_invites: {
        Row: {
          caisse_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          role: string
          token: string
          uses_count: number
        }
        Insert: {
          caisse_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          role?: string
          token?: string
          uses_count?: number
        }
        Update: {
          caisse_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          role?: string
          token?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "caisse_invites_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "tontines"
            referencedColumns: ["id"]
          },
        ]
      }
      caisse_member_history: {
        Row: {
          action: string
          caisse_id: string
          created_at: string
          id: string
          member_id: string
          performed_by: string
          reason: string | null
        }
        Insert: {
          action: string
          caisse_id: string
          created_at?: string
          id?: string
          member_id: string
          performed_by: string
          reason?: string | null
        }
        Update: {
          action?: string
          caisse_id?: string
          created_at?: string
          id?: string
          member_id?: string
          performed_by?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caisse_member_history_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caisse_member_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "caisse_members"
            referencedColumns: ["id"]
          },
        ]
      }
      caisse_members: {
        Row: {
          caisse_id: string
          created_at: string
          id: string
          name: string
          phone: string | null
          status: string
        }
        Insert: {
          caisse_id: string
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          status?: string
        }
        Update: {
          caisse_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "caisse_members_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
        ]
      }
      caisse_recettes: {
        Row: {
          amount: number
          caisse_id: string
          contact: string | null
          created_at: string
          id: string
          label: string
          note: string | null
          prix_unitaire: number | null
          quantite: number | null
          quantite_prevue: number | null
          recette_date: string
          source: string
        }
        Insert: {
          amount: number
          caisse_id: string
          contact?: string | null
          created_at?: string
          id?: string
          label: string
          note?: string | null
          prix_unitaire?: number | null
          quantite?: number | null
          quantite_prevue?: number | null
          recette_date?: string
          source?: string
        }
        Update: {
          amount?: number
          caisse_id?: string
          contact?: string | null
          created_at?: string
          id?: string
          label?: string
          note?: string | null
          prix_unitaire?: number | null
          quantite?: number | null
          quantite_prevue?: number | null
          recette_date?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "caisse_recettes_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
        ]
      }
      caisses: {
        Row: {
          contribution_amount: number
          created_at: string
          description: string | null
          frequency: string
          id: string
          name: string
          total_collected: number
          total_recettes: number
          total_spent: number
          user_id: string
        }
        Insert: {
          contribution_amount?: number
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          name: string
          total_collected?: number
          total_recettes?: number
          total_spent?: number
          user_id: string
        }
        Update: {
          contribution_amount?: number
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          name?: string
          total_collected?: number
          total_recettes?: number
          total_spent?: number
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          type: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          type: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          type?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      category_budgets: {
        Row: {
          budget_amount: number
          category_id: string
          created_at: string
          id: string
          month: number
          user_id: string
          year: number
        }
        Insert: {
          budget_amount?: number
          category_id: string
          created_at?: string
          id?: string
          month: number
          user_id: string
          year: number
        }
        Update: {
          budget_amount?: number
          category_id?: string
          created_at?: string
          id?: string
          month?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chariow_processed_sales: {
        Row: {
          processed_at: string
          sale_id: string
        }
        Insert: {
          processed_at?: string
          sale_id: string
        }
        Update: {
          processed_at?: string
          sale_id?: string
        }
        Relationships: []
      }
      daily_reminders: {
        Row: {
          date: string
          id: string
          reminded_at: string
          transactions_count: number
          user_id: string
          user_responded: boolean
        }
        Insert: {
          date?: string
          id?: string
          reminded_at?: string
          transactions_count?: number
          user_id: string
          user_responded?: boolean
        }
        Update: {
          date?: string
          id?: string
          reminded_at?: string
          transactions_count?: number
          user_id?: string
          user_responded?: boolean
        }
        Relationships: []
      }
      debt_history: {
        Row: {
          action: string
          amount: number | null
          created_at: string
          debt_id: string
          field: string | null
          id: string
          new_value: string | null
          note: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          action: string
          amount?: number | null
          created_at?: string
          debt_id: string
          field?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          action?: string
          amount?: number | null
          created_at?: string
          debt_id?: string
          field?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: []
      }
      debt_installments: {
        Row: {
          created_at: string
          debt_id: string
          due_date: string
          expected_amount: number
          id: string
          installment_number: number | null
          note: string | null
          order_index: number
          paid_amount: number
          paid_date: string | null
          reminder_sent: boolean
          reminder_sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debt_id: string
          due_date: string
          expected_amount?: number
          id?: string
          installment_number?: number | null
          note?: string | null
          order_index?: number
          paid_amount?: number
          paid_date?: string | null
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          debt_id?: string
          due_date?: string
          expected_amount?: number
          id?: string
          installment_number?: number | null
          note?: string | null
          order_index?: number
          paid_amount?: number
          paid_date?: string | null
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          debt_id: string
          id: string
          installment_id: string | null
          note: string | null
          payment_date: string
          payment_method: string | null
          proof_url: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          debt_id: string
          id?: string
          installment_id?: string | null
          note?: string | null
          payment_date?: string
          payment_method?: string | null
          proof_url?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          debt_id?: string
          id?: string
          installment_id?: string | null
          note?: string | null
          payment_date?: string
          payment_method?: string | null
          proof_url?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "debt_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_persons: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          photo_uri: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          photo_uri?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          photo_uri?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      debts: {
        Row: {
          amount: number
          amount_remaining: number | null
          created_at: string
          date_echeance: string | null
          due_date: string | null
          id: string
          installments_paid: number | null
          installments_total: number | null
          monthly_amount: number | null
          monthly_day: number | null
          motif: string | null
          note: string | null
          paid_amount: number
          payment_type: string | null
          person_id: string | null
          person_name: string
          preuve_storage_path: string | null
          preuve_url: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          amount: number
          amount_remaining?: number | null
          created_at?: string
          date_echeance?: string | null
          due_date?: string | null
          id?: string
          installments_paid?: number | null
          installments_total?: number | null
          monthly_amount?: number | null
          monthly_day?: number | null
          motif?: string | null
          note?: string | null
          paid_amount?: number
          payment_type?: string | null
          person_id?: string | null
          person_name: string
          preuve_storage_path?: string | null
          preuve_url?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          amount?: number
          amount_remaining?: number | null
          created_at?: string
          date_echeance?: string | null
          due_date?: string | null
          id?: string
          installments_paid?: number | null
          installments_total?: number | null
          monthly_amount?: number | null
          monthly_day?: number | null
          motif?: string | null
          note?: string | null
          paid_amount?: number
          payment_type?: string | null
          person_id?: string | null
          person_name?: string
          preuve_storage_path?: string | null
          preuve_url?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "debt_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_scores: {
        Row: {
          created_at: string
          id: string
          insights: Json
          score: number
          tip_of_week: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insights?: Json
          score?: number
          tip_of_week?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insights?: Json
          score?: number
          tip_of_week?: string | null
          user_id?: string
        }
        Relationships: []
      }
      jeko_payments: {
        Row: {
          activated: boolean
          amount: number | null
          created_at: string
          id: string
          matched_user_id: string | null
          payment_link_id: string | null
          phone: string | null
          plan_name: string | null
          raw_amount: number | null
          raw_payload: Json | null
          reference: string | null
          txn_id: string | null
        }
        Insert: {
          activated?: boolean
          amount?: number | null
          created_at?: string
          id?: string
          matched_user_id?: string | null
          payment_link_id?: string | null
          phone?: string | null
          plan_name?: string | null
          raw_amount?: number | null
          raw_payload?: Json | null
          reference?: string | null
          txn_id?: string | null
        }
        Update: {
          activated?: boolean
          amount?: number | null
          created_at?: string
          id?: string
          matched_user_id?: string | null
          payment_link_id?: string | null
          phone?: string | null
          plan_name?: string | null
          raw_amount?: number | null
          raw_payload?: Json | null
          reference?: string | null
          txn_id?: string | null
        }
        Relationships: []
      }
      monthly_badges: {
        Row: {
          badge_id: string
          created_at: string
          id: string
          month: number
          user_id: string
          year: number
        }
        Insert: {
          badge_id: string
          created_at?: string
          id?: string
          month: number
          user_id: string
          year: number
        }
        Update: {
          badge_id?: string
          created_at?: string
          id?: string
          month?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      monthly_summaries: {
        Row: {
          assistant_summary: string | null
          created_at: string
          estimated_savings: number | null
          id: string
          month: number
          total_income: number | null
          total_spent: number | null
          user_id: string
          year: number
        }
        Insert: {
          assistant_summary?: string | null
          created_at?: string
          estimated_savings?: number | null
          id?: string
          month: number
          total_income?: number | null
          total_spent?: number | null
          user_id: string
          year: number
        }
        Update: {
          assistant_summary?: string | null
          created_at?: string
          estimated_savings?: number | null
          id?: string
          month?: number
          total_income?: number | null
          total_spent?: number | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          claimed_at: string | null
          created_at: string
          id: string
          payer_email: string | null
          payer_phone: string | null
          plan_name: string
          status: string
          txn_id: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          payer_email?: string | null
          payer_phone?: string | null
          plan_name?: string
          status?: string
          txn_id: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          id?: string
          payer_email?: string | null
          payer_phone?: string | null
          plan_name?: string
          status?: string
          txn_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pending_pro_emails: {
        Row: {
          applied_at: string | null
          chariow_sale_id: string | null
          created_at: string
          email: string
          id: string
          plan_name: string
          source: string | null
        }
        Insert: {
          applied_at?: string | null
          chariow_sale_id?: string | null
          created_at?: string
          email: string
          id?: string
          plan_name?: string
          source?: string | null
        }
        Update: {
          applied_at?: string | null
          chariow_sale_id?: string | null
          created_at?: string
          email?: string
          id?: string
          plan_name?: string
          source?: string | null
        }
        Relationships: []
      }
      prediction_snapshots: {
        Row: {
          accuracy_pct: number | null
          actual_amount: number | null
          budget_amount: number | null
          category: string
          created_at: string | null
          id: string
          month: number
          predicted_amount: number
          user_id: string
          year: number
        }
        Insert: {
          accuracy_pct?: number | null
          actual_amount?: number | null
          budget_amount?: number | null
          category: string
          created_at?: string | null
          id?: string
          month: number
          predicted_amount?: number
          user_id: string
          year: number
        }
        Update: {
          accuracy_pct?: number | null
          actual_amount?: number | null
          budget_amount?: number | null
          category?: string
          created_at?: string | null
          id?: string
          month?: number
          predicted_amount?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      pro_activation_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          plan: string
          sale_id: string | null
          token: string
          used: boolean
          used_at: string | null
          used_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          plan?: string
          sale_id?: string | null
          token: string
          used?: boolean
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          plan?: string
          sale_id?: string | null
          token?: string
          used?: boolean
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          beauty_budget_range: string | null
          country: string | null
          created_at: string
          currency_preference: string
          dependents_count: number | null
          email: string | null
          financial_goal: string | null
          full_name: string | null
          gender: string | null
          has_employees: boolean | null
          id: string
          income_range: string | null
          living_situation: string | null
          main_expense: string | null
          merchant_mode: boolean
          onboarding_completed: boolean
          phone: string | null
          profile_type: string | null
          subscriptions: string[] | null
          updated_at: string
          user_id: string
          whatsapp_alerts: boolean
        }
        Insert: {
          beauty_budget_range?: string | null
          country?: string | null
          created_at?: string
          currency_preference?: string
          dependents_count?: number | null
          email?: string | null
          financial_goal?: string | null
          full_name?: string | null
          gender?: string | null
          has_employees?: boolean | null
          id?: string
          income_range?: string | null
          living_situation?: string | null
          main_expense?: string | null
          merchant_mode?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          profile_type?: string | null
          subscriptions?: string[] | null
          updated_at?: string
          user_id: string
          whatsapp_alerts?: boolean
        }
        Update: {
          beauty_budget_range?: string | null
          country?: string | null
          created_at?: string
          currency_preference?: string
          dependents_count?: number | null
          email?: string | null
          financial_goal?: string | null
          full_name?: string | null
          gender?: string | null
          has_employees?: boolean | null
          id?: string
          income_range?: string | null
          living_situation?: string | null
          main_expense?: string | null
          merchant_mode?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          profile_type?: string | null
          subscriptions?: string[] | null
          updated_at?: string
          user_id?: string
          whatsapp_alerts?: boolean
        }
        Relationships: []
      }
      push_notifications_log: {
        Row: {
          created_at: string
          dedup_key: string
          id: string
          notification_type: string
          sent_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedup_key: string
          id?: string
          notification_type: string
          sent_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedup_key?: string
          id?: string
          notification_type?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          disabled_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          disabled_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          disabled_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          called_at: string
          endpoint: string
          id: string
          user_id: string | null
        }
        Insert: {
          called_at?: string
          endpoint: string
          id?: string
          user_id?: string | null
        }
        Update: {
          called_at?: string
          endpoint?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      receipt_duplicates: {
        Row: {
          created_at: string
          dismissed: boolean | null
          id: string
          scan_id_1: string | null
          scan_id_2: string | null
          similarity_score: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dismissed?: boolean | null
          id?: string
          scan_id_1?: string | null
          scan_id_2?: string | null
          similarity_score?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dismissed?: boolean | null
          id?: string
          scan_id_1?: string | null
          scan_id_2?: string | null
          similarity_score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_duplicates_scan_id_1_fkey"
            columns: ["scan_id_1"]
            isOneToOne: false
            referencedRelation: "receipt_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_duplicates_scan_id_2_fkey"
            columns: ["scan_id_2"]
            isOneToOne: false
            referencedRelation: "receipt_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_scan_history: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_field: string
          id: string
          new_value: string | null
          old_value: string | null
          scan_id: string
          user_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          scan_id: string
          user_id: string
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          scan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_scan_history_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "receipt_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_scans: {
        Row: {
          created_at: string
          extracted_text: string | null
          id: string
          image_url: string | null
          parsed_amount: number | null
          parsed_category: string | null
          parsed_converted_amount_xof: number | null
          parsed_currency: string | null
          parsed_date: string | null
          parsed_exchange_rate_source: string | null
          parsed_exchange_rate_used: number | null
          parsed_merchant: string | null
          parsed_original_amount: number | null
          parsed_type: string | null
          parsed_wallet: string | null
          scan_type: string
          status: string
          storage_path: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          image_url?: string | null
          parsed_amount?: number | null
          parsed_category?: string | null
          parsed_converted_amount_xof?: number | null
          parsed_currency?: string | null
          parsed_date?: string | null
          parsed_exchange_rate_source?: string | null
          parsed_exchange_rate_used?: number | null
          parsed_merchant?: string | null
          parsed_original_amount?: number | null
          parsed_type?: string | null
          parsed_wallet?: string | null
          scan_type?: string
          status?: string
          storage_path?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          image_url?: string | null
          parsed_amount?: number | null
          parsed_category?: string | null
          parsed_converted_amount_xof?: number | null
          parsed_currency?: string | null
          parsed_date?: string | null
          parsed_exchange_rate_source?: string | null
          parsed_exchange_rate_used?: number | null
          parsed_merchant?: string | null
          parsed_original_amount?: number | null
          parsed_type?: string | null
          parsed_wallet?: string | null
          scan_type?: string
          status?: string
          storage_path?: string | null
          user_id?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          category: string | null
          created_at: string
          currency: string | null
          id: string
          image_base64: string | null
          image_path: string | null
          items: Json | null
          merchant_name: string | null
          note: string | null
          raw_data: Json | null
          receipt_date: string | null
          status: string
          total_amount: number | null
          transaction_id: string | null
          type: string | null
          user_id: string
          wallet: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          image_base64?: string | null
          image_path?: string | null
          items?: Json | null
          merchant_name?: string | null
          note?: string | null
          raw_data?: Json | null
          receipt_date?: string | null
          status?: string
          total_amount?: number | null
          transaction_id?: string | null
          type?: string | null
          user_id: string
          wallet?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          image_base64?: string | null
          image_path?: string | null
          items?: Json | null
          merchant_name?: string | null
          note?: string | null
          raw_data?: Json | null
          receipt_date?: string | null
          status?: string
          total_amount?: number | null
          transaction_id?: string | null
          type?: string | null
          user_id?: string
          wallet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_deposits: {
        Row: {
          amount: number
          created_at: string
          id: string
          savings_goal_id: string
          transaction_id: string | null
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          savings_goal_id: string
          transaction_id?: string | null
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          savings_goal_id?: string
          transaction_id?: string | null
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_deposits_savings_goal_id_fkey"
            columns: ["savings_goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_deposits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "savings_deposits_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          created_at: string
          currency: string
          current_amount: number
          deadline: string | null
          emoji: string
          id: string
          name: string
          note: string | null
          target_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          current_amount?: number
          deadline?: string | null
          emoji?: string
          id?: string
          name: string
          note?: string | null
          target_amount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_amount?: number
          deadline?: string | null
          emoji?: string
          id?: string
          name?: string
          note?: string | null
          target_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          activated_at: string | null
          created_at: string
          expires_at: string | null
          grace_until: string | null
          id: string
          last_reminder_sent: string | null
          plan_name: string | null
          price_xof: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          expires_at?: string | null
          grace_until?: string | null
          id?: string
          last_reminder_sent?: string | null
          plan_name?: string | null
          price_xof?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          expires_at?: string | null
          grace_until?: string | null
          id?: string
          last_reminder_sent?: string | null
          plan_name?: string | null
          price_xof?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      tontine_cycles: {
        Row: {
          created_at: string
          cycle_number: number
          end_date: string
          id: string
          period_label: string
          start_date: string
          status: string
          tontine_id: string
          total_collected: number
          total_expected: number
        }
        Insert: {
          created_at?: string
          cycle_number: number
          end_date: string
          id?: string
          period_label: string
          start_date: string
          status?: string
          tontine_id: string
          total_collected?: number
          total_expected?: number
        }
        Update: {
          created_at?: string
          cycle_number?: number
          end_date?: string
          id?: string
          period_label?: string
          start_date?: string
          status?: string
          tontine_id?: string
          total_collected?: number
          total_expected?: number
        }
        Relationships: [
          {
            foreignKeyName: "tontine_cycles_tontine_id_fkey"
            columns: ["tontine_id"]
            isOneToOne: false
            referencedRelation: "tontines"
            referencedColumns: ["id"]
          },
        ]
      }
      tontine_expense_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          planned_amount: number
          tontine_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          planned_amount?: number
          tontine_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          planned_amount?: number
          tontine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tontine_expense_items_tontine_id_fkey"
            columns: ["tontine_id"]
            isOneToOne: false
            referencedRelation: "tontines"
            referencedColumns: ["id"]
          },
        ]
      }
      tontine_expenses: {
        Row: {
          amount: number
          beneficiaire: string | null
          category: string | null
          created_at: string
          expense_date: string
          expense_item_id: string | null
          id: string
          label: string
          note: string | null
          tontine_id: string
        }
        Insert: {
          amount: number
          beneficiaire?: string | null
          category?: string | null
          created_at?: string
          expense_date?: string
          expense_item_id?: string | null
          id?: string
          label: string
          note?: string | null
          tontine_id: string
        }
        Update: {
          amount?: number
          beneficiaire?: string | null
          category?: string | null
          created_at?: string
          expense_date?: string
          expense_item_id?: string | null
          id?: string
          label?: string
          note?: string | null
          tontine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tontine_expenses_expense_item_id_fkey"
            columns: ["expense_item_id"]
            isOneToOne: false
            referencedRelation: "tontine_expense_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tontine_expenses_tontine_id_fkey"
            columns: ["tontine_id"]
            isOneToOne: false
            referencedRelation: "tontines"
            referencedColumns: ["id"]
          },
        ]
      }
      tontine_member_history: {
        Row: {
          action: string
          created_at: string
          id: string
          member_id: string | null
          note: string | null
          performed_by: string | null
          tontine_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          member_id?: string | null
          note?: string | null
          performed_by?: string | null
          tontine_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          member_id?: string | null
          note?: string | null
          performed_by?: string | null
          tontine_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tontine_member_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tontine_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tontine_member_history_tontine_id_fkey"
            columns: ["tontine_id"]
            isOneToOne: false
            referencedRelation: "tontines"
            referencedColumns: ["id"]
          },
        ]
      }
      tontine_members: {
        Row: {
          created_at: string
          id: string
          is_owner: boolean
          name: string
          phone: string | null
          role: string
          status: string
          tontine_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_owner?: boolean
          name: string
          phone?: string | null
          role?: string
          status?: string
          tontine_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_owner?: boolean
          name?: string
          phone?: string | null
          role?: string
          status?: string
          tontine_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tontine_members_tontine_id_fkey"
            columns: ["tontine_id"]
            isOneToOne: false
            referencedRelation: "tontines"
            referencedColumns: ["id"]
          },
        ]
      }
      tontine_notifications: {
        Row: {
          canal: string
          envoye_at: string
          id: string
          membre_id: string | null
          message: string
          statut: string
          tontine_id: string
          type: string
        }
        Insert: {
          canal?: string
          envoye_at?: string
          id?: string
          membre_id?: string | null
          message: string
          statut?: string
          tontine_id: string
          type: string
        }
        Update: {
          canal?: string
          envoye_at?: string
          id?: string
          membre_id?: string | null
          message?: string
          statut?: string
          tontine_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tontine_notifications_membre_id_fkey"
            columns: ["membre_id"]
            isOneToOne: false
            referencedRelation: "tontine_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tontine_notifications_tontine_id_fkey"
            columns: ["tontine_id"]
            isOneToOne: false
            referencedRelation: "tontines"
            referencedColumns: ["id"]
          },
        ]
      }
      tontine_payments: {
        Row: {
          amount_paid: number
          created_at: string
          cycle_id: string
          expense_item_id: string | null
          id: string
          member_id: string
          note: string | null
          payment_date: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          cycle_id: string
          expense_item_id?: string | null
          id?: string
          member_id: string
          note?: string | null
          payment_date?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          cycle_id?: string
          expense_item_id?: string | null
          id?: string
          member_id?: string
          note?: string | null
          payment_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "tontine_payments_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "tontine_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tontine_payments_expense_item_id_fkey"
            columns: ["expense_item_id"]
            isOneToOne: false
            referencedRelation: "tontine_expense_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tontine_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "tontine_members"
            referencedColumns: ["id"]
          },
        ]
      }
      tontines: {
        Row: {
          caisse_type: string
          contribution_amount: number
          contribution_per_member: number | null
          created_at: string
          custom_frequency_days: number | null
          end_date: string | null
          event_date: string | null
          frequency: string
          id: string
          is_closed: boolean
          name: string
          start_date: string
          status: string
          target_amount: number | null
          user_id: string
        }
        Insert: {
          caisse_type?: string
          contribution_amount?: number
          contribution_per_member?: number | null
          created_at?: string
          custom_frequency_days?: number | null
          end_date?: string | null
          event_date?: string | null
          frequency?: string
          id?: string
          is_closed?: boolean
          name: string
          start_date?: string
          status?: string
          target_amount?: number | null
          user_id: string
        }
        Update: {
          caisse_type?: string
          contribution_amount?: number
          contribution_per_member?: number | null
          created_at?: string
          custom_frequency_days?: number | null
          end_date?: string | null
          event_date?: string | null
          frequency?: string
          id?: string
          is_closed?: boolean
          name?: string
          start_date?: string
          status?: string
          target_amount?: number | null
          user_id?: string
        }
        Relationships: []
      }
      transaction_attachments: {
        Row: {
          created_at: string
          created_by: string
          file_type: string
          file_url: string
          id: string
          transaction_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          file_type?: string
          file_url: string
          id?: string
          transaction_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          file_type?: string
          file_url?: string
          id?: string
          transaction_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          conversion_date: string | null
          converted_amount_xof: number | null
          created_at: string
          created_by: string | null
          date: string
          exchange_rate_source: string | null
          exchange_rate_used: number | null
          id: string
          merchant_name: string | null
          note: string | null
          original_amount: number | null
          original_currency: string | null
          scope: string
          source: string
          status: string
          type: string
          user_id: string
          wallet_id: string | null
          workspace_id: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          conversion_date?: string | null
          converted_amount_xof?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          exchange_rate_source?: string | null
          exchange_rate_used?: number | null
          id?: string
          merchant_name?: string | null
          note?: string | null
          original_amount?: number | null
          original_currency?: string | null
          scope?: string
          source?: string
          status?: string
          type: string
          user_id: string
          wallet_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          conversion_date?: string | null
          converted_amount_xof?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          exchange_rate_source?: string | null
          exchange_rate_used?: number | null
          id?: string
          merchant_name?: string | null
          note?: string | null
          original_amount?: number | null
          original_currency?: string | null
          scope?: string
          source?: string
          status?: string
          type?: string
          user_id?: string
          wallet_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pins: {
        Row: {
          failed_attempts: number
          locked_until: string | null
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          failed_attempts?: number
          locked_until?: string | null
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          created_at: string
          currency: string
          id: string
          initial_balance: number
          user_id: string
          wallet_name: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          initial_balance?: number
          user_id: string
          wallet_name: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          initial_balance?: number
          user_id?: string
          wallet_name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_chat_messages: {
        Row: {
          content: string | null
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          message_type: string
          room_id: string
          sender_display_name: string
          sender_id: string
          sender_role: string
          workspace_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          room_id: string
          sender_display_name: string
          sender_id: string
          sender_role?: string
          workspace_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          room_id?: string
          sender_display_name?: string
          sender_id?: string
          sender_role?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "workspace_chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_chat_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_chat_rooms: {
        Row: {
          created_at: string
          id: string
          transaction_id: string | null
          type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          transaction_id?: string | null
          type?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          transaction_id?: string | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_chat_rooms_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_chat_rooms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          invite_code: string
          invite_link_token: string
          status: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code?: string
          invite_link_token?: string
          status?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          email?: string | null
          expires_at?: string
          id?: string
          invite_code?: string
          invite_link_token?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          avatar_url: string | null
          display_name: string
          id: string
          joined_at: string
          member_color: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          display_name: string
          id?: string
          joined_at?: string
          member_color?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string
          id?: string
          joined_at?: string
          member_color?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          default_currency: string
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_currency?: string
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_currency?: string
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_activate_payment: {
        Args: { _email: string; _txn_id: string }
        Returns: Json
      }
      claim_pending_payment: { Args: never; Returns: Json }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      clear_user_pin: { Args: never; Returns: undefined }
      get_invite_by_token: {
        Args: { _token: string }
        Returns: {
          created_at: string
          created_by: string
          email: string | null
          expires_at: string
          id: string
          invite_code: string
          invite_link_token: string
          status: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "workspace_invites"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_active_pro: { Args: { _user_id: string }; Returns: boolean }
      free_limit: {
        Args: { _feature: string }
        Returns: number
      }
      consume_feature: {
        Args: { _feature: string; _user_id: string }
        Returns: Json
      }
      monthly_usage: {
        Args: { _user_id?: string }
        Returns: {
          feature: string
          free_limit: number
          resets_at: string
          unlimited: boolean
          used: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workspace_role: {
        Args: {
          _roles: Database["public"]["Enums"]["workspace_role"][]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      is_caisse_collaborator: {
        Args: { _caisse_id: string; _min_role?: string }
        Returns: boolean
      }
      is_tontine_owner: {
        Args: { p_tontine_id: string; p_user_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      join_caisse_via_token: { Args: { _token: string }; Returns: Json }
      mark_overdue_installments: { Args: never; Returns: undefined }
      preview_caisse_invite: { Args: { _token: string }; Returns: Json }
      recalculate_cycle_collected: {
        Args: { p_cycle_id: string }
        Returns: undefined
      }
      recalculate_cycle_expected: {
        Args: { p_contribution: number; p_cycle_id: string }
        Returns: undefined
      }
      set_user_pin: { Args: { _pin_hash: string }; Returns: undefined }
      transfer_caisse_ownership: {
        Args: { _caisse_id: string; _new_owner: string }
        Returns: Json
      }
      user_pin_status: {
        Args: never
        Returns: {
          has_pin: boolean
          locked_seconds: number
        }[]
      }
      verify_user_pin: {
        Args: { _pin_hash: string }
        Returns: {
          attempts: number
          locked_seconds: number
          success: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      workspace_role: "owner" | "admin" | "accountant" | "member" | "viewer"
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
      app_role: ["admin", "user"],
      workspace_role: ["owner", "admin", "accountant", "member", "viewer"],
    },
  },
} as const
