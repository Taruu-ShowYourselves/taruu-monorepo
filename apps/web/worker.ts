/**
 * Custom Cloudflare Worker entry.
 *
 * Re-exports the OpenNext-generated fetch handler and adds a `scheduled`
 * handler so Cloudflare Cron Triggers can drive the app's existing HTTP cron
 * routes (guarded by CRON_SECRET). The cron expression that fired is matched to
 * its route via CRON_ROUTES — keep these in sync with `triggers.crons` in
 * wrangler.jsonc.
 *
 * Types are declared locally on purpose: importing @cloudflare/workers-types
 * globally would clash with the Next.js DOM lib. `Request` is the DOM global,
 * which is correct on the Workers runtime too.
 *
 * @see https://opennext.js.org/cloudflare/howtos/custom-worker
 */

// @ts-ignore — generated at build time by `opennextjs-cloudflare build`
import { default as handler } from './.open-next/worker.js';

interface ScheduledEvent {
  readonly cron: string;
  readonly scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface Env {
  CRON_SECRET?: string;
  NEXT_PUBLIC_APP_URL?: string;
  [key: string]: unknown;
}

/** Cron expression → the HTTP route it should POST. Mirror wrangler triggers. */
const CRON_ROUTES: Record<string, string> = {
  '*/15 * * * *': '/api/cron/verification-notifications',
  '0 * * * *': '/api/cron/resolve-votes',
  '*/10 * * * *': '/api/cron/mint-nfts',
};

export default {
  fetch: handler.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const path = CRON_ROUTES[event.cron];
    if (!path) return;

    const origin = env.NEXT_PUBLIC_APP_URL || 'https://taruu.co.il';
    const request = new Request(`${origin}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}` },
    });

    // Run inside the scheduled lifetime; let it finish even after the handler returns.
    ctx.waitUntil(handler.fetch(request, env, ctx));
  },
};
