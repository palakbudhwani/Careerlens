import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type BadgeVariant =
  | 'neutral'
  | 'outline'
  | 'primary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'accent'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral: 'bg-muted text-muted-foreground dark:bg-muted/60',
  outline: 'border-border bg-transparent text-muted-foreground',
  primary:
    'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  destructive:
    'border-red-200 bg-red-50 text-red-600 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-400',
  accent: 'border-brand-200 bg-accent text-accent-foreground dark:border-brand-500/25',
}

export function Badge({ className, variant = 'neutral', dot = false, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />}
      {props.children}
    </span>
  )
}