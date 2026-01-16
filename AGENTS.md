## Build & Run

Monorepo structure:
- `apps/web/` - Next.js 17 marketing site & dashboard
- `apps/mobile/` - React Native app (Expo SDK 52)
- `packages/shared/` - Shared types, constants, utils
- `packages/api-client/` - API client library
- `packages/design-tokens/` - Design system tokens

```bash
pnpm install                    # Install all dependencies
pnpm dev                        # Run all apps
pnpm dev:web                    # Run web only (localhost:3000)
pnpm dev:mobile                 # Run mobile (Expo)
```

## Validation

Run these after implementing to get immediate feedback:

- Tests: `pnpm test` (476 tests passing - 106 shared, 110 api-client, 260 web)
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Build: `pnpm build`

## Operational Notes

- pnpm workspaces + turborepo for monorepo
- Expo Router v4 for mobile navigation
- Next.js App Router with i18n (`[locale]` routes)
- NativeWind for mobile styling
- CSS Modules + design tokens for web
- RTL Hebrew layout throughout

### Codebase Patterns

- Web pages in `apps/web/src/app/[locale]/`
- Mobile screens in `apps/mobile/app/`
- API routes in `apps/web/src/app/api/`
- Shared types in `packages/shared/src/types/`
- Design tokens in `packages/design-tokens/src/`

### External Services

- Auth: Supabase Auth (replacing SEL-DID)
- Database: Supabase
- Payments: Morning API (Israeli fiat gateway)
- SocialFi: Bags.fm (Issue Coins, NFTs) - docs: https://docs.bags.fm/
- SMS: TBD (for verification fallback)

### Context7 Rule

IMPORTANT: Use Context7 MCP to pull the most recent documentation for external services before implementing integrations.
