import { ArrowRight, Clock, Lightbulb, Rocket, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DashboardSectionHeader } from '@/components/dashboard/section-header'
import type { DashboardData } from '@/components/dashboard/dashboard-data'
import type { CareerRecommendation } from '@/types'

type BadgeVariant = NonNullable<BadgeProps['variant']>

const impactStyles: Record<
  CareerRecommendation['impact'],
  { badge: BadgeVariant; label: string }
> = {
  high: { badge: 'primary', label: 'High impact' },
  medium: { badge: 'warning', label: 'Medium impact' },
  low: { badge: 'neutral', label: 'Low impact' },
}

function RecommendationRow({ recommendation }: { recommendation: CareerRecommendation }) {
  const style = impactStyles[recommendation.impact]
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand-200 dark:hover:border-brand-500/30">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
        <Lightbulb className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{recommendation.title}</p>
          <Badge variant={style.badge} className="shrink-0 text-[10px]">
            {style.label}
          </Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {recommendation.description}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            {recommendation.timeframe}
          </span>
          <span className="inline-flex items-center gap-1">
            <Zap className="size-3" aria-hidden />
            {recommendation.effort} effort
          </span>
        </div>
      </div>
    </div>
  )
}

export function RecommendationsPanel({ data }: { data: DashboardData }) {
  return (
    <div>
      <DashboardSectionHeader
        icon={Rocket}
        eyebrow="Your roadmap"
        title="Recommended next steps"
        description="Highest-impact moves for the weeks ahead"
        viewAllTo="/career-growth"
        viewAllLabel="Open plan"
      />
      <div className="space-y-3">
        {data.topRecommendations.map((recommendation) => (
          <RecommendationRow key={recommendation.id} recommendation={recommendation} />
        ))}
      </div>
      <Link to="/career-growth" className="mt-4 block">
        <Button
          className="w-full"
          variant="outline"
          rightIcon={<ArrowRight className="size-4" aria-hidden />}
        >
          Open career plan
        </Button>
      </Link>
    </div>
  )
}
