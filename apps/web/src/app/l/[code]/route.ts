import { after, type NextRequest, NextResponse } from 'next/server';
import { hashPilotClickIp } from '@/server/domain/pilot/click-privacy';
import { isPilotBotUserAgent } from '@/server/domain/pilot/link-code';
import { findPilotLink, insertPilotLinkClick } from '@/server/infra/supabase/pilot-link.repo';

const REF_COOKIE = 'taruu_ref';

function defer(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    void task().catch(() => {});
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const result = await findPilotLink(code);
  if (result.isErr() || !result.value || result.value.disabled_at) {
    return NextResponse.redirect(new URL('/', request.url), 302);
  }

  const link = result.value;
  const target = new URL(link.target_path, request.nextUrl.origin);
  target.searchParams.set('ref', link.code);
  target.searchParams.set('utm_source', 'facebook');
  target.searchParams.set('utm_medium', 'group');
  target.searchParams.set('utm_campaign', 'pilot');
  target.searchParams.set('utm_content', link.code);

  const response = NextResponse.redirect(target, 302);
  response.cookies.set(REF_COOKIE, link.code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  const userAgent = request.headers.get('user-agent');
  const forwarded = request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;
  defer(async () => {
    const ipHash = await hashPilotClickIp(forwarded);
    await insertPilotLinkClick({
      link_code: link.code,
      user_agent: userAgent?.slice(0, 256) ?? null,
      referer: request.headers.get('referer')?.slice(0, 512) ?? null,
      ip_hash: ipHash,
      country: request.headers.get('cf-ipcountry')?.slice(0, 2).toUpperCase() ?? null,
      is_bot: isPilotBotUserAgent(userAgent),
    });
  });

  return response;
}
