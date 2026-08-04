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
 * Labeled metric - financial-index unit: red-ticked mono label, oversized
 * tabular figure on its own line, red progress rule, faint caption.
 */
export function MetricBar({ label, value, display, caption, className }: MetricBarProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <span className="flex items-center gap-2 font-mono text-xs font-extrabold uppercase tracking-widest text-ink-soft">
        <span aria-hidden className="inline-block size-[0.6em] bg-red" />
        {label}
      </span>
      <span className="font-display text-4xl font-black leading-none tracking-tight tabular-nums md:text-5xl">
        {display}
      </span>
      <Progress value={Math.max(0, Math.min(100, value))} className="h-2" aria-label={label} />
      {caption ? (
        <span className="font-mono text-xs leading-relaxed text-ink-faint">{caption}</span>
      ) : null}
    </div>
  );
}
