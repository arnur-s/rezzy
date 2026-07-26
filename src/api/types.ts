export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      channels: {
        Row: {
          api_version: string | null
          created_at: string
          id: string
          is_active: boolean
          last_error_at: string | null
          last_error_code: string | null
          last_outbound_at: string | null
          last_webhook_at: string | null
          name: string | null
          provider_account_id: string | null
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          api_version?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_error_at?: string | null
          last_error_code?: string | null
          last_outbound_at?: string | null
          last_webhook_at?: string | null
          name?: string | null
          provider_account_id?: string | null
          type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          api_version?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_error_at?: string | null
          last_error_code?: string | null
          last_outbound_at?: string | null
          last_webhook_at?: string | null
          name?: string | null
          provider_account_id?: string | null
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_channels: {
        Row: {
          channel_id: string | null
          channel_type: string
          contact_id: string
          created_at: string
          external_id: string
          external_name: string | null
          id: string
          metadata: Json
          profile: Json
          profile_synced_at: string | null
          workspace_id: string
        }
        Insert: {
          channel_id?: string | null
          channel_type: string
          contact_id: string
          created_at?: string
          external_id: string
          external_name?: string | null
          id?: string
          metadata?: Json
          profile?: Json
          profile_synced_at?: string | null
          workspace_id: string
        }
        Update: {
          channel_id?: string | null
          channel_type?: string
          contact_id?: string
          created_at?: string
          external_id?: string
          external_name?: string | null
          id?: string
          metadata?: Json
          profile?: Json
          profile_synced_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_channels_channel_ws_type_fk"
            columns: ["channel_id", "workspace_id", "channel_type"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id", "workspace_id", "type"]
          },
          {
            foreignKeyName: "contact_channels_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          last_seen_at: string | null
          name: string | null
          notes: string | null
          phone: string | null
          source: string | null
          status: string
          tags: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          last_read_message_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          last_read_message_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          last_read_message_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_reads_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_reads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_to: string | null
          channel_id: string
          contact_id: string
          created_at: string
          external_thread_id: string | null
          id: string
          last_inbound_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          snoozed_until: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          channel_id: string
          contact_id: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          snoozed_until?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          channel_id?: string
          contact_id?: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          snoozed_until?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          checksum: string | null
          created_at: string
          download_status: string
          duration_seconds: number | null
          failure_reason: string | null
          filename: string | null
          height: number | null
          id: string
          kind: string
          message_id: string
          metadata: Json
          mime_type: string | null
          position: number
          provider_media_id: string | null
          provider_media_unique_id: string | null
          size_bytes: number | null
          storage_bucket: string
          storage_path: string | null
          thumbnail_path: string | null
          width: number | null
          workspace_id: string
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          download_status?: string
          duration_seconds?: number | null
          failure_reason?: string | null
          filename?: string | null
          height?: number | null
          id?: string
          kind: string
          message_id: string
          metadata?: Json
          mime_type?: string | null
          position?: number
          provider_media_id?: string | null
          provider_media_unique_id?: string | null
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string | null
          thumbnail_path?: string | null
          width?: number | null
          workspace_id: string
        }
        Update: {
          checksum?: string | null
          created_at?: string
          download_status?: string
          duration_seconds?: number | null
          failure_reason?: string | null
          filename?: string | null
          height?: number | null
          id?: string
          kind?: string
          message_id?: string
          metadata?: Json
          mime_type?: string | null
          position?: number
          provider_media_id?: string | null
          provider_media_unique_id?: string | null
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string | null
          thumbnail_path?: string | null
          width?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_notifications: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          read_at: string | null
          recipient_id: string
          workspace_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          read_at?: string | null
          recipient_id: string
          workspace_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          read_at?: string | null
          recipient_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          action: string
          channel_id: string
          conversation_id: string | null
          created_at: string
          emoji: string
          id: string
          is_from_contact: boolean
          message_id: string | null
          metadata: Json
          provider_message_id: string
          provider_timestamp: string | null
          reactor_external_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action: string
          channel_id: string
          conversation_id?: string | null
          created_at?: string
          emoji: string
          id?: string
          is_from_contact?: boolean
          message_id?: string | null
          metadata?: Json
          provider_message_id: string
          provider_timestamp?: string | null
          reactor_external_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action?: string
          channel_id?: string
          conversation_id?: string | null
          created_at?: string
          emoji?: string
          id?: string
          is_from_contact?: boolean
          message_id?: string | null
          metadata?: Json
          provider_message_id?: string
          provider_timestamp?: string | null
          reactor_external_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      message_status_events: {
        Row: {
          created_at: string
          error_code: string | null
          error_subcode: string | null
          error_type: string | null
          id: string
          message_id: string
          metadata: Json
          provider_event_id: string | null
          provider_timestamp: string | null
          retryable: boolean | null
          status: string
          trace_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_subcode?: string | null
          error_type?: string | null
          id?: string
          message_id: string
          metadata?: Json
          provider_event_id?: string | null
          provider_timestamp?: string | null
          retryable?: boolean | null
          status: string
          trace_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_subcode?: string | null
          error_type?: string | null
          id?: string
          message_id?: string
          metadata?: Json
          provider_event_id?: string | null
          provider_timestamp?: string | null
          retryable?: boolean | null
          status?: string
          trace_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_status_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_status_events_provider_event_id_fkey"
            columns: ["provider_event_id"]
            isOneToOne: false
            referencedRelation: "provider_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_status_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          direction: string
          edited_at: string | null
          external_id: string | null
          external_reply_to_id: string | null
          id: string
          media_filename: string | null
          media_mime_type: string | null
          media_size: number | null
          media_url: string | null
          metadata: Json
          provider_timestamp: string | null
          reply_to_message_id: string | null
          sender_id: string | null
          status: string | null
          type: string
          workspace_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          direction: string
          edited_at?: string | null
          external_id?: string | null
          external_reply_to_id?: string | null
          id?: string
          media_filename?: string | null
          media_mime_type?: string | null
          media_size?: number | null
          media_url?: string | null
          metadata?: Json
          provider_timestamp?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          status?: string | null
          type?: string
          workspace_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          direction?: string
          edited_at?: string | null
          external_id?: string | null
          external_reply_to_id?: string | null
          id?: string
          media_filename?: string | null
          media_mime_type?: string | null
          media_size?: number | null
          media_url?: string | null
          metadata?: Json
          provider_timestamp?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          status?: string | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          desktop_enabled: boolean
          in_app_enabled: boolean
          preview_mode: string
          sound_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          desktop_enabled?: boolean
          in_app_enabled?: boolean
          preview_mode?: string
          sound_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          desktop_enabled?: boolean
          in_app_enabled?: boolean
          preview_mode?: string
          sound_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          job_title: string | null
          language: string
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          job_title?: string | null
          language?: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_title?: string | null
          language?: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_events: {
        Row: {
          attempts: number
          channel_id: string
          claimed_at: string | null
          created_at: string
          created_message_id: string | null
          created_record_ids: Json
          error_kind: string | null
          event_fingerprint: string
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          provider: string
          provider_timestamp: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          channel_id: string
          claimed_at?: string | null
          created_at?: string
          created_message_id?: string | null
          created_record_ids?: Json
          error_kind?: string | null
          event_fingerprint: string
          event_type: string
          id?: string
          last_error?: string | null
          payload: Json
          processed_at?: string | null
          provider: string
          provider_timestamp?: string | null
          status?: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          channel_id?: string
          claimed_at?: string | null
          created_at?: string
          created_message_id?: string | null
          created_record_ids?: Json
          error_kind?: string | null
          event_fingerprint?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_timestamp?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_events_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_events_created_message_id_fkey"
            columns: ["created_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
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
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_main: boolean
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_main?: boolean
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_main?: boolean
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      begin_instagram_oauth: {
        Args: { p_channel_id?: string; p_workspace_id: string }
        Returns: string
      }
      claim_provider_event: {
        Args: {
          p_channel_id: string
          p_event_fingerprint: string
          p_event_type: string
          p_payload: Json
          p_provider: string
          p_provider_timestamp?: string
          p_workspace_id: string
        }
        Returns: {
          duplicate: boolean
          event_id: string
        }[]
      }
      complete_onboarding: {
        Args: { p_workspace_name: string }
        Returns: {
          is_new: boolean
          workspace_id: string
        }[]
      }
      consume_oauth_state: {
        Args: { p_provider: string; p_state: string }
        Returns: {
          channel_id: string
          user_id: string
          workspace_id: string
        }[]
      }
      finalize_instagram_channel_connection: {
        Args: {
          p_channel_id: string
          p_credentials: Json
          p_name: string
          p_provider_account_id: string
        }
        Returns: undefined
      }
      get_channel_credentials: { Args: { p_channel_id: string }; Returns: Json }
      get_unread_counts_for_workspaces: {
        Args: { p_workspace_ids: string[] }
        Returns: {
          conversation_id: string
          unread_count: number
        }[]
      }
      get_whatsapp_channel_by_phone: {
        Args: { p_phone_number_id: string }
        Returns: {
          channel_id: string
          is_active: boolean
          workspace_id: string
        }[]
      }
      get_workspace_unread_counts: {
        Args: { p_workspace_id: string }
        Returns: {
          conversation_id: string
          unread_count: number
        }[]
      }
      is_workspace_member: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string; p_last_read_message_id?: string }
        Returns: undefined
      }
      mark_outbound_message_read: {
        Args: {
          p_channel_id: string
          p_external_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      resolve_instagram_conversation: {
        Args: {
          p_avatar_url?: string
          p_channel_id: string
          p_external_id: string
          p_external_name?: string
          p_name?: string
        }
        Returns: {
          contact_channel_id: string
          contact_id: string
          conversation_id: string
        }[]
      }
      soft_delete_workspace: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      upsert_channel_credentials: {
        Args: { p_channel_id: string; p_credentials: Json }
        Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

