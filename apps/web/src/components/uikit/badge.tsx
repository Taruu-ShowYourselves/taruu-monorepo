import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 border-2 px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-widest',
  {
    variants: {
      variant: {
        default: 'border-ink bg-ink text-paper',
        outline: 'border-ink bg-transparent text-ink',
        red: 'border-red bg-red text-paper',
        soft: 'border-ink-faint bg-transparent text-ink-soft',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
