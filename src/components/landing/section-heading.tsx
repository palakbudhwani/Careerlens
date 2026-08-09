import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-brand-50/70 px-3 py-1 text-xs font-semibold tracking-wide text-brand-700 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  align?: 'center' | 'left'
}) {
  return (
    <div className={cn('max-w-2xl', align === 'center' ? 'mx-auto text-center' : 'text-left')}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  )
}