# תַּרְאוּ (Taro)

A civic consensus platform for Israeli municipalities. Citizens vote on local affairs with transparent results, GPS verification, and community-backed positions.

## Overview

Taro helps communities form a transparent civic majority on issues that truly matter. We create an objective picture that helps authorities understand residents' wishes and act in coordination with the community.

**Currently in pilot in Kiryat Tivon.**

## Features

- **Transparent Voting** - Real-time results presented to local councils
- **GPS Verification** - Location-based resident verification
- **Community Voice** - ₪3 participation fee backs positions professionally
- **Bilingual Support** - Full Hebrew (RTL) and English (LTR) support

## Tech Stack

### Web App (`apps/web`)
- **Framework**: Next.js 15 with App Router
- **Styling**: CSS Modules with design tokens
- **Animations**: Framer Motion
- **Smooth Scroll**: Lenis
- **i18n**: Locale-based routing (`/he`, `/en`)

### Mobile App (`apps/mobile`)
- **Framework**: Expo SDK 52 / React Native
- **Navigation**: Expo Router v4
- **Styling**: NativeWind (Tailwind for RN)
- **State**: Zustand
- **Animations**: Reanimated

### Services
- **Auth**: Custom SEL-DID system
- **Database**: Supabase
- **Payments**: Green Invoice (Israeli payment processing)
- **Newsletter**: Beehiiv
- **Hosting**: Vercel

## Getting Started

```bash
# Install dependencies
pnpm install

# Run all apps in development
pnpm dev

# Run specific app
pnpm dev --filter @sync/web
pnpm dev --filter @sync/mobile

# Build all packages
pnpm build

# Run linting
pnpm lint

# Run type checking
pnpm typecheck
```

## Project Structure

```
/
├── apps/
│   ├── web/                    # Next.js website
│   │   ├── src/
│   │   │   ├── app/            # App router (with [locale] support)
│   │   │   ├── components/     # React components
│   │   │   ├── lib/            # Utilities and i18n
│   │   │   ├── styles/         # Global styles and tokens
│   │   │   └── hooks/          # Custom React hooks
│   │   └── public/             # Static assets
│   │
│   └── mobile/                 # Expo React Native app
│       ├── app/                # Expo Router screens
│       └── src/                # Source code
│
├── packages/
│   ├── shared/                 # Shared types, constants, utils
│   ├── api-client/             # API client library
│   └── design-tokens/          # Shared design tokens
│
└── docs/                       # Documentation
```

## Environment Variables

Create `.env.local` in `apps/web/`:

```env
# Beehiiv Newsletter
BEEHIIV_API_KEY=your_api_key
BEEHIIV_PUBLICATION_ID=pub_your_publication_id

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Other services as needed
```

## Design System

The project uses a consistent design system with:
- **Typography**: Heebo (headings), Assistant (body) - Hebrew-optimized fonts
- **Colors**: Primary (Trust Blue #2563EB), Secondary (Growth Green #10B981)
- **Spacing**: 4px base unit scale
- **Direction**: RTL for Hebrew, LTR for English

See `CLAUDE.md` for full design token documentation.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support the Project

[Support on IsraelGives](https://my.israelgives.org/he/fundme/taroo)

## Links

- [WhatsApp Pilot Group](https://chat.whatsapp.com/FITvea9IVsn2Ljie1yCrAc)

## License

All rights reserved. © תַּרְאוּ (Taro)

---

Built with love by [saharbarak.dev](https://saharbarak.dev)
