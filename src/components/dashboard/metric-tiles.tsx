import type { LucideIcon } from 'lucide-react'
import { FileText, Gauge, Target, UserRound } from 'lucide-react'

import { CountUp } from '@/components/landing/count-up'
import { Progress } from '@/components/ui/progress'
import type { DashboardData } from '@/components/dashboard/dashboard-data'
import { cn } from '@/lib/utils'

function MetricTile({
  icon: Icon,
  label,
  value,
  suffix,
  caption,
  progress,
  iconClassName,
  progressClassName,
}: {
  icon: LucideIcon
  label: string
  value: number
  suffix?: string
  caption: string
  progress?: number
  iconClassName?: string
  progressClassName?: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-lg">
      <div className="flex items-center justify-between gap-3">
        <span className={cn('flex size-10 items-center justify-center rounded-xl', iconClassName)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          Live
        </span>
      </div>
      <p className="mt-4 font-display text-3xl font-bold tracking-tight">
        <CountUp value={value} suffix={suffix ?? ''} />
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{caption}</p>
      {typeof progress === 'number' && (
        <Progress value={progress} className="mt-3.5 h-1.5" indicatorClassName={progressClassName} />
      )}
    </div>
  )
}

export function MetricTiles({ data }: { data: DashboardData }) {
  const tiles: Array<Parameters<typeof MetricTile>[0]> = [
    {
      icon: FileText,
      label: 'Resume strength',
      value: data.resumeStrength,
      suffix: '%',
      caption: data.resume?.fileName ?? 'No resume uploaded',
      progress: data.resumeStrength,
      iconClassName: 'bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
      progressClassName: 'bg-brand-500 dark:bg-brand-400',
    },
    {
      icon: UserRound,
      label: 'Profile completeness',
      value: data.profileCompleteness,
      suffix: '%',
      caption: 'Contact, skills, experience & goals',
      progress: data.profileCompleteness,
      iconClassName: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
      progressClassName: 'bg-blue-500 dark:bg-blue-400',
    },
    {
      icon: Target,
      label: 'Strong matches',
      value: data.strongMatchCount,
      caption: `${data.matchCount} roles analyzed · avg ${data.careerReadiness}% fit`,
      progress: data.matchCount
        ? Math.round((data.strongMatchCount / data.matchCount) * 100)
        : 0,
      iconClassName: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
      progressClassName: 'bg-emerald-500 dark:bg-emerald-400',
    },
    {
      icon: Gauge,
      label: 'Critical skill gaps',
      value: data.criticalGapCount,
      caption: `${data.totalGapCount} gaps in your target plan`,
      progress: data.totalGapCount
        ? Math.round((data.criticalGapCount / data.totalGapCount) * 100)
        : 0,
      iconClassName: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
      progressClassName: 'bg-amber-500 dark:bg-amber-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((tile) => (
        <MetricTile key={tile.label} {...tile} />
      ))}
    </div>
  )
}
