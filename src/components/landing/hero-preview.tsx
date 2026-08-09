import type { ReactNode } from 'react'

import {
  ArrowUp,
  Bell,
  Briefcase,
  FileText,
  Gauge,
  LayoutDashboard,
  Search,
  ScanSearch,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

import { SkillChip } from '@/components/landing/skill-chip'
import { LogoMark } from '@/components/ui/logo'
import { heroRoles, heroSkills, heroStats, type HeroRole } from '@/data/landing'
import { cn } from '@/lib/utils'

const railItems = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Resume', icon: FileText },
  { label: 'Jobs', icon: Briefcase },
  { label: 'Matches', icon: ScanSearch },
  { label: 'Skill gaps', icon: Gauge },
  { label: 'Growth', icon: TrendingUp },
]

function WindowBar() {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
      <div className="flex shrink-0 gap-1.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-red-400/80" />
        <span className="size-2.5 rounded-full bg-amber-400/80" />
        <span className="size-2.5 rounded-full bg-emerald-400/80" />
      </div>
      <div className="mx-auto flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
        <Search className="size-3 shrink-0" aria-hidden />
        <span className="truncate">career.ai/app/analysis</span>
      </div>
      <div className="relative shrink-0 text-muted-foreground">
        <Bell className="size-4" aria-hidden />
        <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-brand-500 ring-2 ring-card" aria-hidden />
      </div>
    </div>
  )
}

function Rail() {
  return (
    <aside className="hidden shrink-0 flex-col border-r border-border bg-muted/20 p-3 lg:flex">
      <div className="mb-3 flex items-center gap-2 px-1.5">
        <LogoMark size={20} />
        <span className="font-display text-sm font-bold tracking-tight">CareerLens</span>
      </div>
      <nav className="space-y-0.5" aria-hidden>
        {railItems.map((item) => (
          <span
            key={item.label}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium',
              item.active
                ? 'bg-brand-600/15 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                : 'text-muted-foreground',
            )}
          >
            <item.icon className="size-3.5 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.active && (
              <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
            )}
          </span>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600/15 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          PS
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold">Priya Sharma</p>
          <p className="truncate text-[10px] text-muted-foreground">Data Scientist</p>
        </div>
      </div>
    </aside>
  )
}

function StatCard({ label, value, suffix }: (typeof heroStats)[number]) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          <ArrowUp className="size-2.5" aria-hidden />
          2.4%
        </span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold tracking-tight">
        {value}
        <span className="ml-0.5 text-sm font-semibold text-muted-foreground">{suffix}</span>
      </p>
    </div>
  )
}

function RoleRow({ title, score }: HeroRole) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{title}</p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-blue-500"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
      <span className="text-xs font-bold tabular-nums text-brand-600 dark:text-brand-400">{score}%</span>
    </div>
  )
}

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-3.5', className)}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

export function HeroPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_48px_100px_-48px_rgba(11,15,34,0.45)]">
      <WindowBar />
      <div className="grid lg:grid-cols-[204px_1fr]">
        <Rail />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Good afternoon, Priya</p>
              <h3 className="font-display text-lg font-bold tracking-tight">Career analysis</h3>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-brand-50/70 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300">
              <Sparkles className="size-3" aria-hidden />
              Ready to improve
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Recommended roles">
              <div className="space-y-3.5">
                {heroRoles.map((role) => (
                  <RoleRow key={role.title} {...role} />
                ))}
              </div>
            </Panel>
            <Panel title="Skill intelligence">
              <div className="grid grid-cols-2 gap-2">
                {heroSkills.map((skill) => (
                  <SkillChip key={skill.name} label={skill.name} covered={skill.covered} />
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}