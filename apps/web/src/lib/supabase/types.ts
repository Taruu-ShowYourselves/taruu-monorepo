/**
 * Supabase Database Types
 * Auto-generated types should be regenerated with:
 * npx supabase gen types typescript --project-id <project-id> > types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          municipality_id: string | null;
          did: string | null;
          did_public_key: string | null;
          did_encrypted_private_key: string | null;
          google_id: string | null;
          avatar_url: string | null;
          identity_score: number;
          verification_status: 'none' | 'pending' | 'verified' | 'failed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          municipality_id?: string | null;
          did?: string | null;
          did_public_key?: string | null;
          did_encrypted_private_key?: string | null;
          google_id?: string | null;
          avatar_url?: string | null;
          identity_score?: number;
          verification_status?: 'none' | 'pending' | 'verified' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          municipality_id?: string | null;
          did?: string | null;
          did_public_key?: string | null;
          did_encrypted_private_key?: string | null;
          google_id?: string | null;
          avatar_url?: string | null;
          identity_score?: number;
          verification_status?: 'none' | 'pending' | 'verified' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      social_proofs: {
        Row: {
          id: string;
          user_id: string;
          provider: 'google' | 'facebook' | 'instagram';
          provider_id: string;
          provider_email: string | null;
          provider_name: string | null;
          provider_avatar: string | null;
          access_token_encrypted: string | null;
          connected_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: 'google' | 'facebook' | 'instagram';
          provider_id: string;
          provider_email?: string | null;
          provider_name?: string | null;
          provider_avatar?: string | null;
          access_token_encrypted?: string | null;
          connected_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: 'google' | 'facebook' | 'instagram';
          provider_id?: string;
          provider_email?: string | null;
          provider_name?: string | null;
          provider_avatar?: string | null;
          access_token_encrypted?: string | null;
          connected_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      verification_runs: {
        Row: {
          id: string;
          user_id: string;
          municipality_id: string;
          status: 'active' | 'verified' | 'failed' | 'cancelled';
          started_at: string;
          completed_at: string | null;
          total_check_ins: number;
          completed_check_ins: number;
          failed_check_ins: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          municipality_id: string;
          status?: 'active' | 'verified' | 'failed' | 'cancelled';
          started_at?: string;
          completed_at?: string | null;
          total_check_ins?: number;
          completed_check_ins?: number;
          failed_check_ins?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          municipality_id?: string;
          status?: 'active' | 'verified' | 'failed' | 'cancelled';
          started_at?: string;
          completed_at?: string | null;
          total_check_ins?: number;
          completed_check_ins?: number;
          failed_check_ins?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      verification_schedule: {
        Row: {
          id: string;
          run_id: string;
          window_start: string;
          window_end: string;
          completed: boolean;
          reminder_sent: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          window_start: string;
          window_end: string;
          completed?: boolean;
          reminder_sent?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          window_start?: string;
          window_end?: string;
          completed?: boolean;
          reminder_sent?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      verification_attempts: {
        Row: {
          id: string;
          schedule_id: string;
          user_id: string;
          timestamp: string;
          latitude: number;
          longitude: number;
          accuracy: number;
          passed: boolean;
          fail_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          user_id: string;
          timestamp?: string;
          latitude: number;
          longitude: number;
          accuracy: number;
          passed?: boolean;
          fail_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          schedule_id?: string;
          user_id?: string;
          timestamp?: string;
          latitude?: number;
          longitude?: number;
          accuracy?: number;
          passed?: boolean;
          fail_reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          type: 'vote_participation' | 'vote_creation';
          amount: number;
          currency: string;
          status: 'pending' | 'completed' | 'failed' | 'refunded';
          provider: 'green_invoice';
          provider_id: string | null;
          idempotency_key: string;
          vote_id: string | null;
          option_id: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'vote_participation' | 'vote_creation';
          amount: number;
          currency?: string;
          status?: 'pending' | 'completed' | 'failed' | 'refunded';
          provider?: 'green_invoice';
          provider_id?: string | null;
          idempotency_key: string;
          vote_id?: string | null;
          option_id?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'vote_participation' | 'vote_creation';
          amount?: number;
          currency?: string;
          status?: 'pending' | 'completed' | 'failed' | 'refunded';
          provider?: 'green_invoice';
          provider_id?: string | null;
          idempotency_key?: string;
          vote_id?: string | null;
          option_id?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      entitlements: {
        Row: {
          id: string;
          user_id: string;
          type: 'vote' | 'create_vote' | 'tokens';
          payment_id: string | null;
          vote_id: string | null;
          amount: number | null;
          granted_at: string;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'vote' | 'create_vote' | 'tokens';
          payment_id?: string | null;
          vote_id?: string | null;
          amount?: number | null;
          granted_at?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: 'vote' | 'create_vote' | 'tokens';
          payment_id?: string | null;
          vote_id?: string | null;
          amount?: number | null;
          granted_at?: string;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      votes: {
        Row: {
          id: string;
          creator_id: string;
          title: string;
          description: string;
          municipality_id: string;
          status: 'pending' | 'active' | 'ended';
          start_date: string;
          end_date: string;
          participant_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          description: string;
          municipality_id: string;
          status?: 'pending' | 'active' | 'ended';
          start_date?: string;
          end_date: string;
          participant_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          title?: string;
          description?: string;
          municipality_id?: string;
          status?: 'pending' | 'active' | 'ended';
          start_date?: string;
          end_date?: string;
          participant_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vote_options: {
        Row: {
          id: string;
          vote_id: string;
          text: string;
          votes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          vote_id: string;
          text: string;
          votes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          vote_id?: string;
          text?: string;
          votes?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      user_votes: {
        Row: {
          id: string;
          user_id: string;
          vote_id: string;
          option_id: string;
          payment_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          vote_id: string;
          option_id: string;
          payment_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          vote_id?: string;
          option_id?: string;
          payment_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      set_claim: {
        Args: {
          claim: string;
          value: string;
        };
        Returns: void;
      };
      increment_vote_option: {
        Args: {
          option_id: string;
        };
        Returns: void;
      };
    };
    Enums: {
      verification_status: 'none' | 'pending' | 'verified' | 'failed';
      payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
      payment_type: 'vote_participation' | 'vote_creation';
      social_provider: 'google' | 'facebook' | 'instagram';
      vote_status: 'pending' | 'active' | 'ended';
      entitlement_type: 'vote' | 'create_vote' | 'tokens';
    };
  };
}

// Utility types for easier access
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Exported types for use in the app
export type User = Tables<'users'>;
export type SocialProof = Tables<'social_proofs'>;
export type VerificationRun = Tables<'verification_runs'>;
export type VerificationSchedule = Tables<'verification_schedule'>;
export type VerificationAttempt = Tables<'verification_attempts'>;
export type Payment = Tables<'payments'>;
export type Entitlement = Tables<'entitlements'>;
export type Vote = Tables<'votes'>;
export type VoteOption = Tables<'vote_options'>;
export type UserVote = Tables<'user_votes'>;
