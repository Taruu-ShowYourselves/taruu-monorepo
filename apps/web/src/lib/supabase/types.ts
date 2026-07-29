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
          identity_verified_at: string | null;
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
          identity_verified_at?: string | null;
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
          identity_verified_at?: string | null;
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
          status: 'pending' | 'active' | 'ended' | 'resolving' | 'resolved' | 'failed';
          start_date: string;
          end_date: string;
          participant_count: number;
          resolved_at: string | null;
          resolution_status: 'pending' | 'resolving' | 'resolved' | 'failed' | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          title: string;
          description: string;
          municipality_id: string;
          status?: 'pending' | 'active' | 'ended' | 'resolving' | 'resolved' | 'failed';
          start_date?: string;
          end_date: string;
          participant_count?: number;
          resolved_at?: string | null;
          resolution_status?: 'pending' | 'resolving' | 'resolved' | 'failed' | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          title?: string;
          description?: string;
          municipality_id?: string;
          status?: 'pending' | 'active' | 'ended' | 'resolving' | 'resolved' | 'failed';
          start_date?: string;
          end_date?: string;
          participant_count?: number;
          resolved_at?: string | null;
          resolution_status?: 'pending' | 'resolving' | 'resolved' | 'failed' | null;
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
      knesset_rankings: {
        Row: {
          id: string;
          vote_id: string;
          hotness: number;
          relevance: number | null;
          media: number | null;
          rationale: string | null;
          media_refs: string[];
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
          media?: number | null;
          rationale?: string | null;
          media_refs?: string[];
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
          media?: number | null;
          rationale?: string | null;
          media_refs?: string[];
          model?: string | null;
          ranked_at?: string;
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
    };
    Enums: {
      verification_status: 'none' | 'pending' | 'verified' | 'failed';
      payment_status: 'pending' | 'completed' | 'failed' | 'refunded';
      payment_type: 'vote_participation' | 'vote_creation';
      social_provider: 'google' | 'facebook' | 'instagram';
      vote_status: 'pending' | 'active' | 'ended' | 'resolving' | 'resolved' | 'failed';
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
export type KnessetRanking = Tables<'knesset_rankings'>;
