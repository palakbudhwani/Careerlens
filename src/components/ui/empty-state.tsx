import type { ReactNode } from 'react'

import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}