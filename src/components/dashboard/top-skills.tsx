import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge, type BadgeProps } from '@/components/ui/badge'
import { DashboardSectionHeader } from '@/components/dashboard/section-header'
import type { DashboardData } from '@/components/dashboard/dashboard-data'
import type { SkillCategory } from '@/types'
import { cn } from '@/lib/utils'

type BadgeVariant = NonNullable<BadgeProps['variant']>

const categoryStyles: Record<SkillCategory, { bar: string; badge: BadgeVariant; label: string }> = {
  technical: { bar: 'bg-brand-500 dark:bg-brand-400', badge: 'primary', label: 'Technical' },
  soft: { bar: 'bg-emerald-500 dark:bg-emerald-400', badge: 'success', label: 'Soft' },
  tool: { bar: 'bg-amber-500 dark:bg-amber-400', badge: 'warning', label: 'Tool' },
}

export function TopSkills({ data }: { data: DashboardData }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <DashboardSectionHeader
        icon={Sparkles}
        eyebrow="Skill profile"
        title="Top skills"
        description="Your strongest assets for target roles"
      />

      <div className="divide-y divide-border">
        {data.topSkills.map((skill, index) => {
          const style = categoryStyles[skill.category]
          return (
            <div key={skill.id} className="flex items-center gap-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 font-display text-xs font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{skill.name}</p>
                  <Badge variant={style.badge} className="shrink-0 text-[10px]">
                    {style.label}
                  </Badge>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <span
                      key={step}
                      className={cn(
                        'h-1.5 w-6 rounded-full transition-colors',
                        step <= skill.proficiency ? style.bar : 'bg-muted',
                      )}
                      aria-hidden
                    />
                  ))}
                  <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                    {skill.proficiency}/5
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {data.candidate.topSkills.length} skills · {data.technicalCount} technical ·{' '}
          {data.softCount} soft · {data.toolCount} tool
        </p>
        <Link
          to="/skill-gaps"
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          Manage skills <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
