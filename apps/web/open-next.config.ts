import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * OpenNext → Cloudflare adapter config.
 *
 * Defaults are correct for this app: SSR + API routes run on the Workers
 * Node.js runtime (see `nodejs_compat` in wrangler.jsonc). No incremental
 * cache binding is configured yet — add an R2 / KV `incrementalCache` here if
 * ISR/Data-Cache persistence is needed across deploys.
 *
 * @see https://opennext.js.org/cloudflare
 */
export default defineCloudflareConfig({
  // incrementalCache: r2IncrementalCache,  // wire when ISR caching is needed
});
