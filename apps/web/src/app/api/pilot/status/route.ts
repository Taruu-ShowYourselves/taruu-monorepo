import { getPilotStatus } from '@/server/app/pilot/status';
import { respond } from '@/server/http/respond';

export async function GET() {
  return respond(getPilotStatus(), { cacheControl: 'public, max-age=60, s-maxage=60' });
}
