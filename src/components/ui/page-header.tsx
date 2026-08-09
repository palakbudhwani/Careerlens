import type { ReactNode } from 'react'

import type { LucideIcon } from 'lucide-react'

export function PageHeader({
  title,
  description,
  icon: Icon,
  badge,
  actions,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  badge?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3.5">
        {Icon && (
          <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-brand-600 shadow-card sm:inline-flex dark:text-brand-400">
            <Icon className="size-5" aria-hidden />
          </span>
        )}
        <div className="space-y-1">
          {badge}
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}