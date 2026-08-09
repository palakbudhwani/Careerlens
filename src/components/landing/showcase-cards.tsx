import type { ReactNode } from 'react'

import { Check, CircleAlert, FileText, Rocket } from 'lucide-react'

import { MetricBar } from '@/components/landing/metric-bar'
import { ScoreRing } from '@/components/landing/score-ring'
import { SkillChip } from '@/components/landing/skill-chip'
import { careerPlan, matchPreview, resumeAnalysis, skillGaps } from '@/data/landing'

function CardHeaderIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-brand-600 dark:text-brand-400">
      {children}
    </span>
  )
}

export function ResumeAnalysisCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card-lg sm:p-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <CardHeaderIcon>
          <FileText className="size-4" aria-hidden />
        </CardHeaderIcon>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{resumeAnalysis.fileName}</p>
          <p className="text-xs text-muted-foreground">Analyzed 12 seconds ago</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
          Parsed
        </span>
      </div>

      <div className="flex items-center gap-4 py-4">
        <ScoreRing value={resumeAnalysis.score} size={76} stroke={7} suffix="/100" label="Resume score" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">A strong resume</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Beats 84% of resumes submitted for AI roles.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {resumeAnalysis.metrics.map((metric) => (
          <MetricBar key={metric.label} label={metric.label} value={metric.value} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 border-t border-border pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Strengths
          </p>
          <ul className="space-y-1.5">
            {resumeAnalysis.strengths.map((strength) => (
              <li key={strength} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-hidden />
                {strength}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Improvements
          </p>
          <ul className="space-y-1.5">
            {resumeAnalysis.improvements.map((improvement) => (
              <li key={improvement} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
                {improvement}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function MatchCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card-lg sm:p-6">
      <div className="flex items-center gap-4">
        <ScoreRing value={matchPreview.score} size={84} stroke={8} label="Overall" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Top match for you
          </p>
          <p className="mt-1 font-display text-base font-semibold">{matchPreview.role}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Scored against your skills, experience, education, and projects.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {matchPreview.breakdown.map((row) => (
          <MetricBar key={row.label} label={row.label} value={row.value} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 border-t border-border pt-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            You match
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matchPreview.matched.map((skill) => (
              <SkillChip key={skill} label={skill} covered />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Missing
          </p>
          <div className="flex flex-wrap gap-1.5">
            {matchPreview.missing.map((skill) => (
              <SkillChip key={skill} label={skill} covered={false} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function GapCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card-lg sm:p-6">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <CardHeaderIcon>
          <CircleAlert className="size-4 text-amber-500" aria-hidden />
        </CardHeaderIcon>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Skill gap report</p>
          <p className="text-xs text-muted-foreground">for {careerPlan.targetRole}</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
          2 gaps flagged
        </span>
      </div>

      <div className="mt-4 space-y-3.5">
        {skillGaps.map((gap) => (
          <div key={gap.skill}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{gap.skill}</span>
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-amber-600 dark:text-amber-400">{gap.current}%</span> now
                · requires {gap.required}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${gap.current}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{gap.impact}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <CircleAlert className="size-4 shrink-0 text-amber-500" aria-hidden />
        <p className="text-xs text-muted-foreground">
          Closing these gaps could add{' '}
          <span className="font-semibold text-foreground">+8 points</span> to your best matches.
        </p>
      </div>
    </div>
  )
}

export function GrowthCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card-lg sm:p-6">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Target role readiness
          </p>
          <p className="mt-1 font-display text-lg font-bold tracking-tight">{careerPlan.targetRole}</p>
        </div>
        <ScoreRing value={careerPlan.readiness} size={72} stroke={7} label="Ready" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Next skills
        </span>
        {careerPlan.nextSkills.map((skill) => (
          <SkillChip key={skill} label={skill} covered={false} />
        ))}
      </div>

      <div className="mt-5 flex items-start gap-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-500/25 dark:bg-brand-500/10">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
          <Rocket className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Recommended project</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{careerPlan.project}</p>
        </div>
      </div>
    </div>
  )
}