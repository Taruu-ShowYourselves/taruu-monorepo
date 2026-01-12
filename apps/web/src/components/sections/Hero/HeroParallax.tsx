'use client';

import { useRef, useEffect } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  MotionValue,
} from 'framer-motion';
import { useReducedMotion } from '@/hooks';
import styles from './HeroParallax.module.css';

interface ParallaxLayerProps {
  children?: React.ReactNode;
  scrollFactor?: number;
  pointerFactor?: number;
  className?: string;
  reducedMotion: boolean;
  scrollProgress: MotionValue<number>;
  mouseX: MotionValue<number>;
  mouseY: MotionValue<number>;
}

function ParallaxLayer({
  children,
  scrollFactor = 0,
  pointerFactor = 0,
  className,
  reducedMotion,
  scrollProgress,
  mouseX,
  mouseY,
}: ParallaxLayerProps) {
  // Scroll-based transform (subtle vertical movement)
  const scrollY = useTransform(
    scrollProgress,
    [0, 1],
    [0, scrollFactor * 100]
  );

  // Pointer-based transforms
  const pointerX = useTransform(mouseX, (value: number) =>
    reducedMotion ? 0 : value * pointerFactor
  );
  const pointerY = useTransform(mouseY, (value: number) =>
    reducedMotion ? 0 : value * pointerFactor
  );

  // Smooth spring for pointer movement
  const springConfig = { stiffness: 50, damping: 30, mass: 1 };
  const smoothPointerX = useSpring(pointerX, springConfig);
  const smoothPointerY = useSpring(pointerY, springConfig);

  // Combined transform
  const x = reducedMotion ? 0 : smoothPointerX;
  const y = useTransform(
    [scrollY, smoothPointerY],
    ([scroll, pointer]) => (reducedMotion ? 0 : (scroll as number) + (pointer as number))
  );

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} style={{ x, y }}>
      {children}
    </motion.div>
  );
}

export function HeroParallax() {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll progress for the hero section
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  // Mouse position (normalized from -1 to 1)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Track mouse movement
  useEffect(() => {
    if (reducedMotion) return;

    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;

      // Normalize to -1 to 1 range
      const normalizedX = (clientX / innerWidth - 0.5) * 2;
      const normalizedY = (clientY / innerHeight - 0.5) * 2;

      mouseX.set(normalizedX * 20); // Scale factor for movement amount
      mouseY.set(normalizedY * 20);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [reducedMotion, mouseX, mouseY]);

  return (
    <div ref={containerRef} className={styles.parallaxContainer}>
      {/* Grid Layer - Slowest parallax */}
      <ParallaxLayer
        className={styles.gridLayer}
        scrollFactor={-0.1}
        pointerFactor={0.3}
        reducedMotion={reducedMotion}
        scrollProgress={scrollYProgress}
        mouseX={mouseX}
        mouseY={mouseY}
      />

      {/* Dots Pattern - Slow parallax */}
      <ParallaxLayer
        className={styles.dotsLayer}
        scrollFactor={-0.15}
        pointerFactor={0.4}
        reducedMotion={reducedMotion}
        scrollProgress={scrollYProgress}
        mouseX={mouseX}
        mouseY={mouseY}
      />

      {/* Glow Layers - Medium parallax */}
      <ParallaxLayer
        className={styles.glowPrimary}
        scrollFactor={-0.2}
        pointerFactor={0.6}
        reducedMotion={reducedMotion}
        scrollProgress={scrollYProgress}
        mouseX={mouseX}
        mouseY={mouseY}
      />

      <ParallaxLayer
        className={styles.glowSecondary}
        scrollFactor={-0.25}
        pointerFactor={0.5}
        reducedMotion={reducedMotion}
        scrollProgress={scrollYProgress}
        mouseX={mouseX}
        mouseY={mouseY}
      />

      <ParallaxLayer
        className={styles.glowAccent}
        scrollFactor={-0.3}
        pointerFactor={0.7}
        reducedMotion={reducedMotion}
        scrollProgress={scrollYProgress}
        mouseX={mouseX}
        mouseY={mouseY}
      />

      {/* Shapes Layer - Faster parallax */}
      <div className={styles.shapesLayer}>
        <ParallaxLayer
          className={`${styles.shape} ${styles.shapeCircle1}`}
          scrollFactor={-0.35}
          pointerFactor={0.8}
          reducedMotion={reducedMotion}
          scrollProgress={scrollYProgress}
          mouseX={mouseX}
          mouseY={mouseY}
        />

        <ParallaxLayer
          className={`${styles.shape} ${styles.shapeCircle2}`}
          scrollFactor={-0.4}
          pointerFactor={0.9}
          reducedMotion={reducedMotion}
          scrollProgress={scrollYProgress}
          mouseX={mouseX}
          mouseY={mouseY}
        />

        <ParallaxLayer
          className={`${styles.shape} ${styles.shapeCircle3}`}
          scrollFactor={-0.3}
          pointerFactor={0.7}
          reducedMotion={reducedMotion}
          scrollProgress={scrollYProgress}
          mouseX={mouseX}
          mouseY={mouseY}
        />

        <ParallaxLayer
          className={`${styles.shape} ${styles.shapeDiamond}`}
          scrollFactor={-0.45}
          pointerFactor={1}
          reducedMotion={reducedMotion}
          scrollProgress={scrollYProgress}
          mouseX={mouseX}
          mouseY={mouseY}
        />

        <ParallaxLayer
          className={`${styles.shape} ${styles.shapeRing}`}
          scrollFactor={-0.2}
          pointerFactor={0.5}
          reducedMotion={reducedMotion}
          scrollProgress={scrollYProgress}
          mouseX={mouseX}
          mouseY={mouseY}
        />
      </div>
    </div>
  );
}
