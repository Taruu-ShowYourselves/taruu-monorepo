import { ResultAsync } from 'neverthrow';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { InsertTables, PilotCampaignCopyRow, PilotCampaignRow } from '@/lib/supabase/types';
import { dbError, type AppError } from '@/server/http/errors';

export function listPilotCampaigns(): ResultAsync<PilotCampaignRow[], AppError> {
  const query = supabaseAdmin.from('pilot_campaigns').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
    if (error) throw error;
    return data ?? [];
  });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_campaigns.list', cause));
}

export function findPilotCampaign(id: string): ResultAsync<PilotCampaignRow | null, AppError> {
  const query = supabaseAdmin.from('pilot_campaigns').select('*').eq('id', id).maybeSingle().then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_campaigns.find', cause));
}

export function insertPilotCampaign(row: InsertTables<'pilot_campaigns'>): ResultAsync<PilotCampaignRow, AppError> {
  const query = supabaseAdmin.from('pilot_campaigns').insert(row).select('*').single().then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_campaigns.insert', cause));
}

export function deletePilotCampaign(id: string): ResultAsync<void, AppError> {
  const query = supabaseAdmin.from('pilot_campaigns').delete().eq('id', id).then(({ error }) => {
    if (error) throw error;
  });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_campaigns.delete', cause));
}

export function listCampaignCopies(campaignId: string): ResultAsync<PilotCampaignCopyRow[], AppError> {
  const query = supabaseAdmin.from('pilot_campaign_copies').select('*').eq('campaign_id', campaignId).order('version', { ascending: false }).then(({ data, error }) => {
    if (error) throw error;
    return data ?? [];
  });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_campaign_copies.list', cause));
}

export function insertCampaignCopy(row: InsertTables<'pilot_campaign_copies'>): ResultAsync<PilotCampaignCopyRow, AppError> {
  const query = supabaseAdmin.from('pilot_campaign_copies').insert(row).select('*').single().then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_campaign_copies.insert', cause));
}

export function setCampaignCurrentCopy(
  campaignId: string,
  copyId: string
): ResultAsync<PilotCampaignRow, AppError> {
  const query = supabaseAdmin.from('pilot_campaigns').update({ current_copy_id: copyId, status: 'ready', updated_at: new Date().toISOString() }).eq('id', campaignId).in('status', ['draft', 'ready']).select('*').single().then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_campaigns.setCurrentCopy', cause));
}

export function markCampaignPosted(
  campaignId: string,
  userId: string,
  permalink: string
): ResultAsync<PilotCampaignRow | null, AppError> {
  const now = new Date().toISOString();
  const query = supabaseAdmin.from('pilot_campaigns').update({ status: 'posted', posted_at: now, posted_by: userId, post_permalink: permalink, updated_at: now }).eq('id', campaignId).eq('status', 'ready').select('*').maybeSingle().then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
  return ResultAsync.fromPromise(query, (cause) => dbError('pilot_campaigns.markPosted', cause));
}
