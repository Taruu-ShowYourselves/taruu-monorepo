/**
 * Test-time stand-in for the `server-only` marker package.
 *
 * `server-only`'s default entry is a bare `throw` - that is the whole point of
 * the package: a client bundle that reaches it fails loudly at build time. Next
 * resolves the harmless `./empty.js` through the `react-server` export
 * condition, but Vitest runs plain Node without that condition, so the real
 * entry would abort every test that touches a server module.
 *
 * Aliased in `vitest.config.ts`. The guarantee `server-only` encodes is a
 * bundler concern, not a runtime one, so stubbing it in tests removes nothing.
 */
export {};
