import { ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { InsertTables, PilotLinkRow } from '@/lib/supabase/types';
import { dbError, type AppError } from '@/server/http/errors';

export function findPilotLink(code: string): ResultAsync<PilotLinkRow | null, AppError> {
  const query = supabaseAdmin
    .from('pilot_links')
    .select('*')
    .eq('code', code)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_links.find', cause));
}

export function findPilotLinkByCampaign(
  campaignId: string
): ResultAsync<PilotLinkRow | null, AppError> {
  const query = supabaseAdmin
    .from('pilot_links')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
  return ResultAsync.fromPromise(query, (cause) =>
    dbError('pilot_links.findByCampaign', cause)
  );
}

export async function pilotLinkCodeExists(code: string): Promise<boolean> {
  return await supabaseAdmin
    .from('pilot_links')
    .select('code')
    .eq('code', code)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return Boolean(data);
    });
}

export function insertPilotLink(
  row: InsertTables<'pilot_links'>
): ResultAsync<PilotLinkRow, AppError> {
  const query = supabaseAdmin
    .from('pilot_links')
    .insert(row)
    .select('*')
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_links.insert', cause));
}

export function insertPilotLinkClick(
  row: InsertTables<'pilot_link_clicks'>
): ResultAsync<void, AppError> {
  const query = supabaseAdmin
    .from('pilot_link_clicks')
    .insert(row)
    .then(({ error }) => {
      if (error) throw error;
    });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_link_clicks.insert', cause));
}

export function listPilotLinks(): ResultAsync<PilotLinkRow[], AppError> {
  const query = supabaseAdmin
    .from('pilot_links')
    .select('*')
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) throw error;
      return data ?? [];
    });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_links.list', cause));
}
