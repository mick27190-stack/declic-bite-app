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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          postal_code: string
          street: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          postal_code: string
          street: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          postal_code?: string
          street?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_phones: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          phone: string
          role: Database["public"]["Enums"]["app_role"]
          site: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          phone: string
          role: Database["public"]["Enums"]["app_role"]
          site?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          phone?: string
          role?: Database["public"]["Enums"]["app_role"]
          site?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          created_at: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          customer_id: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          site: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          site: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          site?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          sender_type: string
          site: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_type: string
          site: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_type?: string
          site?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          site: string | null
          source: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          site?: string | null
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          site?: string | null
          source?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string | null
          id: string
          is_read: boolean
          reference_id: string | null
          site: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          reference_id?: string | null
          site: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          reference_id?: string | null
          site?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          delivery_address: Json | null
          delivery_estimate: string | null
          delivery_response: string | null
          id: string
          items: Json
          notes: string | null
          order_type: string
          pickup_time: string | null
          restaurant: string
          status: Database["public"]["Enums"]["order_status"]
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_address?: Json | null
          delivery_estimate?: string | null
          delivery_response?: string | null
          id?: string
          items: Json
          notes?: string | null
          order_type: string
          pickup_time?: string | null
          restaurant: string
          status?: Database["public"]["Enums"]["order_status"]
          total_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delivery_address?: Json | null
          delivery_estimate?: string | null
          delivery_response?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_type?: string
          pickup_time?: string | null
          restaurant?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          preferred_restaurant: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          preferred_restaurant?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          preferred_restaurant?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          site: string | null
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          site?: string | null
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          site?: string | null
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      restaurant_closures: {
        Row: {
          created_at: string
          created_by: string
          end_at: string | null
          id: string
          is_active: boolean
          reason: string
          site: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string
          site: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string
          site?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_admin_access_order: {
        Args: { _restaurant: string; _user_id: string }
        Returns: boolean
      }
      can_admin_access_site: {
        Args: { _site: string; _user_id: string }
        Returns: boolean
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_any_admin: { Args: { _user_id: string }; Returns: boolean }
      is_pizzeria_open: { Args: never; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      restaurant_to_site: { Args: { _restaurant: string }; Returns: string }
      should_receive_site_notification: {
        Args: { _category?: string; _site: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "site_admin_conches"
        | "site_admin_beaumont"
        | "secondary_admin_conches"
        | "secondary_admin_beaumont"
        | "user"
        | "secondary_super_admin"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready"
        | "delivered"
        | "cancelled"
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
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "site_admin_conches",
        "site_admin_beaumont",
        "secondary_admin_conches",
        "secondary_admin_beaumont",
        "user",
        "secondary_super_admin",
      ],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
