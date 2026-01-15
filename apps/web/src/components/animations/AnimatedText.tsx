'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import clsx from 'clsx';
import styles from './AnimatedText.module.css';

// ============================================
// WORD-BY-WORD REVEAL
// ============================================

interface AnimatedWordsProps {
  text: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
}

const wordContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const wordVariants: Variants = {
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

export function AnimatedWords({
  text,
  className,
  delay = 0,
  staggerDelay = 0.08,
}: AnimatedWordsProps) {
  const words = text.split(' ');

  return (
    <motion.span
      className={clsx(styles.wordContainer, className)}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delay,
          },
        },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
    >
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className={styles.word}
          variants={wordVariants}
        >
          {word}
          {index < words.length - 1 && '\u00A0'}
        </motion.span>
      ))}
    </motion.span>
  );
}

// ============================================
// LETTER-BY-LETTER REVEAL
// ============================================

interface AnimatedLettersProps {
  text: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
}

const letterVariants: Variants = {
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

export function AnimatedLetters({
  text,
  className,
  delay = 0,
  staggerDelay = 0.03,
}: AnimatedLettersProps) {
  const letters = text.split('');

  return (
    <motion.span
      className={clsx(styles.letterContainer, className)}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delay,
          },
        },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
    >
      {letters.map((letter, index) => (
        <motion.span
          key={`${letter}-${index}`}
          className={styles.letter}
          variants={letterVariants}
          style={{ display: 'inline-block' }}
        >
          {letter === ' ' ? '\u00A0' : letter}
        </motion.span>
      ))}
    </motion.span>
  );
}

// ============================================
// LINE REVEAL (MASK)
// ============================================

interface AnimatedLineRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function AnimatedLineReveal({
  children,
  className,
  delay = 0,
}: AnimatedLineRevealProps) {
  return (
    <div className={clsx(styles.lineRevealContainer, className)}>
      <motion.div
        className={styles.lineRevealContent}
        initial={{ clipPath: 'inset(100% 0 0 0)' }}
        whileInView={{ clipPath: 'inset(0% 0 0 0)' }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{
          duration: 0.8,
          ease: [0.25, 0.1, 0.25, 1],
          delay,
        }}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- React 19 + Framer Motion type incompatibility */}
        {children as any}
      </motion.div>
    </div>
  );
}

// ============================================
// COUNTER ANIMATION
// ============================================

interface AnimatedCounterProps {
  from?: number;
  to: number;
  duration?: number;
  delay?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}

export function AnimatedCounter({
  from = 0,
  to,
  duration = 2,
  delay = 0,
  className,
  suffix = '',
  prefix = '',
}: AnimatedCounterProps) {
  return (
    <motion.span
      className={clsx(styles.counter, className)}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay }}
    >
      {prefix}{to.toLocaleString('he-IL')}{suffix}
    </motion.span>
  );
}

// ============================================
// TYPING EFFECT
// ============================================

interface AnimatedTypingProps {
  text: string;
  className?: string;
  delay?: number;
  speed?: number;
}

export function AnimatedTyping({
  text,
  className,
  delay = 0,
  speed = 0.05,
}: AnimatedTypingProps) {
  const letters = text.split('');

  return (
    <motion.span
      className={clsx(styles.typingContainer, className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {letters.map((letter, index) => (
        <motion.span
          key={`${letter}-${index}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: delay + index * speed,
            duration: 0,
          }}
        >
          {letter}
        </motion.span>
      ))}
      <motion.span
        className={styles.cursor}
        animate={{ opacity: [1, 0] }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          repeatType: 'reverse',
        }}
      >
        |
      </motion.span>
    </motion.span>
  );
}

// ============================================
// SCALE REVEAL
// ============================================

interface AnimatedScaleRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function AnimatedScaleReveal({
  children,
  className,
  delay = 0,
}: AnimatedScaleRevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      whileInView={{
        opacity: 1,
        scale: 1,
        y: 0,
      }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- React 19 + Framer Motion type incompatibility */}
      {children as any}
    </motion.div>
  );
}

// ============================================
// FADE IN UP
// ============================================

interface AnimatedFadeInUpProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

export function AnimatedFadeInUp({
  children,
  className,
  delay = 0,
  duration = 0.5,
}: AnimatedFadeInUpProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- React 19 + Framer Motion type incompatibility */}
      {children as any}
    </motion.div>
  );
}
