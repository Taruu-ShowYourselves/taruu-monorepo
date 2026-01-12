import type { Variants, Transition } from 'framer-motion';

/**
 * Sync Animation Library
 * Framer Motion variants and transitions using design tokens
 */

// ============================================
// TRANSITION PRESETS
// ============================================

export const transitions = {
  default: {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1],
  } as Transition,

  fast: {
    duration: 0.15,
    ease: [0.4, 0, 0.2, 1],
  } as Transition,

  slow: {
    duration: 0.5,
    ease: [0.4, 0, 0.2, 1],
  } as Transition,

  slower: {
    duration: 0.7,
    ease: [0.4, 0, 0.2, 1],
  } as Transition,

  bounce: {
    type: 'spring',
    stiffness: 400,
    damping: 25,
  } as Transition,

  elastic: {
    type: 'spring',
    stiffness: 300,
    damping: 20,
  } as Transition,

  smooth: {
    duration: 0.5,
    ease: [0.25, 0.1, 0.25, 1],
  } as Transition,
};

// ============================================
// FADE VARIANTS
// ============================================

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.default,
  },
};

export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.default,
  },
};

export const fadeInDown: Variants = {
  hidden: {
    opacity: 0,
    y: -24,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.default,
  },
};

export const fadeInRight: Variants = {
  hidden: {
    opacity: 0,
    x: -24,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.default,
  },
};

export const fadeInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: 24,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.default,
  },
};

// ============================================
// SCALE VARIANTS
// ============================================

export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.bounce,
  },
};

export const scaleUp: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.elastic,
  },
};

// ============================================
// STAGGER CONTAINERS
// ============================================

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

// ============================================
// TEXT ANIMATIONS
// ============================================

export const textReveal: Variants = {
  hidden: {
    opacity: 0,
    y: '100%',
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export const letterReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 50,
    rotateX: -90,
  },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export const wordReveal: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const wordChild: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    filter: 'blur(4px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

// ============================================
// SLIDE ANIMATIONS
// ============================================

export const slideInFromRight: Variants = {
  hidden: {
    x: '100%',
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: transitions.smooth,
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: transitions.default,
  },
};

export const slideInFromLeft: Variants = {
  hidden: {
    x: '-100%',
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: transitions.smooth,
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: transitions.default,
  },
};

export const slideInFromTop: Variants = {
  hidden: {
    y: '-100%',
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: transitions.smooth,
  },
  exit: {
    y: '-100%',
    opacity: 0,
    transition: transitions.default,
  },
};

export const slideInFromBottom: Variants = {
  hidden: {
    y: '100%',
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: transitions.smooth,
  },
  exit: {
    y: '100%',
    opacity: 0,
    transition: transitions.default,
  },
};

// ============================================
// PAGE TRANSITIONS
// ============================================

export const pageTransition: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 1, 1],
    },
  },
};

// ============================================
// HOVER ANIMATIONS
// ============================================

export const hoverScale = {
  scale: 1.02,
  transition: transitions.fast,
};

export const hoverLift = {
  y: -4,
  transition: transitions.fast,
};

export const tapScale = {
  scale: 0.98,
};

// ============================================
// COUNTER ANIMATION
// ============================================

export const counterVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
    },
  },
};

// ============================================
// REVEAL ANIMATIONS
// ============================================

export const revealFromMask: Variants = {
  hidden: {
    clipPath: 'inset(100% 0 0 0)',
  },
  visible: {
    clipPath: 'inset(0% 0 0 0)',
    transition: {
      duration: 0.8,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export const revealLine: Variants = {
  hidden: {
    scaleX: 0,
    originX: 1, // RTL - originate from right
  },
  visible: {
    scaleX: 1,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

// ============================================
// FLOATING ANIMATION
// ============================================

export const floatingAnimation = {
  y: [0, -10, 0],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

export const pulseAnimation = {
  scale: [1, 1.05, 1],
  opacity: [1, 0.8, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

// ============================================
// VIEWPORT SETTINGS
// ============================================

export const viewportOnce = {
  once: true,
  margin: '-100px',
};

export const viewportAlways = {
  once: false,
  margin: '-50px',
};

// ============================================
// MICRO-ANIMATIONS
// ============================================

/**
 * Icon nudge - subtle rotation on hover
 * Use with whileHover for interactive elements
 */
export const iconNudge = {
  rotate: [0, -10, 10, -5, 5, 0],
  transition: {
    duration: 0.5,
    ease: 'easeInOut',
  },
};

/**
 * Icon scale - subtle scale up on hover
 */
export const iconScale = {
  scale: 1.15,
  transition: {
    type: 'spring',
    stiffness: 400,
    damping: 15,
  },
};

/**
 * Icon bounce - playful bounce effect
 */
export const iconBounce = {
  y: [0, -4, 0],
  transition: {
    duration: 0.3,
    ease: 'easeOut',
  },
};

/**
 * Button press - tactile feedback
 */
export const buttonPress = {
  scale: 0.97,
  transition: {
    type: 'spring',
    stiffness: 500,
    damping: 30,
  },
};

/**
 * Button hover - subtle lift effect
 */
export const buttonHover = {
  y: -2,
  transition: {
    type: 'spring',
    stiffness: 400,
    damping: 20,
  },
};

/**
 * Progress fill animation variants
 */
export const progressFill: Variants = {
  hidden: {
    scaleX: 0,
    originX: 1, // RTL - start from right
  },
  visible: (progress: number) => ({
    scaleX: progress,
    transition: {
      duration: 0.8,
      ease: [0.25, 0.1, 0.25, 1],
    },
  }),
};

/**
 * Progress pulse - subtle glow effect
 */
export const progressPulse = {
  opacity: [1, 0.7, 1],
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

/**
 * Micro fade - ultra-fast subtle fade
 */
export const microFade: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.15,
    },
  },
};

/**
 * Card hover - elevation change on hover
 */
export const cardHover = {
  y: -4,
  boxShadow: '0 12px 24px -8px rgba(0, 0, 0, 0.15)',
  transition: {
    type: 'spring',
    stiffness: 300,
    damping: 20,
  },
};

/**
 * Icon container hover - combined scale and background
 */
export const iconContainerHover = {
  scale: 1.1,
  transition: {
    type: 'spring',
    stiffness: 400,
    damping: 20,
  },
};

/**
 * Shimmer effect for loading states
 */
export const shimmer = {
  x: ['0%', '100%'],
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: 'linear',
  },
};

/**
 * Checkmark draw animation
 */
export const checkmarkDraw: Variants = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        duration: 0.4,
        ease: 'easeOut',
      },
      opacity: {
        duration: 0.2,
      },
    },
  },
};

/**
 * Number tick animation for counters
 */
export const numberTick: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
  exit: {
    y: -20,
    opacity: 0,
    transition: {
      duration: 0.15,
    },
  },
};
