'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/cn';

/**
 * Press-styled progress bar - ink track border, red fill, no rounding.
 * RTL-aware: fills from inline-start like the site's tally bars.
 */
function Progress({
  className,
  value,
  indicatorClassName,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        'relative h-3 w-full overflow-hidden border-2 border-ink bg-paper',
        className
      )}
      value={value}
      {...props}
    >
      {/* Width-based fill (not translateX) so the bar grows from
          inline-start and stays correct under RTL. */}
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full bg-red transition-[width] duration-500 ease-out',
          indicatorClassName
        )}
        style={{ width: `${value ?? 0}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
