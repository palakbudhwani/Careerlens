import { CircleAlert, CircleCheck } from 'lucide-react'

import { cn } from '@/lib/utils'

export function SkillChip({ label, covered, className }: { label: string; covered: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      {covered ? (
        <CircleCheck className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
      ) : (
        <CircleAlert className="size-3.5 shrink-0 text-amber-500" aria-hidden />
      )}
      {label}
    </span>
  )
}