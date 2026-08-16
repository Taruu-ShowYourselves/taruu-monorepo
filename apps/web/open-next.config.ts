import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import { withRegionalCache } from '@opennextjs/cloudflare/overrides/incremental-cache/regional-cache';

/**
 * OpenNext → Cloudflare adapter config.
 *
 * SSR + API routes run on the Workers Node.js runtime (see `nodejs_compat` in
 * wrangler.jsonc).
 *
 * Incremental cache: without it `export const revalidate` is inert on Workers -
 * every ISR route regenerates per isolate, which is what pinned the homepage at
 * a ~4s TTFB. R2 rather than KV because entries are whole HTML+RSC documents
 * (hundreds of KB) and R2 has no per-key write-rate ceiling; `withRegionalCache`
 * puts a colo-local read in front of the bucket so repeat hits in one region
 * never reach R2 at all.
 *
 * `queue: 'direct'` revalidates inline. The Durable Object queue would have to
 * be re-exported from worker.ts, which is a custom entry (OpenNext handler +
 * the cron `scheduled` handler) - not worth the coupling at this traffic.
 *
 * @see https://opennext.js.org/cloudflare/caching
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: 'long-lived' }),
  queue: 'direct',
});
