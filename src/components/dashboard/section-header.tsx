import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export function DashboardSectionHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  viewAllTo,
  viewAllLabel = 'View all',
  className,
}: {
  icon?: LucideIcon
  eyebrow?: string
  title: string
  description?: string
  viewAllTo?: string
  viewAllLabel?: string
  className?: string
}) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-brand-600 shadow-card dark:text-brand-400">
            <Icon className="size-5" aria-hidden />
          </span>
        )}
        <div>
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              {eyebrow}
            </p>
          )}
          <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {viewAllTo && (
        <Link
          to={viewAllTo}
          className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          {viewAllLabel}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}
    </div>
  )
}
