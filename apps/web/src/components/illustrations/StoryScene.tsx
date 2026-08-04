'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import styles from './StoryScene.module.css';

export type StorySceneVariant = 'verify' | 'vote' | 'proof' | 'impact';

interface StorySceneProps {
  variant: StorySceneVariant;
  /** Accessible title for the illustration */
  title: string;
}

/**
 * Hand-crafted vector story scenes for the "How It Works" chapters.
 * Pure SVG: crisp at any DPI, animated with framer-motion, zero image payload.
 */
export function StoryScene({ variant, title }: StorySceneProps) {
  const reducedMotion = useReducedMotion();

  const float = (delay = 0, distance = 6, duration = 5) =>
    reducedMotion
      ? {}
      : {
          animate: { y: [0, -distance, 0] },
          transition: { duration, delay, repeat: Infinity, ease: 'easeInOut' as const },
        };

  const pulse = (delay = 0, duration = 4) =>
    reducedMotion
      ? {}
      : {
          animate: { opacity: [0.55, 1, 0.55] },
          transition: { duration, delay, repeat: Infinity, ease: 'easeInOut' as const },
        };

  const spin = (duration = 30) =>
    reducedMotion
      ? {}
      : {
          animate: { rotate: 360 },
          transition: { duration, repeat: Infinity, ease: 'linear' as const },
        };

  return (
    <svg
      viewBox="0 0 320 200"
      role="img"
      aria-label={title}
      className={styles.scene}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* Brand gradients */}
        <linearGradient id="ts-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
        <linearGradient id="ts-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id="ts-purple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="ts-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <radialGradient id="ts-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        {/* Scene backdrops */}
        <radialGradient id="ts-bg-blue" cx="0.3" cy="0.25" r="1.1">
          <stop offset="0%" stopColor="#DBEAFE" />
          <stop offset="55%" stopColor="#EFF6FF" />
          <stop offset="100%" stopColor="#F8FAFC" />
        </radialGradient>
        <radialGradient id="ts-bg-green" cx="0.7" cy="0.2" r="1.1">
          <stop offset="0%" stopColor="#D1FAE5" />
          <stop offset="55%" stopColor="#ECFDF5" />
          <stop offset="100%" stopColor="#F8FAFC" />
        </radialGradient>
        <radialGradient id="ts-bg-purple" cx="0.5" cy="0.15" r="1.2">
          <stop offset="0%" stopColor="#EDE9FE" />
          <stop offset="55%" stopColor="#F5F3FF" />
          <stop offset="100%" stopColor="#F8FAFC" />
        </radialGradient>
        <radialGradient id="ts-bg-gold" cx="0.5" cy="0.3" r="1.1">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="55%" stopColor="#FFFBEB" />
          <stop offset="100%" stopColor="#F8FAFC" />
        </radialGradient>
        {/* Soft glow */}
        <filter id="ts-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="ts-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        {/* Fine grain for texture */}
        <filter id="ts-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.05" />
          </feComponentTransfer>
          <feComposite operator="over" in2="SourceGraphic" />
        </filter>
      </defs>

      {variant === 'verify' && <VerifyScene float={float} pulse={pulse} />}
      {variant === 'vote' && <VoteScene float={float} pulse={pulse} />}
      {variant === 'proof' && <ProofScene float={float} pulse={pulse} />}
      {variant === 'impact' && <ImpactScene float={float} pulse={pulse} spin={spin} />}

      {/* Grain overlay - faint print texture. Keep low: a higher opacity here
          darkens the whole scene (the rect has no fill → black base). */}
      <rect width="320" height="200" fill="none" filter="url(#ts-grain)" opacity="0.1" pointerEvents="none" />
    </svg>
  );
}

type Anim = Record<string, unknown>;
interface SceneProps {
  float: (delay?: number, distance?: number, duration?: number) => Anim;
  pulse: (delay?: number, duration?: number) => Anim;
  spin?: (duration?: number) => Anim;
}

/** Chapter 1 - identity shield on a phone, location halo */
function VerifyScene({ float, pulse }: SceneProps) {
  return (
    <g>
      <rect width="320" height="200" fill="url(#ts-bg-blue)" />
      {/* Location halo rings */}
      <motion.g {...pulse(0, 5)}>
        <circle cx="160" cy="105" r="78" fill="none" stroke="#2563EB" strokeOpacity="0.10" strokeWidth="1.5" />
        <circle cx="160" cy="105" r="56" fill="none" stroke="#2563EB" strokeOpacity="0.16" strokeWidth="1.5" />
      </motion.g>
      {/* Phone */}
      <motion.g {...float(0, 5, 6)}>
        <rect x="124" y="48" width="72" height="124" rx="14" fill="#0F172A" opacity="0.92" />
        <rect x="129" y="56" width="62" height="108" rx="9" fill="url(#ts-bg-blue)" />
        {/* Shield */}
        <g filter="url(#ts-glow)">
          <path
            d="M160 78 l20 8 v18 c0 14 -9 23 -20 28 c-11 -5 -20 -14 -20 -28 v-18 z"
            fill="url(#ts-blue)"
          />
        </g>
        <path
          d="M151 105 l7 7 l13 -14"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>
      {/* Floating verification dots */}
      <motion.circle {...float(0.6, 8, 5)} cx="92" cy="70" r="5" fill="url(#ts-blue)" opacity="0.7" />
      <motion.circle {...float(1.4, 7, 6)} cx="236" cy="84" r="4" fill="url(#ts-green)" opacity="0.7" />
      <motion.circle {...float(0.9, 6, 7)} cx="222" cy="150" r="6" fill="url(#ts-purple)" opacity="0.5" />
      {/* Location pin under phone */}
      <motion.g {...pulse(0.5, 4)}>
        <ellipse cx="160" cy="182" rx="22" ry="4.5" fill="#2563EB" opacity="0.18" />
      </motion.g>
    </g>
  );
}

/** Chapter 2 - ballot gliding into a translucent box, shekel orbit */
function VoteScene({ float, pulse }: SceneProps) {
  return (
    <g>
      <rect width="320" height="200" fill="url(#ts-bg-green)" />
      {/* Rising participation particles */}
      <motion.circle {...float(0, 10, 4)} cx="110" cy="76" r="3" fill="#10B981" opacity="0.55" />
      <motion.circle {...float(0.8, 12, 5)} cx="206" cy="64" r="4" fill="#34D399" opacity="0.5" />
      <motion.circle {...float(1.6, 9, 4.5)} cx="232" cy="98" r="3" fill="#10B981" opacity="0.45" />
      {/* Ballot box */}
      <g>
        <rect x="104" y="104" width="112" height="64" rx="10" fill="url(#ts-green)" opacity="0.92" />
        <rect x="104" y="104" width="112" height="64" rx="10" fill="url(#ts-halo)" opacity="0.25" />
        {/* Slot */}
        <rect x="132" y="98" width="56" height="9" rx="4.5" fill="#065F46" />
        {/* Glass face highlight */}
        <rect x="112" y="112" width="38" height="48" rx="7" fill="#FFFFFF" opacity="0.14" />
      </g>
      {/* Ballot slip gliding in */}
      <motion.g {...float(0.3, 8, 4)}>
        <g filter="url(#ts-glow)">
          <rect x="138" y="52" width="44" height="32" rx="5" fill="#FFFFFF" />
        </g>
        <path d="M149 68 l6 6 l12 -12" fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      {/* Shekel coin */}
      <motion.g {...float(1, 7, 5.5)}>
        <circle cx="246" cy="138" r="17" fill="url(#ts-gold)" filter="url(#ts-glow)" />
        <text x="246" y="145" textAnchor="middle" fontSize="18" fontWeight="700" fill="#92400E">
          ₪
        </text>
      </motion.g>
      {/* Pool shadow */}
      <motion.g {...pulse(0.4, 4.5)}>
        <ellipse cx="160" cy="180" rx="64" ry="5" fill="#10B981" opacity="0.16" />
      </motion.g>
    </g>
  );
}

/** Chapter 3 - chain of blocks rising toward the council skyline */
function ProofScene({ float, pulse }: SceneProps) {
  return (
    <g>
      <rect width="320" height="200" fill="url(#ts-bg-purple)" />
      {/* Skyline silhouette */}
      <path
        d="M0 168 h36 v-22 h18 v22 h24 v-34 h8 v-9 h8 v9 h8 v34 h30 v-16 h20 v16 h26 v-26 h16 v26 h22 v-12 h18 v12 h28 v-20 h14 v20 h44 v32 H0 z"
        fill="#4C1D95"
        opacity="0.14"
      />
      {/* Council dome accent */}
      <motion.g {...pulse(0.8, 5)}>
        <circle cx="262" cy="142" r="4" fill="url(#ts-purple)" filter="url(#ts-glow)" />
      </motion.g>
      {/* Chain of linked blocks ascending */}
      {[
        { x: 64, y: 132, delay: 0 },
        { x: 116, y: 106, delay: 0.35 },
        { x: 168, y: 80, delay: 0.7 },
        { x: 220, y: 54, delay: 1.05 },
      ].map((block, i, arr) => (
        <g key={i}>
          {i < arr.length - 1 && (
            <motion.line
              {...pulse(block.delay + 0.2, 3.5)}
              x1={block.x + 36}
              y1={block.y + 10}
              x2={arr[i + 1].x + 4}
              y2={arr[i + 1].y + 22}
              stroke="url(#ts-purple)"
              strokeWidth="2.5"
              strokeDasharray="4 5"
              strokeLinecap="round"
            />
          )}
          <motion.g {...float(block.delay, 4, 6)}>
            <rect x={block.x} y={block.y} width="40" height="32" rx="8" fill="url(#ts-purple)" opacity="0.95" filter="url(#ts-glow)" />
            <rect x={block.x + 6} y={block.y + 6} width="28" height="6" rx="3" fill="#FFFFFF" opacity="0.55" />
            <rect x={block.x + 6} y={block.y + 16} width="18" height="6" rx="3" fill="#FFFFFF" opacity="0.3" />
          </motion.g>
        </g>
      ))}
      {/* Data threads */}
      <motion.circle {...float(1.4, 9, 5)} cx="48" cy="64" r="3.5" fill="#8B5CF6" opacity="0.5" />
      <motion.circle {...float(0.5, 7, 6)} cx="280" cy="92" r="3" fill="#A78BFA" opacity="0.55" />
    </g>
  );
}

/** Chapter 4 - coin medallion rising like a sun over a renewed park */
function ImpactScene({ float, pulse, spin }: SceneProps) {
  return (
    <g>
      <rect width="320" height="200" fill="url(#ts-bg-gold)" />
      {/* Sun rays */}
      <motion.g {...(spin ? spin(40) : {})} style={{ originX: '160px', originY: '86px' }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x="158.5"
            y="34"
            width="3"
            height="16"
            rx="1.5"
            fill="#F59E0B"
            opacity="0.4"
            transform={`rotate(${i * 30} 160 86)`}
          />
        ))}
      </motion.g>
      {/* Coin medallion */}
      <motion.g {...float(0, 5, 6)}>
        <circle cx="160" cy="86" r="30" fill="url(#ts-gold)" filter="url(#ts-glow)" />
        <circle cx="160" cy="86" r="22" fill="none" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="2" />
        <path d="M150 92 l7 7 l14 -16" fill="none" stroke="#92400E" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
      {/* Park: ground, trees, swing frame */}
      <path d="M0 168 q80 -14 160 0 q80 14 160 0 v32 H0 z" fill="#10B981" opacity="0.25" />
      <g opacity="0.85">
        {/* Trees */}
        <motion.g {...float(0.4, 3, 7)}>
          <rect x="62" y="138" width="5" height="20" rx="2" fill="#065F46" />
          <circle cx="64.5" cy="130" r="15" fill="url(#ts-green)" />
        </motion.g>
        <motion.g {...float(1.1, 3, 8)}>
          <rect x="250" y="142" width="5" height="18" rx="2" fill="#065F46" />
          <circle cx="252.5" cy="134" r="13" fill="url(#ts-green)" />
        </motion.g>
        {/* Swing frame */}
        <g stroke="#2563EB" strokeWidth="4" strokeLinecap="round">
          <line x1="118" y1="164" x2="132" y2="132" />
          <line x1="202" y1="164" x2="188" y2="132" />
          <line x1="130" y1="133" x2="190" y2="133" />
        </g>
        <motion.g {...float(0.7, 4, 3.5)}>
          <line x1="150" y1="134" x2="150" y2="154" stroke="#1D4ED8" strokeWidth="2" />
          <line x1="170" y1="134" x2="170" y2="154" stroke="#1D4ED8" strokeWidth="2" />
          <rect x="144" y="154" width="32" height="5" rx="2.5" fill="#1D4ED8" />
        </motion.g>
      </g>
      {/* Celebration confetti */}
      <motion.circle {...float(0.2, 10, 4)} cx="92" cy="84" r="3.5" fill="#8B5CF6" opacity="0.6" />
      <motion.circle {...float(0.9, 11, 4.5)} cx="232" cy="70" r="3" fill="#2563EB" opacity="0.6" />
      <motion.circle {...float(1.5, 9, 5)} cx="262" cy="110" r="3.5" fill="#10B981" opacity="0.55" />
      <motion.g {...pulse(0.3, 4)}>
        <ellipse cx="160" cy="180" rx="70" ry="5" fill="#F59E0B" opacity="0.15" />
      </motion.g>
    </g>
  );
}
