# CLAUDE.md - Sync Project Guide

## Project Overview

**Sync** (סינק) is a civic consensus platform for Israeli municipalities. Citizens vote on local affairs with blockchain verification, GPS pinning, and financial authentication.

## Quick Start

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

## Monorepo Structure

```
/
├── apps/
│   ├── web/                    # Next.js 17 website
│   │   ├── app/                # App router pages
│   │   ├── components/         # React components
│   │   │   ├── ui/             # Base UI components
│   │   │   ├── layout/         # Layout components
│   │   │   ├── sections/       # Page sections
│   │   │   └── animations/     # Animation components
│   │   ├── lib/                # Utilities and helpers
│   │   ├── styles/             # Global styles and tokens
│   │   ├── hooks/              # Custom React hooks
│   │   └── providers/          # Context providers
│   │
│   └── mobile/                 # Expo React Native app
│       ├── app/                # Expo Router screens
│       │   ├── (auth)/         # Auth flow screens
│       │   ├── (tabs)/         # Main tab screens
│       │   ├── settings/       # Settings screens
│       │   └── vote/           # Vote detail screens
│       ├── src/
│       │   ├── hooks/          # Custom React hooks
│       │   └── lib/            # Utilities
│       └── assets/             # Images and fonts
│
├── packages/
│   ├── shared/                 # Shared types, constants, utils
│   │   └── src/
│   │       ├── types/          # TypeScript types
│   │       ├── constants/      # App constants
│   │       └── utils/          # Helper functions
│   │
│   ├── api-client/             # API client library
│   │   └── src/
│   │       ├── client.ts       # Base API client
│   │       ├── votes.ts        # Votes API
│   │       ├── users.ts        # Users API
│   │       └── payments.ts     # Payments API
│   │
│   └── design-tokens/          # Shared design tokens
│       └── src/
│           ├── colors.ts       # Color palette
│           ├── typography.ts   # Font scales
│           ├── spacing.ts      # Spacing scale
│           └── animations.ts   # Animation config
│
└── docs/                       # Documentation
    └── PRD.md                  # Product Requirements
```

## Tech Stack

### Web (apps/web)

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 17 | Web application |
| Animations | Framer Motion | Motion and transitions |
| Smooth Scroll | Lenis | Silky scroll experience |
| Styling | CSS Modules | Scoped component styles |

### Mobile (apps/mobile)

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Expo SDK 52 | React Native runtime |
| Navigation | Expo Router v4 | File-based routing |
| Styling | NativeWind | Tailwind for RN |
| State | Zustand | State management |
| Animations | Reanimated | Native animations |
| Location | expo-location | GPS verification |
| Browser | expo-web-browser | Payment redirect |

### Shared

| Layer | Technology | Purpose |
|-------|------------|---------|
| Auth | Clerk | User authentication |
| Blockchain | Qubik | Vote recording & tokens |
| Database | Converge | Secondary data storage |
| Payments | Green Invoice | Israeli payment processing |
| Subscriptions | Grow | Payment management |
| Email | Resend | Transactional emails |
| Hosting | Vercel | Deployment platform |

## Packages

### @sync/shared

Shared types, constants, and utilities:

```typescript
// Types
import type { Vote, UserProfile, PaymentIntent } from '@sync/shared';

// Constants
import { VOTE_COST, CREATE_VOTE_COST, MUNICIPALITIES } from '@sync/shared';

// Utils
import { formatCurrency, formatDate, getTimeRemaining } from '@sync/shared';
```

### @sync/api-client

API client for all endpoints:

```typescript
import { initializeApiClient, votesApi, usersApi, paymentsApi } from '@sync/api-client';

// Initialize with auth token
initializeApiClient({
  baseUrl: 'https://api.sync.co.il',
  getToken: async () => await getAuthToken(),
});

// Use APIs
const votes = await votesApi.getActiveVotes();
const profile = await usersApi.getProfile();
```

### @sync/design-tokens

Shared design tokens:

```typescript
import { colors, typography, spacing, animations } from '@sync/design-tokens';

// Use in NativeWind config or CSS-in-JS
const primaryColor = colors.primary[600]; // '#2563EB'
```

## Design System

### CRITICAL: No Hardcoded Values

**NEVER** use hardcoded colors, sizes, or spacing. Always use design tokens:

```tsx
// ❌ WRONG - Web
<div style={{ color: '#2563EB', padding: '16px' }}>

// ✅ CORRECT - Web
<div className={styles.container}>
// With CSS: color: var(--color-primary); padding: var(--space-4);

// ❌ WRONG - Mobile
<View style={{ backgroundColor: '#2563EB' }}>

// ✅ CORRECT - Mobile
<View className="bg-primary-600">
```

### Typography Scale (1.2 - Minor Third)

```css
--text-xs:    0.694rem   /* 11.1px */
--text-sm:    0.833rem   /* 13.3px */
--text-base:  1rem       /* 16px   */
--text-lg:    1.2rem     /* 19.2px */
--text-xl:    1.44rem    /* 23px   */
--text-2xl:   1.728rem   /* 27.6px */
--text-3xl:   2.074rem   /* 33.2px */
--text-4xl:   2.488rem   /* 39.8px */
--text-5xl:   2.986rem   /* 47.8px */
--text-6xl:   3.583rem   /* 57.3px */
--text-7xl:   4.3rem     /* 68.8px */
```

### Fonts

- **Primary**: Heebo (Hebrew-optimized, headings)
- **Secondary**: Assistant (UI text)
- **Direction**: RTL only (Hebrew)

### Colors

```css
/* Primary - Trust Blue */
--color-primary: #2563EB;
--color-primary-light: #3B82F6;
--color-primary-dark: #1D4ED8;

/* Secondary - Growth Green */
--color-secondary: #10B981;
--color-secondary-light: #34D399;
--color-secondary-dark: #059669;

/* Accent - Innovation Purple */
--color-accent: #8B5CF6;

/* Neutrals */
--color-neutral-50 through --color-neutral-900
```

### Spacing

```css
--space-1:  0.25rem  /* 4px   */
--space-2:  0.5rem   /* 8px   */
--space-3:  0.75rem  /* 12px  */
--space-4:  1rem     /* 16px  */
--space-6:  1.5rem   /* 24px  */
--space-8:  2rem     /* 32px  */
--space-12: 3rem     /* 48px  */
--space-16: 4rem     /* 64px  */
--space-24: 6rem     /* 96px  */
```

## Mobile App Screens

### Auth Flow (`apps/mobile/app/(auth)/`)
- `index.tsx` - Welcome screen
- `sign-in.tsx` - Sign in with Clerk
- `sign-up.tsx` - Sign up with email verification
- `onboarding.tsx` - Municipality selection

### Main Tabs (`apps/mobile/app/(tabs)/`)
- `index.tsx` - Home/Active Votes
- `votes.tsx` - All Votes (with filters)
- `create.tsx` - Create Vote (3-step wizard)
- `profile.tsx` - User Profile & Stats

### Vote Detail (`apps/mobile/app/vote/`)
- `[id].tsx` - Vote details, GPS verification, voting

### Settings (`apps/mobile/app/settings/`)
- `profile.tsx` - Edit profile
- `municipality.tsx` - Change municipality
- `notifications.tsx` - Notification preferences
- `verification.tsx` - Identity verification

## API Routes

### Authentication
- `POST /api/auth/clerk-webhook` - Clerk webhook handler
- `GET /api/auth/user` - Get current user

### Votes
- `GET /api/votes` - List votes (with municipality filter)
- `GET /api/votes/[id]` - Get vote details
- `POST /api/votes` - Create new vote (₪50)
- `POST /api/votes/[id]/participate` - Cast vote (₪1)
- `POST /api/votes/[id]/verify-location` - GPS verification

### User
- `GET /api/user/profile` - Get user profile
- `POST /api/user/profile` - Create profile
- `PATCH /api/user/profile` - Update profile
- `GET /api/user/votes` - User's voting history
- `GET /api/user/tokens` - Token balance
- `POST /api/user/verify-location` - Verify user location

### Payments
- `POST /api/payments/create` - Create payment intent
- `GET /api/payments/[id]/status` - Check payment status
- `POST /api/payments/webhook` - Green Invoice webhook

## Environment Variables

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=

# Qubik Blockchain
QUBIK_API_KEY=
QUBIK_NETWORK=mainnet

# Converge Database
CONVERGE_API_KEY=
CONVERGE_PROJECT_ID=

# Green Invoice
GREEN_INVOICE_API_KEY=
GREEN_INVOICE_SECRET=

# Grow
GROW_API_KEY=

# Resend
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://sync.co.il
EXPO_PUBLIC_API_URL=https://api.sync.co.il
```

## Mobile Development

### Running the app

```bash
# Start Expo development server
cd apps/mobile
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

### Building for production

```bash
# Build iOS
eas build --platform ios

# Build Android
eas build --platform android
```

## Code Style

### TypeScript
- Strict mode enabled
- No `any` types - use proper typing
- Interface for objects, type for unions

### Imports (Web)
```tsx
// Order: React, Next, external, internal, styles
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import styles from './Component.module.css';
```

### Imports (Mobile)
```tsx
// Order: React, React Native, Expo, external, internal
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { votesApi } from '@sync/api-client';
```

### Naming Conventions
- Components: PascalCase (`VoteCard.tsx`)
- Hooks: camelCase with `use` prefix (`useVotes.ts`)
- Utils: camelCase (`formatCurrency.ts`)
- CSS Modules: camelCase (`styles.container`)
- NativeWind: Tailwind classes (`className="bg-primary-600"`)
- Design tokens: kebab-case (`--color-primary`)

## Common Tasks

### Adding a New Web Page
1. Create file in `apps/web/app/[route]/page.tsx`
2. Add metadata export
3. Use design system tokens only
4. Implement RTL layout

### Adding a New Mobile Screen
1. Create file in `apps/mobile/app/[route].tsx`
2. Use NativeWind for styling
3. Import from shared packages
4. Add RTL support with `flex-row-reverse`

### Adding a Shared Type
1. Add to `packages/shared/src/types/`
2. Export from `packages/shared/src/types/index.ts`
3. Re-export from `packages/shared/src/index.ts`

### Adding an API Endpoint
1. Add method to appropriate file in `packages/api-client/src/`
2. Use proper TypeScript types from `@sync/shared`

## Troubleshooting

### Common Issues

**Hebrew text not displaying correctly**
- Web: Ensure `dir="rtl"` on html element
- Mobile: Use `flex-row-reverse` for RTL layouts

**NativeWind classes not working**
- Check `tailwind.config.js` content paths
- Verify `global.css` is imported in `_layout.tsx`
- Run `npx expo start -c` to clear cache

**Shared packages not resolving**
- Run `pnpm install` at root
- Check `metro.config.js` for monorepo setup
- Verify package `main` field in package.json

**Expo location not working**
- Check location permissions in `app.json`
- Request permissions before accessing location
- Test on physical device (simulators have limited GPS)

---

*Last Updated: December 2024*
