'use client';

import * as React from 'react';
import { Progress } from '@/components/uikit/progress';
import { cn } from '@/lib/cn';

interface MetricBarProps {
  label: string;
  /** 0-100 */
  value: number;
  /** Rendered beside the bar, e.g. "4.2 / 5" or "38%" */
  display: string;
  /** Small mono caption under the bar, e.g. sample size */
  caption?: string;
  className?: string;
}

/**
 * Labeled metric bar — the municipality-profile / dashboard measurement unit:
 * mono label, big display figure, red progress bar, faint caption.
 */
export function MetricBar({ label, value, display, caption, className }: MetricBarProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-ink-soft">
          {label}
        </span>
        <span className="font-mono text-2xl font-black leading-none tabular-nums">
          {display}
        </span>
      </div>
      <Progress value={Math.max(0, Math.min(100, value))} aria-label={label} />
      {caption ? (
        <span className="font-mono text-xs text-ink-faint">{caption}</span>
      ) : null}
    </div>
  );
}
