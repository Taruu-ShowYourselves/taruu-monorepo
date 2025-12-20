# CLAUDE.md - Sync Project Guide

## Project Overview

**Sync** (סינק) is a civic consensus platform for Israeli municipalities. Citizens vote on local affairs with blockchain verification, GPS pinning, and financial authentication.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
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
│   └── mobile/                 # React Native app (future)
│
├── packages/
│   ├── design-system/          # Shared design tokens
│   ├── api-client/             # API client library
│   ├── qubik-sdk/              # Qubik blockchain wrapper
│   └── types/                  # Shared TypeScript types
│
├── services/
│   ├── auth/                   # Clerk authentication
│   ├── blockchain/             # Qubik integration
│   ├── database/               # Converge database
│   ├── payments/               # Green Invoice + Grow
│   └── email/                  # Resend email service
│
└── docs/                       # Documentation
    └── PRD.md                  # Product Requirements
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 17 | Web application framework |
| Animations | Framer Motion | Motion and transitions |
| Smooth Scroll | Lenis | Silky scroll experience |
| Styling | CSS Modules | Scoped component styles |
| Auth | Clerk | User authentication |
| Blockchain | Qubik | Vote recording & tokens |
| Database | Converge | Secondary data storage |
| Payments | Green Invoice | Israeli payment processing |
| Subscriptions | Grow | Payment management |
| Email | Resend | Transactional emails |
| Hosting | Vercel | Deployment platform |

## Design System

### CRITICAL: No Hardcoded Values

**NEVER** use hardcoded colors, sizes, or spacing. Always use design tokens:

```tsx
// ❌ WRONG
<div style={{ color: '#2563EB', padding: '16px' }}>

// ✅ CORRECT
<div className={styles.container}>
// With CSS: color: var(--color-primary); padding: var(--space-4);
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

### Animation Tokens

```css
--duration-fast:    150ms
--duration-normal:  300ms
--duration-slow:    500ms

--ease-default:     cubic-bezier(0.4, 0, 0.2, 1)
--ease-bounce:      cubic-bezier(0.68, -0.55, 0.265, 1.55)
```

## Component Patterns

### Animation Components

Use Framer Motion for all animations:

```tsx
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/animations';

export function AnimatedSection({ children }) {
  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {children}
    </motion.section>
  );
}
```

### Typography Components

```tsx
// Always use semantic typography components
<Heading level={1}>כותרת ראשית</Heading>
<Text variant="body">טקסט גוף</Text>
<Text variant="caption" color="muted">טקסט משני</Text>
```

### RTL Considerations

All components must be RTL-first:

```css
/* Use logical properties */
margin-inline-start: var(--space-4);  /* Not margin-left */
padding-inline-end: var(--space-2);   /* Not padding-right */
text-align: start;                    /* Not text-align: right */
```

## Lenis Smooth Scroll

```tsx
// Initialize in providers/LenisProvider.tsx
import Lenis from '@studio-freight/lenis';

// Use scroll-triggered animations
const { scrollYProgress } = useScroll();
```

## API Routes

### Authentication
- `POST /api/auth/clerk-webhook` - Clerk webhook handler
- `GET /api/auth/user` - Get current user

### Votes
- `GET /api/votes` - List votes (with municipality filter)
- `GET /api/votes/[id]` - Get vote details
- `POST /api/votes` - Create new vote (50₪)
- `POST /api/votes/[id]/participate` - Cast vote (1₪)

### User
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `GET /api/user/votes` - User's voting history
- `GET /api/user/tokens` - Token balance

### Payments
- `POST /api/payments/create` - Create payment intent
- `POST /api/payments/webhook` - Green Invoice webhook

## Environment Variables

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

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
```

## Code Style

### TypeScript
- Strict mode enabled
- No `any` types - use proper typing
- Interface for objects, type for unions

### Imports
```tsx
// Order: React, Next, external, internal, styles
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import styles from './Component.module.css';
```

### Naming Conventions
- Components: PascalCase (`VoteCard.tsx`)
- Hooks: camelCase with `use` prefix (`useVotes.ts`)
- Utils: camelCase (`formatCurrency.ts`)
- CSS Modules: camelCase (`styles.container`)
- Design tokens: kebab-case (`--color-primary`)

## Testing

```bash
# Run unit tests
pnpm test

# Run e2e tests
pnpm test:e2e

# Run type checking
pnpm typecheck
```

## Deployment

### Vercel Configuration
- Framework: Next.js
- Build Command: `pnpm build`
- Output Directory: `.next`
- Node Version: 20.x

### Environment Setup
1. Configure all environment variables in Vercel
2. Set up Clerk webhooks to point to production URL
3. Configure Green Invoice webhooks
4. Verify Qubik network connection

## Common Tasks

### Adding a New Page
1. Create file in `apps/web/app/[route]/page.tsx`
2. Add metadata export
3. Use design system tokens only
4. Implement RTL layout

### Adding a New Component
1. Create in appropriate directory under `components/`
2. Create accompanying `.module.css` file
3. Export from `components/index.ts`
4. Document props with TypeScript

### Adding Animations
1. Define variants in `lib/animations.ts`
2. Use `motion` components from Framer Motion
3. Respect `prefers-reduced-motion`
4. Use animation tokens for timing

## Troubleshooting

### Common Issues

**Hebrew text not displaying correctly**
- Ensure `dir="rtl"` on html element
- Use Heebo/Assistant fonts
- Check font loading in `_app.tsx`

**Lenis not working**
- Verify provider wraps app
- Check for conflicting scroll libraries
- Ensure smooth scroll CSS is applied

**Design tokens not applying**
- Verify CSS custom properties are defined in `:root`
- Check import order of global styles
- Ensure CSS Modules are properly scoped

## Key Contacts

- Product: See PRD.md
- Technical: Check code comments
- Design: Design system in `/packages/design-system`

---

*Last Updated: December 2024*
