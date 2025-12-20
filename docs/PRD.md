# Sync - Product Requirements Document
## מערכת הסכמה ציבורית מקומית

---

## 1. Executive Summary

### 1.1 Vision
Sync is a revolutionary civic engagement platform that empowers local communities in Israel to make collective decisions on municipal affairs through transparent, blockchain-verified consensus voting. By combining cutting-edge technology with accessible design, Sync transforms how citizens participate in local democracy.

### 1.2 Mission
To create a trustworthy, accessible, and engaging platform where every citizen's voice counts equally in shaping their local community's future.

### 1.3 Core Value Proposition
- **Transparency**: All votes recorded on Qubik blockchain
- **Authenticity**: Multi-layered verification (Clerk auth + Social Signature + GPS + Payment)
- **Accessibility**: Simple mobile-first experience in Hebrew
- **Incentivization**: Sync tokens reward civic participation

---

## 2. Product Overview

### 2.1 Platform Components

#### Mobile Application (iOS & Android)
Primary interface for citizens to:
- Authenticate and manage their profile
- View and participate in local votes
- Track voting history and resolutions
- Initiate new votes
- Manage Sync token balance

#### Public Website
Information hub providing:
- Platform introduction and mission
- Public voting data and statistics
- Upcoming and suggested votes
- Transparency reports
- Onboarding flow

### 2.2 Target Users

#### Primary: Israeli Citizens (18+)
- Residents of local municipalities
- Interested in civic engagement
- Smartphone users
- Have Israeli bank accounts

#### Secondary: Municipal Officials
- Track community sentiment
- Monitor vote outcomes
- Access aggregated data

---

## 3. Technical Architecture

### 3.1 Technology Stack

#### Frontend - Website
| Component | Technology |
|-----------|------------|
| Framework | Next.js 17 |
| Animations | Framer Motion |
| Smooth Scroll | Lenis |
| Styling | CSS Modules + Design Tokens |
| Language | TypeScript |
| Hosting | Vercel |

#### Frontend - Mobile
| Component | Technology |
|-----------|------------|
| Framework | React Native / Expo |
| Navigation | React Navigation |
| State | Zustand |
| Styling | NativeWind |

#### Backend & Services
| Service | Provider |
|---------|----------|
| Authentication | Clerk |
| Blockchain | Qubik |
| Primary Database | Qubik Chain Storage |
| Secondary Database | Converge |
| Email | Resend |
| Billing | Green Invoice + Grow |
| Hosting | Vercel |

### 3.2 Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYERS                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Layer 1: Clerk Authentication                               │
│  ├── Email/Phone verification                                │
│  ├── Social login (Google, Apple)                            │
│  └── Session management                                       │
│                                                               │
│  Layer 2: Social Signature Algorithm                         │
│  ├── Connected social accounts verification                  │
│  ├── Cross-platform identity confirmation                    │
│  └── Reputation scoring                                       │
│                                                               │
│  Layer 3: Financial Verification                             │
│  ├── 1₪ vote contribution                                    │
│  ├── Israeli bank account confirmation                       │
│  └── Green Invoice transaction record                        │
│                                                               │
│  Layer 4: Geographic Verification                            │
│  ├── Real-time GPS pinning                                   │
│  ├── Municipality boundary check                             │
│  └── Location timestamp recording                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Blockchain Integration (Qubik)

#### Vote Recording
- Each vote creates immutable blockchain record
- Vote hash includes: user_id, vote_choice, timestamp, location_hash, payment_hash
- Public verification available without exposing voter identity

#### Sync Token Economy
- 1₪ contribution = 1 Sync token minted
- 50₪ vote creation = 50 Sync tokens minted
- Token value tied to platform adoption metrics
- Tokens stored in user's Qubik wallet

### 3.4 Database Schema (Converge)

#### Users Collection
```typescript
interface User {
  id: string;
  clerkId: string;
  qubikWalletAddress: string;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    municipality: string;
    verificationStatus: VerificationStatus;
  };
  socialConnections: SocialConnection[];
  syncTokenBalance: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Votes Collection
```typescript
interface Vote {
  id: string;
  title: string;
  description: string;
  municipality: string;
  creatorId: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  options: VoteOption[];
  startDate: Date;
  endDate: Date;
  participantCount: number;
  qubikTxHash: string;
  results?: VoteResults;
  createdAt: Date;
}
```

#### Participations Collection
```typescript
interface Participation {
  id: string;
  voteId: string;
  oderId: string;
  optionId: string;
  paymentTxId: string;
  qubikTxHash: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
    timestamp: Date;
  };
  createdAt: Date;
}
```

---

## 4. Feature Specifications

### 4.1 User Profile Management

#### Profile Page Components
1. **Personal Information**
   - Display name
   - Verified municipality
   - Member since date
   - Verification badges

2. **Social Accounts Hub**
   - Connected accounts list
   - Connection status indicators
   - Add/remove social connections
   - Social Signature strength meter

3. **Sync Token Wallet**
   - Current balance display
   - Transaction history
   - Token value indicator
   - Top-up option

4. **Settings**
   - Notification preferences
   - Privacy settings
   - Language (Hebrew RTL)
   - Account deletion

### 4.2 Voting Interface

#### Active Votes View
- List of ongoing votes in user's municipality
- Time remaining indicators
- Participation status badges
- Quick vote action buttons

#### Vote Detail Screen
- Full vote description
- Options with current distribution (after voting)
- Discussion/comments section
- Share functionality
- GPS verification trigger
- Payment flow integration

#### Past Votes & Resolutions
- Historical vote archive
- Resolution status (implemented/pending/rejected)
- User's voting history
- Impact metrics

#### Standing Votes
- Votes user hasn't participated in
- Expiration countdown
- Relevance scoring

### 4.3 Vote Creation Flow

#### Step 1: Proposal Draft
- Title (max 100 characters)
- Description (max 2000 characters)
- Category selection
- Options definition (2-5 options)

#### Step 2: Configuration
- Duration selection (3-30 days)
- Municipality scope
- Minimum participation threshold

#### Step 3: Payment
- 50₪ creation fee
- Green Invoice receipt
- Qubik token minting confirmation

#### Step 4: Review & Submit
- Preview screen
- Terms acceptance
- Blockchain submission
- Confirmation

### 4.4 Payment Integration

#### Green Invoice Integration
- PCI-compliant payment processing
- Israeli credit card support
- Digital receipt generation
- Tax documentation

#### Grow Integration
- Subscription management (future)
- Recurring payment support
- Payment analytics

---

## 5. Website Specifications

### 5.1 Design System

#### Typography
- **Scale**: 1.2 (Minor Third)
- **Primary Font**: Heebo (Hebrew-optimized)
- **Secondary Font**: Assistant (UI elements)
- **Direction**: RTL only

#### Type Scale
```
--text-xs:    0.694rem   (11.1px)
--text-sm:    0.833rem   (13.3px)
--text-base:  1rem       (16px)
--text-lg:    1.2rem     (19.2px)
--text-xl:    1.44rem    (23px)
--text-2xl:   1.728rem   (27.6px)
--text-3xl:   2.074rem   (33.2px)
--text-4xl:   2.488rem   (39.8px)
--text-5xl:   2.986rem   (47.8px)
--text-6xl:   3.583rem   (57.3px)
--text-7xl:   4.3rem     (68.8px)
```

#### Color Tokens
```
--color-primary:        #2563EB    (Trust Blue)
--color-primary-light:  #3B82F6
--color-primary-dark:   #1D4ED8

--color-secondary:      #10B981    (Growth Green)
--color-secondary-light:#34D399
--color-secondary-dark: #059669

--color-accent:         #8B5CF6    (Innovation Purple)

--color-neutral-50:     #FAFAFA
--color-neutral-100:    #F5F5F5
--color-neutral-200:    #E5E5E5
--color-neutral-300:    #D4D4D4
--color-neutral-400:    #A3A3A3
--color-neutral-500:    #737373
--color-neutral-600:    #525252
--color-neutral-700:    #404040
--color-neutral-800:    #262626
--color-neutral-900:    #171717

--color-background:     #FFFFFF
--color-surface:        #FAFAFA
--color-text-primary:   #171717
--color-text-secondary: #525252
--color-text-muted:     #737373
```

#### Spacing Scale
```
--space-1:   0.25rem   (4px)
--space-2:   0.5rem    (8px)
--space-3:   0.75rem   (12px)
--space-4:   1rem      (16px)
--space-5:   1.25rem   (20px)
--space-6:   1.5rem    (24px)
--space-8:   2rem      (32px)
--space-10:  2.5rem    (40px)
--space-12:  3rem      (48px)
--space-16:  4rem      (64px)
--space-20:  5rem      (80px)
--space-24:  6rem      (96px)
--space-32:  8rem      (128px)
```

#### Animation Tokens
```
--duration-instant:    0ms
--duration-fast:       150ms
--duration-normal:     300ms
--duration-slow:       500ms
--duration-slower:     700ms

--ease-default:        cubic-bezier(0.4, 0, 0.2, 1)
--ease-in:             cubic-bezier(0.4, 0, 1, 1)
--ease-out:            cubic-bezier(0, 0, 0.2, 1)
--ease-in-out:         cubic-bezier(0.4, 0, 0.2, 1)
--ease-bounce:         cubic-bezier(0.68, -0.55, 0.265, 1.55)
```

### 5.2 Website Pages

#### Home (/)
- Hero section with animated typography
- Platform value propositions
- Live voting statistics
- Call-to-action for app download

#### About (/about)
- Mission and vision
- How it works explanation
- Team introduction
- Technology overview

#### Public Votes (/votes)
- Active votes browser
- Completed votes archive
- Upcoming votes preview
- Filter by municipality

#### Vote Detail (/votes/[id])
- Public vote information
- Real-time results (after completion)
- Participation statistics
- Share functionality

#### Download (/download)
- App store links
- QR codes
- Feature highlights
- Onboarding preview

### 5.3 Animation Philosophy

#### Lenis Smooth Scroll
- Silky smooth scrolling experience
- Parallax effects on hero sections
- Scroll-triggered animations

#### Framer Motion Patterns
- Staggered text reveals
- Morphing typography
- Number counting animations
- Page transitions
- Micro-interactions

#### Typography-Driven Design
- Large-scale Hebrew typography as design element
- Animated letter spacing
- Word-by-word reveals
- Kinetic typography sections

---

## 6. Security & Compliance

### 6.1 Data Protection
- GDPR-equivalent Israeli privacy compliance
- End-to-end encryption for sensitive data
- Regular security audits
- Penetration testing

### 6.2 Vote Integrity
- One person, one vote enforcement
- Sybil resistance through multi-layer verification
- Immutable blockchain records
- Audit trail availability

### 6.3 Financial Compliance
- PCI DSS compliance via Green Invoice
- Israeli banking regulations adherence
- Transaction record keeping
- Anti-money laundering checks

---

## 7. Success Metrics

### 7.1 Key Performance Indicators

#### Engagement
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Votes per user per month
- Session duration

#### Growth
- New user registrations
- Municipality coverage
- Vote creation rate
- Referral rate

#### Quality
- Vote completion rate
- Verification success rate
- App store ratings
- NPS score

#### Financial
- Transaction volume
- Token velocity
- Revenue per user
- Customer acquisition cost

---

## 8. Roadmap

### Phase 1: Foundation (Current)
- [ ] Core website launch
- [ ] Authentication system
- [ ] Basic voting functionality
- [ ] Payment integration

### Phase 2: Expansion
- [ ] Mobile app release
- [ ] Social signature implementation
- [ ] Token economy activation
- [ ] First municipality pilot

### Phase 3: Scale
- [ ] National rollout
- [ ] Advanced analytics
- [ ] API for municipalities
- [ ] Integration partnerships

### Phase 4: Evolution
- [ ] Token exchange listing
- [ ] Cross-municipality voting
- [ ] AI-powered vote suggestions
- [ ] Governance DAO transition

---

## 9. Appendices

### A. Glossary
- **Sync Token**: Platform utility token earned through participation
- **Social Signature**: Multi-platform identity verification algorithm
- **Municipality Boundary**: GPS-defined geographic voting region
- **Resolution**: Official outcome and implementation status of completed vote

### B. Technical Dependencies
- Clerk SDK v5+
- Qubik SDK (latest)
- Converge Client v3+
- Resend API v2
- Green Invoice API v1
- Grow SDK v2

### C. Localization
- Hebrew (Primary)
- Arabic (Future)
- English (Future)
- Russian (Future)

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Status: Production Ready*
