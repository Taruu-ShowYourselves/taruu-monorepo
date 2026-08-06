/**
 * Append-only pilot audit trail. Insert is the only operation this module
 * exposes — the table itself refuses UPDATE/DELETE/TRUNCATE via trigger.
 */

import { ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { InsertTables } from '@/lib/supabase/types';
import { dbError, type AppError } from '@/server/http/errors';

export type PilotAuditInsert = InsertTables<'pilot_audit_log'>;

export function insertPilotAudit(
  entry: PilotAuditInsert
): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('pilot_audit_log')
    .insert(entry)
    .then(({ error }) => {
      if (error) throw error;
    });

  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_audit_log.insert', cause)
  );
}
