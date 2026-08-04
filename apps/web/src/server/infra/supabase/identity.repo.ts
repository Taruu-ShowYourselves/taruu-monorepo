/**
 * Identity-document repository - Result-typed access to identity_documents.
 *
 * Only extracted fields ever reach this layer; images never leave the client.
 */

import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type {
  IdentityDocument,
  IdentityDocumentEvent,
  InsertTables,
} from '@/lib/supabase/types';
import { dbError, type AppError } from '@/server/http/errors';

export function findDocumentByUserId(
  userId: string
): ResultAsync<IdentityDocument | null, AppError> {
  const query = supabaseAdmin
    .from('identity_documents')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('identity_documents.findByUserId', cause)
  );
}

/** Another user already claimed this ID number? (dedup across accounts) */
export function idHashClaimedByOther(
  idNumberHash: string,
  userId: string
): ResultAsync<boolean, AppError> {
  const query = supabaseAdmin
    .from('identity_documents')
    .select('user_id')
    .eq('id_number_hash', idNumberHash)
    .neq('user_id', userId)
    .limit(1)
    .then(({ data, error }) => {
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('identity_documents.idHashClaimedByOther', cause)
  );
}

export function upsertDocument(
  row: InsertTables<'identity_documents'>
): ResultAsync<IdentityDocument, AppError> {
  const query = supabaseAdmin
    .from('identity_documents')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('identity_documents.upsert', cause)
  );
}

export function insertDocumentEvent(
  row: InsertTables<'identity_document_events'>
): ResultAsync<IdentityDocumentEvent, AppError> {
  const query = supabaseAdmin
    .from('identity_document_events')
    .insert(row)
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('identity_document_events.insert', cause)
  );
}

export function setUserIdentityVerifiedAt(
  userId: string,
  verifiedAt: string | null
): ResultAsync<true, AppError> {
  const query = supabaseAdmin
    .from('users')
    .update({ identity_verified_at: verifiedAt, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .then(({ error }) => {
      if (error) throw error;
      return true as const;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('users.setIdentityVerifiedAt', cause)
  ).andThen(() => okAsync<true, AppError>(true));
}

/** User-initiated erasure (§14 deletion right): remove fields, keep event. */
export function deleteDocumentByUserId(userId: string): ResultAsync<true, AppError> {
  const query = supabaseAdmin
    .from('identity_documents')
    .delete()
    .eq('user_id', userId)
    .then(({ error }) => {
      if (error) throw error;
      return true as const;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('identity_documents.delete', cause)
  ).andThen(() => okAsync<true, AppError>(true));
}

export { errAsync as _errAsync };
