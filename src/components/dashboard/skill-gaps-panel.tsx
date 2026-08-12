import { ArrowRight, Gauge, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DashboardSectionHeader } from '@/components/dashboard/section-header'
import type { DashboardData } from '@/components/dashboard/dashboard-data'
import type { SkillGap } from '@/types'
import { cn } from '@/lib/utils'

type BadgeVariant = NonNullable<BadgeProps['variant']>

const importanceStyles: Record<
  SkillGap['importance'],
  { badge: BadgeVariant; label: string }
> = {
  critical: { badge: 'destructive', label: 'Critical' },
  important: { badge: 'warning', label: 'Important' },
  'nice-to-have': { badge: 'neutral', label: 'Nice-to-have' },
}

function GapRow({ gap }: { gap: SkillGap }) {
  const style = importanceStyles[gap.importance]
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-amber-200 dark:hover:border-amber-500/30">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
        <Wrench className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{gap.skill}</p>
          <Badge variant={style.badge} className="shrink-0 text-[10px]">
            {style.label}
          </Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {gap.recommendedAction}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Level</span>
          <div className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: gap.requiredLevel }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 w-3.5 rounded-full',
                  index < gap.currentLevel ? 'bg-amber-500 dark:bg-amber-400' : 'bg-muted',
                )}
              />
            ))}
          </div>
          <span className="text-[11px] font-semibold text-foreground">
            {gap.currentLevel}/{gap.requiredLevel}
          </span>
          <span className="text-[11px] text-muted-foreground">required</span>
        </div>
      </div>
    </div>
  )
}

export function SkillGapsPanel({ data }: { data: DashboardData }) {
  return (
    <div>
      <DashboardSectionHeader
        icon={Gauge}
        eyebrow="Close the gap"
        title="Priority skill gaps"
        description="What to learn next to raise your match rate"
        viewAllTo="/skill-gaps"
        viewAllLabel="View all"
      />
      <div className="space-y-3">
        {data.topGaps.map((gap) => (
          <GapRow key={gap.id} gap={gap} />
        ))}
      </div>
      <Link to="/skill-gaps" className="mt-4 block">
        <Button
          className="w-full"
          variant="outline"
          rightIcon={<ArrowRight className="size-4" aria-hidden />}
        >
          Review all gaps
        </Button>
      </Link>
    </div>
  )
}
