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
          city: string | null;
          municipality_rating: number | null;
          municipality_rated_at: string | null;
          notification_settings: Record<string, boolean> | null;
          did: string | null;
          did_public_key: string | null;
          did_encrypted_private_key: string | null;
          google_id: string | null;
          avatar_url: string | null;
          identity_score: number;
          verification_status: 'none' | 'pending' | 'verified' | 'failed';
          qubik_wallet_address: string | null;
          phone_verified: boolean | null;
          phone_verified_at: string | null;
          identity_verified_at: string | null;
          /**
           * Bootstrap marker for cross-space grant management and grant
           * suspension only. Confers no space capability and no data access.
           */
          is_platform_admin: boolean;
          /**
           * Global revocation counter (Issue #71 Model B). Stamped into
           * session/refresh tokens as `sv` at mint; re-read on every
           * authenticated request. See migration 20260901000001.
           */
          session_version: number;
          /**
           * Security posture score (Issue #71, canonical §10.2 - formula
           * locked). 20 iff an active MFA factor exists AND global enforcement
           * is on; else 0. DB-owned: written only by the factor trigger and
           * the M8 flip runbook (migration 20260901000003). Display only -
           * never an input to voting eligibility.
           */
          security_score: number;
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
          city?: string | null;
          municipality_rating?: number | null;
          municipality_rated_at?: string | null;
          notification_settings?: Record<string, boolean> | null;
          did?: string | null;
          did_public_key?: string | null;
          did_encrypted_private_key?: string | null;
          google_id?: string | null;
          avatar_url?: string | null;
          identity_score?: number;
          verification_status?: 'none' | 'pending' | 'verified' | 'failed';
          qubik_wallet_address?: string | null;
          phone_verified?: boolean | null;
          phone_verified_at?: string | null;
          identity_verified_at?: string | null;
          is_platform_admin?: boolean;
          session_version?: number;
          security_score?: number;
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
          city?: string | null;
          municipality_rating?: number | null;
          municipality_rated_at?: string | null;
          notification_settings?: Record<string, boolean> | null;
          did?: string | null;
          did_public_key?: string | null;
          did_encrypted_private_key?: string | null;
          google_id?: string | null;
          avatar_url?: string | null;
          identity_score?: number;
          verification_status?: 'none' | 'pending' | 'verified' | 'failed';
          qubik_wallet_address?: string | null;
          phone_verified?: boolean | null;
          phone_verified_at?: string | null;
          identity_verified_at?: string | null;
          is_platform_admin?: boolean;
          session_version?: number;
          security_score?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      merch_orders: {
        Row: {
          id: string;
          user_id: string | null;
          items: Record<string, unknown>[];
          subtotal_ils: number;
          shipping_ils: number;
          total_ils: number;
          currency: string;
          status: 'pending' | 'paid' | 'fulfilling' | 'shipped' | 'cancelled' | 'failed';
          shipping: Record<string, unknown>;
          payment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id?: string | null;
          items: Record<string, unknown>[];
          subtotal_ils: number;
          shipping_ils: number;
          total_ils: number;
          currency?: string;
          status?: 'pending' | 'paid' | 'fulfilling' | 'shipped' | 'cancelled' | 'failed';
          shipping: Record<string, unknown>;
          payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'paid' | 'fulfilling' | 'shipped' | 'cancelled' | 'failed';
          payment_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          status: 'active' | 'unsubscribed';
          source: string | null;
          source_page: string | null;
          locale: 'he' | 'en' | null;
          subscribed_at: string;
          unsubscribed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          /** Must already be lowercased and trimmed - the table CHECKs it. */
          email: string;
          status?: 'active' | 'unsubscribed';
          source?: string | null;
          source_page?: string | null;
          locale?: 'he' | 'en' | null;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
        };
        Update: {
          status?: 'active' | 'unsubscribed';
          source?: string | null;
          source_page?: string | null;
          locale?: 'he' | 'en' | null;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      /**
       * TOTP factor per user (Issue #71, migration 20260901000002). Lifecycle
       * pending -> active -> disabled; disabled rows retained as audit
       * history. Partial unique indexes allow at most one active and one
       * pending factor per user. secret_enc is AES-256-GCM
       * (iv || ciphertext || tag), AAD = user_id || id - the hex string
       * PostgREST returns for bytea (\x-prefixed).
       */
      user_mfa_factors: {
        Row: {
          id: string;
          user_id: string;
          factor_type: 'totp';
          status: 'pending' | 'active' | 'disabled';
          secret_enc: string;
          enc_key_version: number;
          last_accepted_step: number | null;
          confirm_attempts: number;
          disabled_reason: 'user' | 'operator_reset' | null;
          created_at: string;
          confirmed_at: string | null;
          disabled_at: string | null;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          factor_type: 'totp';
          status?: 'pending' | 'active' | 'disabled';
          secret_enc: string;
          enc_key_version?: number;
          last_accepted_step?: number | null;
          confirm_attempts?: number;
          disabled_reason?: 'user' | 'operator_reset' | null;
        };
        Update: {
          status?: 'pending' | 'active' | 'disabled';
          last_accepted_step?: number | null;
          confirm_attempts?: number;
          disabled_reason?: 'user' | 'operator_reset' | null;
          confirmed_at?: string | null;
          disabled_at?: string | null;
          last_used_at?: string | null;
        };
        Relationships: [];
      };
      /**
       * Recovery-code hashes (Issue #71). Plaintext shown exactly once at
       * generation; spend is the mfa_consume_recovery_code RPC.
       */
      user_recovery_codes: {
        Row: {
          id: string;
          user_id: string;
          batch_id: string;
          code_hash: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          batch_id: string;
          code_hash: string;
          used_at?: string | null;
        };
        Update: {
          used_at?: string | null;
        };
        Relationships: [];
      };
      /**
       * Authoritative MFA login-challenge state (Issue #71 §6.4a). The
       * mfa_pending.v1 JWT is only a signed locator for a row here; id equals
       * the JWT jti and is minted by the application.
       */
      mfa_pending_tokens: {
        Row: {
          id: string;
          user_id: string;
          expires_at: string;
          consumed_at: string | null;
          attempt_count: number;
          ip_hash: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          expires_at: string;
          consumed_at?: string | null;
          attempt_count?: number;
          ip_hash?: string | null;
          user_agent?: string | null;
        };
        Update: {
          consumed_at?: string | null;
          attempt_count?: number;
        };
        Relationships: [];
      };
      /**
       * Single-use, purpose-bound step-up tickets (Issue #71 §7). The DB row
       * is the authority over the reauth.v1 JWT; id equals the jti.
       */
      reauth_tickets: {
        Row: {
          id: string;
          user_id: string;
          purpose: 'mfa_disable' | 'recovery_regenerate' | 'operator_reset' | 'security_settings';
          method: 'totp' | 'recovery' | 'google';
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          purpose: 'mfa_disable' | 'recovery_regenerate' | 'operator_reset' | 'security_settings';
          method: 'totp' | 'recovery' | 'google';
          expires_at: string;
          consumed_at?: string | null;
        };
        Update: {
          consumed_at?: string | null;
        };
        Relationships: [];
      };
      /**
       * Append-only security audit (Issue #71 §8). INSERT and SELECT only -
       * the database refuses UPDATE/DELETE/TRUNCATE for every role including
       * service_role. Doubles as the durable rate-limit counter.
       */
      security_events: {
        Row: {
          id: number;
          user_id: string | null;
          actor_user_id: string | null;
          event_type:
            | 'mfa_enrollment_started'
            | 'mfa_enrollment_confirmed'
            | 'mfa_enrollment_failed'
            | 'totp_verification_success'
            | 'totp_verification_failure'
            | 'recovery_code_used'
            | 'recovery_code_failed'
            | 'recovery_codes_regenerated'
            | 'mfa_disabled'
            | 'mfa_reset_by_operator'
            | 'reauth_success'
            | 'reauth_failure'
            | 'mfa_challenge_expired'
            | 'mfa_challenge_replayed'
            | 'session_version_revoked';
          ip_hash: string | null;
          user_agent: string | null;
          reason: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          actor_user_id?: string | null;
          event_type: SecurityEventType;
          ip_hash?: string | null;
          user_agent?: string | null;
          reason?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: never;
        Relationships: [];
      };
      /**
       * One-row global security settings (Issue #71 §5.6). The single source
       * of truth for MFA enforcement - no env var mirrors it. Flips are
       * runbook DML, transactional with the security_score recompute.
       */
      security_settings: {
        Row: {
          id: boolean;
          mfa_enforcement_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          mfa_enforcement_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          mfa_enforcement_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      /**
       * The desk's "not a matter of consensus" signal. Never a ballot: no
       * points, no tally, no chain. One row per reader per topic.
       */
      topic_set_aside: {
        Row: {
          id: string;
          vote_id: string;
          user_id: string;
          reason:
            | 'not_consensus'
            | 'already_decided'
            | 'unclear'
            | 'not_my_authority';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vote_id: string;
          user_id: string;
          reason:
            | 'not_consensus'
            | 'already_decided'
            | 'unclear'
            | 'not_my_authority';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          reason?:
            | 'not_consensus'
            | 'already_decided'
            | 'unclear'
            | 'not_my_authority';
          updated_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          device_type: 'ios' | 'android' | null;
          device_name: string | null;
          is_active: boolean;
          last_used: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          device_type?: 'ios' | 'android' | null;
          device_name?: string | null;
          is_active?: boolean;
          last_used?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          device_type?: 'ios' | 'android' | null;
          device_name?: string | null;
          is_active?: boolean;
          last_used?: string | null;
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
          provider: 'paddle' | 'green_invoice';
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
          provider?: 'paddle' | 'green_invoice';
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
          provider?: 'paddle' | 'green_invoice';
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
          status:
            | 'draft'
            | 'in_review'
            | 'changes_requested'
            | 'rejected'
            | 'pending'
            | 'active'
            | 'ended'
            | 'resolving'
            | 'resolved'
            | 'failed';
          start_date: string;
          end_date: string;
          participant_count: number;
          resolved_at: string | null;
          resolution_status: 'pending' | 'resolving' | 'resolved' | 'failed' | null;
          hidden_at: string | null;
          hidden_by: string | null;
          flagged_at: string | null;
          flagged_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          description: string;
          municipality_id: string;
          status?:
            | 'draft'
            | 'in_review'
            | 'changes_requested'
            | 'rejected'
            | 'pending'
            | 'active'
            | 'ended'
            | 'resolving'
            | 'resolved'
            | 'failed';
          start_date?: string;
          end_date: string;
          participant_count?: number;
          resolved_at?: string | null;
          resolution_status?: 'pending' | 'resolving' | 'resolved' | 'failed' | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          flagged_at?: string | null;
          flagged_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          title?: string;
          description?: string;
          municipality_id?: string;
          status?:
            | 'draft'
            | 'in_review'
            | 'changes_requested'
            | 'rejected'
            | 'pending'
            | 'active'
            | 'ended'
            | 'resolving'
            | 'resolved'
            | 'failed';
          start_date?: string;
          end_date?: string;
          participant_count?: number;
          resolved_at?: string | null;
          resolution_status?: 'pending' | 'resolving' | 'resolved' | 'failed' | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          flagged_at?: string | null;
          flagged_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vote_nfts: {
        Row: {
          id: string;
          vote_id: string;
          user_id: string | null;
          wallet_address: string | null;
          type: 'verified_voter' | 'civic_patron';
          mint_address: string | null;
          metadata_uri: string | null;
          status: 'pending' | 'minting' | 'minted' | 'failed';
          minted_at: string | null;
          mint_tx_hash: string | null;
          error_message: string | null;
          retry_count: number;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vote_id: string;
          user_id?: string | null;
          wallet_address?: string | null;
          type: 'verified_voter' | 'civic_patron';
          mint_address?: string | null;
          metadata_uri?: string | null;
          status?: 'pending' | 'minting' | 'minted' | 'failed';
          minted_at?: string | null;
          mint_tx_hash?: string | null;
          error_message?: string | null;
          retry_count?: number;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vote_id?: string;
          user_id?: string | null;
          wallet_address?: string | null;
          type?: 'verified_voter' | 'civic_patron';
          mint_address?: string | null;
          metadata_uri?: string | null;
          status?: 'pending' | 'minting' | 'minted' | 'failed';
          minted_at?: string | null;
          mint_tx_hash?: string | null;
          error_message?: string | null;
          retry_count?: number;
          metadata?: Json | null;
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
      knesset_persons: {
        Row: {
          person_id: number;
          first_name: string;
          last_name: string;
          full_name: string;
          gender_desc: string | null;
          is_current: boolean;
          slug: string;
          knesset_num: number | null;
          faction_name: string | null;
          source_name: string;
          source_url: string;
          as_of: string;
          source_updated_at: string | null;
          fetched_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          person_id: number;
          first_name: string;
          last_name: string;
          full_name: string;
          gender_desc?: string | null;
          is_current?: boolean;
          slug: string;
          knesset_num?: number | null;
          faction_name?: string | null;
          source_name: string;
          source_url: string;
          as_of: string;
          source_updated_at?: string | null;
          fetched_at?: string;
        };
        Update: {
          is_current?: boolean;
          slug?: string;
          knesset_num?: number | null;
          faction_name?: string | null;
          first_name?: string;
          last_name?: string;
          full_name?: string;
          gender_desc?: string | null;
          source_name?: string;
          source_url?: string;
          as_of?: string;
          source_updated_at?: string | null;
          fetched_at?: string;
        };
        Relationships: [];
      };
      knesset_positions: {
        Row: {
          position_row_id: number;
          person_id: number;
          office: string;
          title: string;
          portfolio: string | null;
          faction_name: string | null;
          knesset_num: number | null;
          start_date: string | null;
          end_date: string | null;
          is_current: boolean;
          source_name: string;
          source_url: string;
          as_of: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          position_row_id: number;
          person_id: number;
          office: string;
          title: string;
          portfolio?: string | null;
          faction_name?: string | null;
          knesset_num?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          is_current?: boolean;
          source_name: string;
          source_url: string;
          as_of: string;
        };
        Update: {
          office?: string;
          title?: string;
          portfolio?: string | null;
          faction_name?: string | null;
          knesset_num?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          is_current?: boolean;
        };
        Relationships: [];
      };
      knesset_roll_calls: {
        Row: {
          roll_call_id: number;
          knesset_num: number | null;
          session_id: number | null;
          sess_item_id: number | null;
          item_description: string | null;
          vote_subject: string | null;
          vote_date: string | null;
          total_for: number;
          total_against: number;
          total_abstain: number;
          is_accepted: boolean;
          source_name: string;
          source_url: string;
          as_of: string;
          fetched_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          roll_call_id: number;
          knesset_num?: number | null;
          session_id?: number | null;
          sess_item_id?: number | null;
          item_description?: string | null;
          vote_subject?: string | null;
          vote_date?: string | null;
          total_for?: number;
          total_against?: number;
          total_abstain?: number;
          is_accepted?: boolean;
          source_name: string;
          source_url: string;
          as_of: string;
          fetched_at?: string;
        };
        Update: {
          total_for?: number;
          total_against?: number;
          total_abstain?: number;
          is_accepted?: boolean;
          fetched_at?: string;
        };
        Relationships: [];
      };
      knesset_roll_call_stances: {
        Row: {
          roll_call_id: number;
          member_key: string;
          person_id: number | null;
          member_name: string;
          faction_name: string | null;
          stance: string;
          created_at: string;
        };
        Insert: {
          roll_call_id: number;
          member_key: string;
          person_id?: number | null;
          member_name: string;
          faction_name?: string | null;
          stance: string;
        };
        Update: {
          person_id?: number | null;
          stance?: string;
          faction_name?: string | null;
        };
        Relationships: [];
      };
      knesset_member_reviews: {
        Row: {
          id: string;
          person_id: number;
          user_id: string;
          rating: number;
          body: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          person_id: number;
          user_id: string;
          rating: number;
          body?: string | null;
          status?: string;
        };
        Update: {
          rating?: number;
          body?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      knesset_items: {
        Row: {
          id: string;
          vote_id: string;
          item_id: number;
          plenum_session_id: number;
          session_date: string | null;
          session_number: number | null;
          knesset_num: number | null;
          item_type: string | null;
          ordinal: number | null;
          status_id: number | null;
          is_discussion: boolean;
          doc_url: string | null;
          doc_group: string | null;
          summary: string | null;
          summary_model: string | null;
          summarized_at: string | null;
          source_updated_at: string | null;
          fetched_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vote_id: string;
          item_id: number;
          plenum_session_id: number;
          session_date?: string | null;
          session_number?: number | null;
          knesset_num?: number | null;
          item_type?: string | null;
          ordinal?: number | null;
          status_id?: number | null;
          is_discussion?: boolean;
          doc_url?: string | null;
          doc_group?: string | null;
          summary?: string | null;
          summary_model?: string | null;
          summarized_at?: string | null;
          source_updated_at?: string | null;
          fetched_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vote_id?: string;
          item_id?: number;
          plenum_session_id?: number;
          session_date?: string | null;
          session_number?: number | null;
          knesset_num?: number | null;
          item_type?: string | null;
          ordinal?: number | null;
          status_id?: number | null;
          is_discussion?: boolean;
          doc_url?: string | null;
          doc_group?: string | null;
          summary?: string | null;
          summary_model?: string | null;
          summarized_at?: string | null;
          source_updated_at?: string | null;
          fetched_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vote_sources: {
        Row: {
          id: string;
          vote_id: string;
          post_count: number;
          comments_count: number;
          reactions: Record<string, number>;
          source_url: string | null;
          fetched_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vote_id: string;
          post_count?: number;
          comments_count?: number;
          reactions?: Record<string, number>;
          source_url?: string | null;
          fetched_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vote_id?: string;
          post_count?: number;
          comments_count?: number;
          reactions?: Record<string, number>;
          source_url?: string | null;
          fetched_at?: string;
          created_at?: string;
          updated_at?: string;
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
      webhook_events: {
        Row: {
          id: string;
          event_id: string;
          provider: string;
          event_type: string;
          payload_hash: string;
          received_at: string;
          processed_at: string | null;
          status: 'pending' | 'processed' | 'failed' | 'skipped';
          error_message: string | null;
          idempotency_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          provider: string;
          event_type: string;
          payload_hash: string;
          received_at?: string;
          processed_at?: string | null;
          status?: 'pending' | 'processed' | 'failed' | 'skipped';
          error_message?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          provider?: string;
          event_type?: string;
          payload_hash?: string;
          received_at?: string;
          processed_at?: string | null;
          status?: 'pending' | 'processed' | 'failed' | 'skipped';
          error_message?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      treasury: {
        Row: {
          id: string;
          municipality_id: string;
          wallet_address: string | null;
          wallet_public_key: string | null;
          balance_ils: number;
          balance_sol: string;
          total_collected_ils: number;
          total_withdrawn_ils: number;
          total_fees_claimed_sol: string;
          active_votes_count: number;
          last_sync_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          municipality_id: string;
          wallet_address?: string | null;
          wallet_public_key?: string | null;
          balance_ils?: number;
          balance_sol?: string;
          total_collected_ils?: number;
          total_withdrawn_ils?: number;
          total_fees_claimed_sol?: string;
          active_votes_count?: number;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          municipality_id?: string;
          wallet_address?: string | null;
          wallet_public_key?: string | null;
          balance_ils?: number;
          balance_sol?: string;
          total_collected_ils?: number;
          total_withdrawn_ils?: number;
          total_fees_claimed_sol?: string;
          active_votes_count?: number;
          last_sync_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      treasury_transactions: {
        Row: {
          id: string;
          treasury_id: string;
          type: 'deposit' | 'allocation' | 'withdrawal' | 'fee_claim' | 'token_purchase' | 'nft_mint';
          vote_id: string | null;
          user_id: string | null;
          payment_id: string | null;
          amount_ils: number | null;
          amount_sol: string | null;
          description: string;
          bags_tx_hash: string | null;
          status: 'pending' | 'confirmed' | 'failed';
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          treasury_id: string;
          type: 'deposit' | 'allocation' | 'withdrawal' | 'fee_claim' | 'token_purchase' | 'nft_mint';
          vote_id?: string | null;
          user_id?: string | null;
          payment_id?: string | null;
          amount_ils?: number | null;
          amount_sol?: string | null;
          description: string;
          bags_tx_hash?: string | null;
          status?: 'pending' | 'confirmed' | 'failed';
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          treasury_id?: string;
          type?: 'deposit' | 'allocation' | 'withdrawal' | 'fee_claim' | 'token_purchase' | 'nft_mint';
          vote_id?: string | null;
          user_id?: string | null;
          payment_id?: string | null;
          amount_ils?: number | null;
          amount_sol?: string | null;
          description?: string;
          bags_tx_hash?: string | null;
          status?: 'pending' | 'confirmed' | 'failed';
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
      issue_coins: {
        Row: {
          id: string;
          vote_id: string;
          token_mint: string;
          token_name: string;
          token_symbol: string;
          token_decimals: number;
          total_supply: string | null;
          total_purchased: string;
          total_value_ils: number;
          trading_enabled: boolean;
          is_frozen: boolean;
          frozen_at: string | null;
          launch_tx_hash: string | null;
          fee_share_configured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vote_id: string;
          token_mint: string;
          token_name: string;
          token_symbol: string;
          token_decimals?: number;
          total_supply?: string | null;
          total_purchased?: string;
          total_value_ils?: number;
          trading_enabled?: boolean;
          is_frozen?: boolean;
          frozen_at?: string | null;
          launch_tx_hash?: string | null;
          fee_share_configured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vote_id?: string;
          token_mint?: string;
          token_name?: string;
          token_symbol?: string;
          token_decimals?: number;
          total_supply?: string | null;
          total_purchased?: string;
          total_value_ils?: number;
          trading_enabled?: boolean;
          is_frozen?: boolean;
          frozen_at?: string | null;
          launch_tx_hash?: string | null;
          fee_share_configured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      issue_coin_holdings: {
        Row: {
          id: string;
          issue_coin_id: string;
          user_id: string | null;
          wallet_address: string | null;
          token_amount: string;
          invested_ils: number;
          is_local_resident: boolean;
          nft_minted: boolean;
          nft_mint_address: string | null;
          first_purchase_at: string | null;
          last_purchase_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          issue_coin_id: string;
          user_id?: string | null;
          wallet_address?: string | null;
          token_amount?: string;
          invested_ils?: number;
          is_local_resident?: boolean;
          nft_minted?: boolean;
          nft_mint_address?: string | null;
          first_purchase_at?: string | null;
          last_purchase_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          issue_coin_id?: string;
          user_id?: string | null;
          wallet_address?: string | null;
          token_amount?: string;
          invested_ils?: number;
          is_local_resident?: boolean;
          nft_minted?: boolean;
          nft_mint_address?: string | null;
          first_purchase_at?: string | null;
          last_purchase_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      identity_documents: {
        Row: {
          id: string;
          user_id: string;
          document_type: 'id_card' | 'drivers_license';
          id_number_hash: string;
          id_number_last2: string;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          document_expiry: string;
          ocr_id_number_matched: boolean;
          ocr_confidence: number;
          ocr_fields_edited: boolean;
          face_checked: boolean;
          face_doc_found: boolean;
          face_match_score: number | null;
          face_liveness_passed: boolean;
          face_antispoof_score: number | null;
          status: 'verified' | 'pending_review' | 'rejected';
          consent_version: string;
          consent_at: string;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_type: 'id_card' | 'drivers_license';
          id_number_hash: string;
          id_number_last2: string;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          document_expiry: string;
          ocr_id_number_matched?: boolean;
          ocr_confidence?: number;
          ocr_fields_edited?: boolean;
          face_checked?: boolean;
          face_doc_found?: boolean;
          face_match_score?: number | null;
          face_liveness_passed?: boolean;
          face_antispoof_score?: number | null;
          status?: 'verified' | 'pending_review' | 'rejected';
          consent_version: string;
          consent_at?: string;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          document_type?: 'id_card' | 'drivers_license';
          id_number_hash?: string;
          id_number_last2?: string;
          first_name?: string;
          last_name?: string;
          date_of_birth?: string;
          document_expiry?: string;
          ocr_id_number_matched?: boolean;
          ocr_confidence?: number;
          ocr_fields_edited?: boolean;
          face_checked?: boolean;
          face_doc_found?: boolean;
          face_match_score?: number | null;
          face_liveness_passed?: boolean;
          face_antispoof_score?: number | null;
          status?: 'verified' | 'pending_review' | 'rejected';
          consent_version?: string;
          consent_at?: string;
          verified_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      identity_document_events: {
        Row: {
          id: string;
          user_id: string;
          event:
            | 'submitted'
            | 'auto_verified'
            | 'queued_review'
            | 'approved'
            | 'rejected'
            | 'deleted';
          detail: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event:
            | 'submitted'
            | 'auto_verified'
            | 'queued_review'
            | 'approved'
            | 'rejected'
            | 'deleted';
          detail?: Json | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      spaces: {
        Row: {
          id: string;
          type: 'municipality' | 'national' | 'organization' | 'urban_area' | 'nationwide_civic';
          slug: string;
          name_he: string;
          municipality_code: string | null;
          geography: Json | null;
          owner_user_id: string | null;
          verification_state: 'unverified' | 'pending' | 'verified';
          notification_monthly_quota: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type?: 'municipality' | 'national' | 'organization' | 'urban_area' | 'nationwide_civic';
          slug: string;
          name_he: string;
          municipality_code?: string | null;
          geography?: Json | null;
          owner_user_id?: string | null;
          verification_state?: 'unverified' | 'pending' | 'verified';
          notification_monthly_quota?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: 'municipality' | 'national' | 'organization' | 'urban_area' | 'nationwide_civic';
          slug?: string;
          name_he?: string;
          municipality_code?: string | null;
          geography?: Json | null;
          owner_user_id?: string | null;
          verification_state?: 'unverified' | 'pending' | 'verified';
          notification_monthly_quota?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      space_capability_grants: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          capability:
            | 'proposal.read'
            | 'proposal.approve'
            | 'proposal.reject'
            | 'member.read'
            | 'member.suspend'
            | 'grant.create'
            | 'grant.revoke'
            | 'content.moderate'
            | 'metrics.read'
            | 'notification.send'
            | 'audit.read';
          /**
           * Provenance for the UI preset picker only. Never consulted at
           * authorization time.
           */
          granted_via_role: string | null;
          granted_by: string;
          granted_at: string;
          suspended_at: string | null;
          suspended_by: string | null;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          capability:
            | 'proposal.read'
            | 'proposal.approve'
            | 'proposal.reject'
            | 'member.read'
            | 'member.suspend'
            | 'grant.create'
            | 'grant.revoke'
            | 'content.moderate'
            | 'metrics.read'
            | 'notification.send'
            | 'audit.read';
          granted_via_role?: string | null;
          granted_by: string;
          granted_at?: string;
          suspended_at?: string | null;
          suspended_by?: string | null;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          capability?:
            | 'proposal.read'
            | 'proposal.approve'
            | 'proposal.reject'
            | 'member.read'
            | 'member.suspend'
            | 'grant.create'
            | 'grant.revoke'
            | 'content.moderate'
            | 'metrics.read'
            | 'notification.send'
            | 'audit.read';
          granted_via_role?: string | null;
          granted_by?: string;
          granted_at?: string;
          suspended_at?: string | null;
          suspended_by?: string | null;
        };
        Relationships: [];
      };
      space_member_suspensions: {
        Row: {
          id: string;
          space_id: string;
          user_id: string;
          suspended_at: string;
          suspended_by: string;
          lifted_at: string | null;
          lifted_by: string | null;
          reason: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          user_id: string;
          suspended_at?: string;
          suspended_by: string;
          lifted_at?: string | null;
          lifted_by?: string | null;
          reason: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          user_id?: string;
          suspended_at?: string;
          suspended_by?: string;
          lifted_at?: string | null;
          lifted_by?: string | null;
          reason?: string;
        };
        Relationships: [];
      };
      space_audit_log: {
        Row: {
          id: string;
          space_id: string;
          actor_user_id: string;
          action: string;
          object_type:
            | 'vote'
            | 'grant'
            | 'space'
            | 'member'
            | 'notification_campaign'
            | 'content'
            | 'escalation';
          object_id: string | null;
          prior_state: Json | null;
          new_state: Json | null;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          actor_user_id: string;
          action: string;
          object_type:
            | 'vote'
            | 'grant'
            | 'space'
            | 'member'
            | 'notification_campaign'
            | 'content'
            | 'escalation';
          object_id?: string | null;
          prior_state?: Json | null;
          new_state?: Json | null;
          reason: string;
          created_at?: string;
        };
        /**
         * The table is append-only, enforced by trigger and REVOKE. No
         * application path may produce an update payload, so there is no
         * legal shape for one.
         */
        Update: Record<string, never>;
        Relationships: [];
      };
      platform_escalations: {
        Row: {
          id: string;
          /** NULL when the caller's target space did not resolve; see raw_space_id. */
          space_id: string | null;
          raw_space_id: string;
          raised_by: string;
          body: string;
          status: 'open' | 'acknowledged' | 'closed';
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id?: string | null;
          raw_space_id: string;
          raised_by: string;
          body: string;
          status?: 'open' | 'acknowledged' | 'closed';
          created_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string | null;
          raw_space_id?: string;
          raised_by?: string;
          body?: string;
          status?: 'open' | 'acknowledged' | 'closed';
          created_at?: string;
        };
        Relationships: [];
      };
      space_notification_campaigns: {
        Row: {
          id: string;
          space_id: string;
          created_by: string;
          title: string;
          body: string;
          audience_filter:
            | 'all_members'
            | 'active_vote_participants'
            | 'new_members_30d';
          /** sha256 of the sorted, comma-joined recipient ids. Re-derived at send. */
          audience_hash: string;
          /** sha256 of trimmed title + body + filter. This IS the previewToken. */
          content_hash: string;
          audience_size: number;
          excluded_opted_out: number;
          excluded_no_channel: number;
          status: 'previewed' | 'sent' | 'failed';
          reason: string | null;
          previewed_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          space_id: string;
          created_by: string;
          title: string;
          body: string;
          audience_filter:
            | 'all_members'
            | 'active_vote_participants'
            | 'new_members_30d';
          audience_hash: string;
          content_hash: string;
          audience_size: number;
          excluded_opted_out?: number;
          excluded_no_channel?: number;
          status?: 'previewed' | 'sent' | 'failed';
          reason?: string | null;
          previewed_at?: string;
          sent_at?: string | null;
        };
        Update: {
          status?: 'previewed' | 'sent' | 'failed';
          reason?: string | null;
          sent_at?: string | null;
        };
        Relationships: [];
      };
      space_notification_deliveries: {
        Row: {
          id: string;
          campaign_id: string;
          user_id: string;
          channel: 'in_app' | 'push';
          state: 'delivered' | 'suppressed' | 'failed';
          suppression_reason: 'opted_out' | 'no_active_channel' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          user_id: string;
          channel: 'in_app' | 'push';
          state?: 'delivered' | 'suppressed' | 'failed';
          suppression_reason?: 'opted_out' | 'no_active_channel' | null;
          created_at?: string;
        };
        Update: {
          state?: 'delivered' | 'suppressed' | 'failed';
          suppression_reason?: 'opted_out' | 'no_active_channel' | null;
        };
        Relationships: [];
      };
      user_notifications: {
        Row: {
          id: string;
          user_id: string;
          space_id: string | null;
          campaign_id: string | null;
          title: string;
          body: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          space_id?: string | null;
          campaign_id?: string | null;
          title: string;
          body: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
        Relationships: [];
      };
      community_manager_applications: {
        Row: {
          id: string;
          user_id: string;
          space_id: string;
          motivation: string;
          contact_phone: string | null;
          evidence_urls: Json;
          status: "submitted" | "approved" | "rejected" | "withdrawn";
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          space_id: string;
          motivation: string;
          contact_phone?: string | null;
          evidence_urls?: Json;
          status?: "submitted" | "approved" | "rejected" | "withdrawn";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          motivation?: string;
          contact_phone?: string | null;
          evidence_urls?: Json;
          status?: "submitted" | "approved" | "rejected" | "withdrawn";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      role_grant_events: {
        Row: {
          id: string;
          subject_type: "role_grant" | "community_manager_application";
          subject_id: string;
          event:
            | "submitted"
            | "approved"
            | "rejected"
            | "granted"
            | "suspended"
            | "reinstated"
            | "revoked";
          subject_user_id: string | null;
          actor_user_id: string | null;
          role: string | null;
          space_id: string | null;
          reason: string | null;
          detail: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject_type: "role_grant" | "community_manager_application";
          subject_id: string;
          event:
            | "submitted"
            | "approved"
            | "rejected"
            | "granted"
            | "suspended"
            | "reinstated"
            | "revoked";
          subject_user_id?: string | null;
          actor_user_id?: string | null;
          role?: string | null;
          space_id?: string | null;
          reason?: string | null;
          detail?: Json | null;
          created_at?: string;
        };
        // Append-only: enforced by the role_grant_events_append_only trigger.
        Update: Record<string, never>;
        Relationships: [];
      };
      role_grants: {
        Row: {
          id: string;
          user_id: string;
          role: "super_admin" | "space_admin" | "community_manager";
          space_id: string | null;
          status: "active" | "suspended" | "revoked";
          source: "manual" | "application";
          source_id: string | null;
          granted_by: string | null;
          granted_at: string;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: "super_admin" | "space_admin" | "community_manager";
          space_id?: string | null;
          status?: "active" | "suspended" | "revoked";
          source?: "manual" | "application";
          source_id?: string | null;
          granted_by?: string | null;
          granted_at?: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          role?: "super_admin" | "space_admin" | "community_manager";
          space_id?: string | null;
          status?: "active" | "suspended" | "revoked";
          source?: "manual" | "application";
          source_id?: string | null;
          granted_by?: string | null;
          granted_at?: string;
          ended_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      knesset_rankings: {
        Row: {
          id: string;
          vote_id: string;
          hotness: number;
          relevance: number | null;
          stakes: number | null;
          media: number | null;
          headline: string | null;
          rationale: string | null;
          media_refs: string[];
          media_evidence: Record<string, unknown>;
          model: string | null;
          ranked_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vote_id: string;
          hotness: number;
          relevance?: number | null;
          stakes?: number | null;
          media?: number | null;
          headline?: string | null;
          rationale?: string | null;
          media_refs?: string[];
          media_evidence?: Record<string, unknown>;
          model?: string | null;
          ranked_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vote_id?: string;
          hotness?: number;
          relevance?: number | null;
          stakes?: number | null;
          media?: number | null;
          headline?: string | null;
          rationale?: string | null;
          media_refs?: string[];
          media_evidence?: Record<string, unknown>;
          model?: string | null;
          ranked_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vote_card_art: {
        Row: {
          id: string;
          vote_id: string;
          image_url: string | null;
          prompt: string | null;
          model: string | null;
          attempted_at: string;
          generated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vote_id: string;
          image_url?: string | null;
          prompt?: string | null;
          model?: string | null;
          attempted_at?: string;
          generated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vote_id?: string;
          image_url?: string | null;
          prompt?: string | null;
          model?: string | null;
          attempted_at?: string;
          generated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      municipalities: {
        Row: {
          code: string;
          name_he: string;
          kind: "municipality" | "national";
          created_at: string;
        };
        Insert: {
          code: string;
          name_he: string;
          kind?: "municipality" | "national";
          created_at?: string;
        };
        Update: {
          code?: string;
          name_he?: string;
          kind?: "municipality" | "national";
          created_at?: string;
        };
        Relationships: [];
      };
      pilot_municipalities: {
        Row: {
          municipality_id: string;
          rank: number | null;
          engagement_score: number;
          engagement_snapshot: Json;
          status: 'selected' | 'active' | 'paused' | 'completed';
          curated_by: string;
          curated_at: string;
          activated_at: string | null;
          updated_at: string;
        };
        Insert: {
          municipality_id: string;
          rank?: number | null;
          engagement_score?: number;
          engagement_snapshot?: Json;
          status?: 'selected' | 'active' | 'paused' | 'completed';
          curated_by: string;
          curated_at?: string;
          activated_at?: string | null;
          updated_at?: string;
        };
        Update: {
          municipality_id?: string;
          rank?: number | null;
          engagement_score?: number;
          engagement_snapshot?: Json;
          status?: 'selected' | 'active' | 'paused' | 'completed';
          curated_by?: string;
          curated_at?: string;
          activated_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pilot_votes: {
        Row: {
          municipality_id: string;
          vote_id: string;
          position: number;
          added_by: string;
          created_at: string;
        };
        Insert: {
          municipality_id: string;
          vote_id: string;
          position: number;
          added_by: string;
          created_at?: string;
        };
        Update: {
          municipality_id?: string;
          vote_id?: string;
          position?: number;
          added_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pilot_campaigns: {
        Row: {
          id: string;
          municipality_id: string;
          created_by: string;
          group_name: string;
          group_url: string | null;
          status: 'draft' | 'ready' | 'posted' | 'archived';
          current_copy_id: string | null;
          posted_at: string | null;
          posted_by: string | null;
          post_permalink: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          municipality_id: string;
          created_by: string;
          group_name: string;
          group_url?: string | null;
          status?: 'draft' | 'ready' | 'posted' | 'archived';
          current_copy_id?: string | null;
          posted_at?: string | null;
          posted_by?: string | null;
          post_permalink?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          municipality_id?: string;
          created_by?: string;
          group_name?: string;
          group_url?: string | null;
          status?: 'draft' | 'ready' | 'posted' | 'archived';
          current_copy_id?: string | null;
          posted_at?: string | null;
          posted_by?: string | null;
          post_permalink?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pilot_campaign_copies: {
        Row: {
          id: string;
          campaign_id: string;
          version: number;
          body: string;
          author: 'llm' | 'human';
          author_user_id: string;
          model: string | null;
          prompt_snapshot: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          version: number;
          body: string;
          author: 'llm' | 'human';
          author_user_id: string;
          model?: string | null;
          prompt_snapshot?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          version?: number;
          body?: string;
          author?: 'llm' | 'human';
          author_user_id?: string;
          model?: string | null;
          prompt_snapshot?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pilot_links: {
        Row: {
          code: string;
          campaign_id: string | null;
          municipality_id: string;
          target_path: string;
          created_by: string;
          disabled_at: string | null;
          created_at: string;
        };
        Insert: {
          code: string;
          campaign_id?: string | null;
          municipality_id: string;
          target_path?: string;
          created_by: string;
          disabled_at?: string | null;
          created_at?: string;
        };
        Update: {
          code?: string;
          campaign_id?: string | null;
          municipality_id?: string;
          target_path?: string;
          created_by?: string;
          disabled_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pilot_link_clicks: {
        Row: {
          id: number;
          link_code: string;
          clicked_at: string;
          user_agent: string | null;
          referer: string | null;
          ip_hash: string | null;
          country: string | null;
          is_bot: boolean;
        };
        Insert: {
          link_code: string;
          clicked_at?: string;
          user_agent?: string | null;
          referer?: string | null;
          ip_hash?: string | null;
          country?: string | null;
          is_bot?: boolean;
        };
        Update: {
          link_code?: string;
          clicked_at?: string;
          user_agent?: string | null;
          referer?: string | null;
          ip_hash?: string | null;
          country?: string | null;
          is_bot?: boolean;
        };
        Relationships: [];
      };
      pilot_registrations: {
        Row: {
          id: string;
          user_id: string;
          role: 'participant' | 'observer';
          lat: number | null;
          lng: number | null;
          accuracy_m: number | null;
          location_consent_at: string | null;
          consent_version: string | null;
          claimed_municipality_id: string | null;
          gps_municipality_id: string | null;
          resolved_municipality_id: string | null;
          resolution: 'gps' | 'manual' | 'profile' | 'none';
          ref_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'participant' | 'observer';
          lat?: number | null;
          lng?: number | null;
          accuracy_m?: number | null;
          location_consent_at?: string | null;
          consent_version?: string | null;
          claimed_municipality_id?: string | null;
          gps_municipality_id?: string | null;
          resolved_municipality_id?: string | null;
          resolution?: 'gps' | 'manual' | 'profile' | 'none';
          ref_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: 'participant' | 'observer';
          lat?: number | null;
          lng?: number | null;
          accuracy_m?: number | null;
          location_consent_at?: string | null;
          consent_version?: string | null;
          claimed_municipality_id?: string | null;
          gps_municipality_id?: string | null;
          resolved_municipality_id?: string | null;
          resolution?: 'gps' | 'manual' | 'profile' | 'none';
          ref_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pilot_audit_log: {
        Row: {
          id: string;
          actor_user_id: string;
          municipality_id: string | null;
          action: string;
          object_type: 'cohort' | 'campaign' | 'copy' | 'link' | 'vote_set';
          object_id: string | null;
          prior_state: Json | null;
          new_state: Json | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id: string;
          municipality_id?: string | null;
          action: string;
          object_type: 'cohort' | 'campaign' | 'copy' | 'link' | 'vote_set';
          object_id?: string | null;
          prior_state?: Json | null;
          new_state?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_user_id?: string;
          municipality_id?: string | null;
          action?: string;
          object_type?: 'cohort' | 'campaign' | 'copy' | 'link' | 'vote_set';
          object_id?: string | null;
          prior_state?: Json | null;
          new_state?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      activate_ingest_vote: {
        Args: {
          p_vote_id: string;
          p_ingest_creator_id: string;
          p_min_created_at: string;
        };
        Returns: string | null;
      };
      ensure_ingest_vote_options: {
        Args: {
          p_vote_id: string;
          p_ingest_creator_id: string;
          p_min_created_at: string;
          p_texts: string[];
        };
        Returns: number;
      };
      set_claim: {
        Args: {
          claim: string;
          value: string;
        };
        Returns: void;
      };
      mfa_consume_pending_token: {
        Args: { p_id: string; p_user_id: string };
        Returns: boolean | null;
      };
      mfa_record_pending_attempt: {
        Args: { p_id: string; p_user_id: string };
        Returns: number | null;
      };
      mfa_accept_totp_step: {
        Args: { p_factor_id: string; p_user_id: string; p_step: number };
        Returns: boolean | null;
      };
      mfa_increment_confirm_attempts: {
        Args: { p_factor_id: string; p_user_id: string };
        Returns: number | null;
      };
      mfa_activate_factor: {
        Args: {
          p_factor_id: string;
          p_user_id: string;
          p_step: number;
          p_batch_id: string;
          p_code_hashes: string[];
        };
        Returns: boolean;
      };
      mfa_consume_recovery_code: {
        Args: { p_user_id: string; p_code_hash: string };
        Returns: boolean | null;
      };
      mfa_regenerate_recovery_codes: {
        Args: { p_user_id: string; p_batch_id: string; p_code_hashes: string[] };
        Returns: number;
      };
      users_bump_session_version: {
        Args: { p_user_id: string };
        Returns: number | null;
      };
      mfa_disable_factor: {
        Args: { p_user_id: string; p_reason: 'user' | 'operator_reset' };
        Returns: boolean;
      };
      reauth_consume_ticket: {
        Args: { p_id: string; p_user_id: string; p_purpose: string; p_allowed_methods?: string[] | null };
        Returns: boolean | null;
      };
      cast_vote: {
        Args: {
          p_user_id: string;
          p_vote_id: string;
          p_option_id: string;
          p_payment_id?: string | null;
        };
        Returns: {
          out_outcome: string;
          out_ballot_id: string;
          out_option_id: string;
          out_option_votes: number;
          out_participant_count: number;
          out_created_at: string;
        }[];
      };
      increment_vote_option: {
        Args: {
          option_id: string;
        };
        Returns: void;
      };
      get_or_create_treasury: {
        Args: {
          p_municipality_id: string;
        };
        Returns: string;
      };
      record_treasury_deposit: {
        Args: {
          p_municipality_id: string;
          p_amount_ils: number;
          p_payment_id: string;
          p_user_id: string;
          p_vote_id?: string | null;
          p_description?: string;
        };
        Returns: string;
      };
      municipality_profile_metrics: {
        Args: {
          m: string;
        };
        Returns: {
          residents: number;
          participants: number;
          avg_time_hours: number | null;
          satisfaction_avg: number | null;
          satisfaction_count: number;
        }[];
      };
      council_office_holders_public: {
        Args: {
          council_identifier: string;
        };
        Returns: {
          holder_id: string;
          council_code: string;
          role: string;
          full_name: string;
          term_start: string | null;
          term_end: string | null;
          /** Never null - the table refuses an unsourced office holder. */
          source_name: string;
          source_url: string;
          as_of: string;
          review_count: number;
          rating_average: number | null;
        }[];
      };
      council_network_public: {
        Args: {
          council_identifier: string;
        };
        Returns: {
          relation: string;
          council_code: string;
          name_he: string;
          slug_he: string;
          kind: string;
          source_name: string | null;
          source_url: string | null;
        }[];
      };
      knesset_roster_public: {
        Args: Record<string, never>;
        Returns: {
          person_id: number;
          slug: string;
          full_name: string;
          first_name: string;
          last_name: string;
          faction_name: string | null;
          knesset_num: number | null;
          source_name: string;
          source_url: string;
          as_of: string;
          /** Sitting offices as GovPosition-shaped JSON, highest standing first. */
          positions: unknown;
          matched_votes: number;
          agreed_votes: number;
          roll_calls: number;
          recorded_votes: number;
          review_count: number;
          rating_average: number | null;
          /** All four run -100..+100; NULL means not measured. */
          alignment_score: number | null;
          participation_score: number | null;
          trust_score: number | null;
          overall_score: number | null;
        }[];
      };
      government_civic_stats: {
        Args: Record<string, never>;
        Returns: {
          knesset_num: number | null;
          members: number;
          factions: number;
          open_topics: number;
          decided_topics: number;
          ballots_counted: number;
          platform_users: number;
          active_participants: number;
          matched_items: number;
          agreed_items: number;
          representation_score: number | null;
          engagement_score: number | null;
          cooperation_score: number | null;
          trust_score: number | null;
          overall_score: number | null;
        }[];
      };
      knesset_matched_votes_public: {
        Args: { p_limit?: number };
        Returns: {
          vote_id: string;
          title: string;
          item_id: number;
          vote_date: string | null;
          public_for: number;
          public_against: number;
          house_for: number;
          house_against: number;
          house_abstain: number;
          house_accepted: boolean;
          public_side: string | null;
          house_side: string | null;
        }[];
      };
      knesset_member_votes_public: {
        Args: { p_person_id: number };
        Returns: {
          vote_id: string;
          title: string;
          item_id: number;
          vote_date: string | null;
          public_for: number;
          public_against: number;
          house_for: number;
          house_against: number;
          house_abstain: number;
          house_accepted: boolean;
          public_side: string | null;
          house_side: string | null;
          member_stance: string | null;
        }[];
      };
      knesset_member_reviews_public: {
        Args: { p_person_id: number; viewer?: string | null };
        Returns: {
          review_id: string;
          rating: number;
          body: string | null;
          status: string;
          created_at: string;
          is_mine: boolean;
        }[];
      };
      municipality_civic_stats: {
        Args: Record<string, never>;
        Returns: {
          municipality_code: string;
          /** Sourced population; NULL where no authoritative figure is loaded. */
          residents: number | null;
          platform_users: number;
          active_participants: number;
          open_topics: number;
          /** All four scores run -100..+100; NULL means not measured. */
          engagement_score: number | null;
          cooperation_score: number | null;
          satisfaction_score: number | null;
          overall_score: number | null;
        }[];
      };
      public_council_metrics: {
        Args: {
          council_identifier: string;
        };
        Returns: {
          council_id: string;
          council_code: string;
          council_name_he: string;
          council_slug_he: string;
          official_population: number | null;
          population_source_name: string | null;
          population_source_url: string | null;
          population_as_of: string | null;
          population_updated_at: string | null;
          registered_users: number;
          community_managers: number;
          paying_users: number;
          relevant_votes: number;
          active_votes: number;
          aggregates_updated_at: string;
        }[];
      };
      // SQL lands in plan 05-07 (20260802000004_space_admin_metrics.sql); typed
      // here so a parallel-wave plan never has to reopen this hand-maintained file.
      space_admin_metrics: {
        Args: { space_uuid: string };
        Returns: {
          registered_residents: number | null;
          registered_residents_status: 'available' | 'suppressed' | 'unavailable';
          active_participants_30d: number | null;
          active_participants_30d_status: 'available' | 'suppressed' | 'unavailable';
          proposals_submitted: number | null;
          proposals_submitted_status: 'available' | 'suppressed' | 'unavailable';
          participation_rate_pct: number | null;
          participation_rate_pct_status: 'available' | 'suppressed' | 'unavailable';
          generated_at: string;
        }[];
      };
      pilot_engagement_ranking: {
        Args: Record<string, never>;
        Returns: {
          municipality_id: string;
          vote_count: number;
          post_count: number;
          comments_count: number;
          reactions_count: number;
          score: number;
        }[];
      };
      pilot_link_click_stats: {
        Args: { p_code: string };
        Returns: {
          day: string;
          total_clicks: number;
          human_clicks: number;
          unique_visitors: number;
        }[];
      };
      pilot_campaign_funnel: {
        Args: { p_campaign: string };
        Returns: {
          clicks: number;
          unique_visitors: number;
          registrations: number;
          participants: number;
          ballots: number;
        }[];
      };
      pilot_overview: {
        Args: Record<string, never>;
        Returns: {
          municipality_id: string;
          rank: number | null;
          status: 'selected' | 'active' | 'paused' | 'completed';
          campaigns: number;
          posted_campaigns: number;
          human_clicks: number;
          registrations: number;
          participants: number;
          ballots: number;
        }[];
      };
      can_admin_space: {
        Args: { p_space: string | null };
        Returns: boolean;
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      user_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
    Enums: {
      verification_status: 'none' | 'pending' | 'verified' | 'failed';
      payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
      payment_type: 'vote_participation' | 'vote_creation';
      social_provider: 'google' | 'facebook' | 'instagram';
      vote_status:
        | 'draft'
        | 'in_review'
        | 'changes_requested'
        | 'rejected'
        | 'pending'
        | 'active'
        | 'ended'
        | 'resolving'
        | 'resolved'
        | 'failed';
      entitlement_type: 'vote' | 'create_vote' | 'tokens';
      nft_type: 'verified_voter' | 'civic_patron';
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
export type PushToken = Tables<'push_tokens'>;
export type WebhookEvent = Tables<'webhook_events'>;
export type VoteNft = Tables<'vote_nfts'>;
export type MerchOrderRow = Tables<'merch_orders'>;
export type VoteSource = Tables<'vote_sources'>;
export type IdentityDocument = Tables<'identity_documents'>;
export type IdentityDocumentEvent = Tables<'identity_document_events'>;
export type KnessetItem = Tables<'knesset_items'>;
export type Space = Tables<'spaces'>;
export type SpaceCapabilityGrant = Tables<'space_capability_grants'>;
export type SpaceMemberSuspension = Tables<'space_member_suspensions'>;
export type SpaceAuditRow = Tables<'space_audit_log'>;
export type PlatformEscalation = Tables<'platform_escalations'>;
export type SpaceNotificationCampaign = Tables<'space_notification_campaigns'>;
export type SpaceNotificationDelivery = Tables<'space_notification_deliveries'>;
export type UserNotification = Tables<'user_notifications'>;
export type RoleGrant = Tables<'role_grants'>;
export type CommunityManagerApplication = Tables<'community_manager_applications'>;
export type RoleGrantEvent = Tables<'role_grant_events'>;
export type KnessetRanking = Tables<'knesset_rankings'>;
export type VoteCardArt = Tables<'vote_card_art'>;
export type PilotMunicipality = Tables<'pilot_municipalities'>;
export type PilotVoteRow = Tables<'pilot_votes'>;
export type PilotCampaignRow = Tables<'pilot_campaigns'>;
export type PilotCampaignCopyRow = Tables<'pilot_campaign_copies'>;
export type PilotLinkRow = Tables<'pilot_links'>;
export type PilotLinkClickRow = Tables<'pilot_link_clicks'>;
export type PilotRegistrationRow = Tables<'pilot_registrations'>;
export type PilotAuditRow = Tables<'pilot_audit_log'>;

// Issue #71 MFA (migrations 20260901000002/-03)
export type MfaFactorRow = Tables<'user_mfa_factors'>;
export type RecoveryCodeRow = Tables<'user_recovery_codes'>;
export type MfaPendingTokenRow = Tables<'mfa_pending_tokens'>;
export type ReauthTicketRow = Tables<'reauth_tickets'>;
export type SecurityEventRow = Tables<'security_events'>;
export type SecuritySettingsRow = Tables<'security_settings'>;
export type SecurityEventType = SecurityEventRow['event_type'];
export type ReauthPurpose = ReauthTicketRow['purpose'];
export type ReauthMethod = ReauthTicketRow['method'];
