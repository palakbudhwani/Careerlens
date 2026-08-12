import type { LucideIcon } from 'lucide-react'
import { ArrowUpRight, Briefcase, Gauge, ScanSearch, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DashboardSectionHeader } from '@/components/dashboard/section-header'
import { useResumeUpload } from '@/components/resume/resume-upload-provider'
import { cn } from '@/lib/utils'

const actions: Array<{
  label: string
  description: string
  to?: string
  icon: LucideIcon
  tint: string
}> = [
  {
    label: 'Upload resume',
    description: 'Parse & score your latest resume',
    icon: Upload,
    tint: 'bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  },
  {
    label: 'Explore jobs',
    description: 'Browse roles matched to you',
    to: '/jobs',
    icon: Briefcase,
    tint: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
  },
  {
    label: 'Match analysis',
    description: 'Score a resume against a role',
    to: '/match',
    icon: ScanSearch,
    tint: 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  },
  {
    label: 'Skill gaps',
    description: 'Close what is holding you back',
    to: '/skill-gaps',
    icon: Gauge,
    tint: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  },
]

function ActionCard({
  action,
  onClick,
  asButton = false,
}: {
  action: (typeof actions)[number]
  onClick?: () => void
  asButton?: boolean
}) {
  const content = (
    <>
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
          action.tint,
        )}
      >
        <action.icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{action.label}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.description}</p>
      </div>
      <ArrowUpRight
        className="size-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-600 dark:group-hover:text-brand-400"
        aria-hidden
      />
    </>
  )
  const className =
    'group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-lg dark:hover:border-brand-500/30'
  if (asButton) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }
  return (
    <Link to={action.to ?? '#'} className={className}>
      {content}
    </Link>
  )
}

export function QuickActions() {
  const { openResumeUpload } = useResumeUpload()

  return (
    <div>
      <DashboardSectionHeader
        icon={ArrowUpRight}
        eyebrow="Jump back in"
        title="Quick actions"
        description="Everything you need, one tap away"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => (
          <ActionCard
            key={action.label}
            action={action}
            asButton={!action.to}
            onClick={!action.to ? openResumeUpload : undefined}
          />
        ))}
      </div>
    </div>
  )
}
