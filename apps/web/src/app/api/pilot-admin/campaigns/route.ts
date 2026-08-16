import type { NextRequest } from 'next/server';
import { CreateCampaignRequestSchema } from '@sync/shared/contracts';
import { createPilotCampaign, listCampaignDesk } from '@/server/app/pilot/campaigns';
import { parse, respond } from '@/server/http/respond';
import { getSessionFromRequest } from '@/services/auth/session';
export async function GET(request: NextRequest) { return respond(listCampaignDesk(await getSessionFromRequest(request))); }
export async function POST(request: NextRequest) { const session = await getSessionFromRequest(request); return respond(parse(CreateCampaignRequestSchema, await request.json().catch(() => null)).asyncAndThen((body) => createPilotCampaign(session, body)), { status: 201 }); }
