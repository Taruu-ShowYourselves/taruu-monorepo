'use client';

import React, { useEffect, useRef } from 'react';
import { animate, createScope, stagger } from 'animejs';
import clsx from 'clsx';
import styles from './PressMachine.module.css';

interface PressLoaderProps {
  className?: string;
}

/**
 * PressLoader - the paper's loading indicator. A schematic web-offset press:
 * newsprint web running over three rollers, printed marks travelling with
 * the paper, sheets dropping onto the delivery stack. animejs keeps it
 * turning while the page loads.
 */
export function PressLoader({ className }: PressLoaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const scope = createScope({ root }).add(() => {
      // Rollers: web rides over A and C (clockwise) and under B (counter).
      animate('[data-roller="cw"]', {
        rotate: 360,
        duration: 2400,
        ease: 'linear',
        loop: true,
      });
      animate('[data-roller="ccw"]', {
        rotate: -360,
        duration: 2400,
        ease: 'linear',
        loop: true,
      });

      // Printed columns travelling with the web - one dash period (26 + 18)
      // per cycle keeps the loop seamless.
      animate('[data-web-print]', {
        strokeDashoffset: [0, -44],
        duration: 480,
        ease: 'linear',
        loop: true,
      });

      // Delivery end: finished sheets drop onto the stack, one after another.
      animate('[data-sheet]', {
        translateY: [0, 34],
        opacity: [0, 1, 1, 0],
        duration: 1500,
        delay: stagger(500),
        ease: 'inOutQuad',
        loop: true,
      });

      // The red ink duct pulses gently - the machine is inked and alive.
      animate('[data-ink-duct]', {
        opacity: [0.75, 1],
        duration: 900,
        ease: 'inOutSine',
        alternate: true,
        loop: true,
      });
    });

    return () => {
      scope.revert();
    };
  }, []);

  return (
    <div ref={rootRef} className={clsx(styles.loader, className)} aria-hidden>
      <svg
        className={styles.machine}
        viewBox="0 0 1200 330"
        preserveAspectRatio="xMidYMid meet"
        role="presentation"
        focusable="false"
      >
        {/* Frame legs */}
        <g className={styles.frame}>
          <rect x="252" y="110" width="8" height="196" />
          <rect x="340" y="110" width="8" height="196" />
          <rect x="552" y="190" width="8" height="116" />
          <rect x="640" y="190" width="8" height="116" />
          <rect x="852" y="110" width="8" height="196" />
          <rect x="940" y="110" width="8" height="196" />
          <rect x="200" y="304" width="800" height="6" />
        </g>

        {/* Paper web - ink edge, then the paper ribbon on top */}
        <path
          className={styles.webEdge}
          d="M -40 252 L 150 252 C 220 252 230 62 300 62 C 370 62 530 238 600 238 C 670 238 830 62 900 62 C 970 62 1000 240 1150 240"
        />
        <path
          className={styles.webPaper}
          d="M -40 252 L 150 252 C 220 252 230 62 300 62 C 370 62 530 238 600 238 C 670 238 830 62 900 62 C 970 62 1000 240 1150 240"
        />
        {/* Printed columns riding the web */}
        <path
          data-web-print
          className={styles.webPrint}
          d="M -40 252 L 150 252 C 220 252 230 62 300 62 C 370 62 530 238 600 238 C 670 238 830 62 900 62 C 970 62 1000 240 1150 240"
        />

        {/* Roller A - impression cylinder (clockwise) */}
        <g data-roller="cw" className={styles.roller} style={{ transformOrigin: '300px 110px' }}>
          <circle cx="300" cy="110" r="48" className={styles.rollerBody} />
          <line x1="300" y1="66" x2="300" y2="154" className={styles.spoke} />
          <line x1="256" y1="110" x2="344" y2="110" className={styles.spoke} />
          <circle cx="300" cy="110" r="7" className={styles.hub} />
        </g>

        {/* Roller B - the red ink cylinder (counter-clockwise) */}
        <g data-roller="ccw" className={styles.roller} style={{ transformOrigin: '600px 190px' }}>
          <circle cx="600" cy="190" r="48" className={styles.rollerInk} data-ink-duct />
          <line x1="600" y1="146" x2="600" y2="234" className={styles.spokePaper} />
          <line x1="556" y1="190" x2="644" y2="190" className={styles.spokePaper} />
          <circle cx="600" cy="190" r="7" className={styles.hubPaper} />
        </g>

        {/* Roller C - delivery cylinder (clockwise) */}
        <g data-roller="cw" className={styles.roller} style={{ transformOrigin: '900px 110px' }}>
          <circle cx="900" cy="110" r="48" className={styles.rollerBody} />
          <line x1="900" y1="66" x2="900" y2="154" className={styles.spoke} />
          <line x1="856" y1="110" x2="944" y2="110" className={styles.spoke} />
          <circle cx="900" cy="110" r="7" className={styles.hub} />
        </g>

        {/* Delivery: falling sheets + stack */}
        <g>
          <rect data-sheet x="1075" y="240" width="64" height="10" className={styles.sheet} />
          <rect data-sheet x="1080" y="236" width="64" height="10" className={styles.sheet} />
          <rect data-sheet x="1070" y="244" width="64" height="10" className={styles.sheet} />
          <rect x="1060" y="286" width="96" height="6" className={styles.stack} />
          <rect x="1066" y="279" width="84" height="6" className={styles.stack} />
          <rect x="1062" y="272" width="92" height="6" className={styles.stack} />
        </g>
      </svg>
    </div>
  );
}
