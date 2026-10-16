import {
  ArrowRight,
  CheckCircle2,
  ScanSearch,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { ScoreRing } from '@/components/landing/score-ring'
import { useOptionalResumeUpload } from '@/components/resume/resume-upload-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ResultSourceNote } from '@/components/ui/result-source'
import { mockStore } from '@/lib/mock-store'
import type { JobMatch, MatchLevel } from '@/types'

const levelVariant: Record<MatchLevel, 'success' | 'warning' | 'destructive'> = {
  strong: 'success',
  moderate: 'warning',
  weak: 'destructive',
}

const levelLabel: Record<MatchLevel, string> = {
  strong: 'Strong fit',
  moderate: 'Moderate fit',
  weak: 'Weak fit',
}

export interface CareerFitProps {
  /** True once a resume has been uploaded in this session. */
  hasResume: boolean
  /** Resume-derived matches (rule-based), best first — null while unresolved. */
  matches: JobMatch[] | null
  /** True while a newly uploaded resume is still being scored (non-blocking). */
  pending: boolean
}

/**
 * Resume-aware Career Fit section of the Jobs page.
 *
 * With no resume it invites an upload (nothing is scored, nothing is faked).
 * With a resume it renders the deterministic scores derived from the parsed
 * file via `deriveJobMatches` and labels the source honestly: rule-based, no
 * AI involved.
 */
export function CareerFit({ hasResume, matches, pending }: CareerFitProps) {
  const upload = useOptionalResumeUpload()

  if (!hasResume) {
    return (
      <Card className="relative overflow-hidden" data-testid="career-fit">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-brand-500/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Resume-aware</Badge>
              <Badge variant="primary" dot>
                Not scored yet
              </Badge>
            </div>
            <h2 className="mt-2 font-display text-xl font-bold tracking-tight">
              See how every role fits your resume
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Upload your resume and CareerLens scores each listing against your real skills,
              experience, and education. Scoring runs deterministically on your parsed file — no AI
              is used for this section, and nothing is computed until you upload.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                onClick={() => upload?.openResumeUpload()}
                leftIcon={<Upload className="size-4" aria-hidden />}
                data-testid="career-fit-upload"
              >
                Upload resume to see my fit
              </Button>
              <Link to="/match">
                <Button
                  variant="outline"
                  leftIcon={<ScanSearch className="size-4" aria-hidden />}
                >
                  How match analysis works
                </Button>
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Your resume stays in this browser session and is only used for analysis you trigger.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const top = (matches ?? []).slice(0, 3)

  return (
    <Card data-testid="career-fit">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Resume-aware</Badge>
            <Badge variant="success" dot>
              Scored from your resume
            </Badge>
          </div>
          <h2 className="mt-2 font-display text-xl font-bold tracking-tight">Career Fit</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your strongest matches across every live listing, recomputed from your uploaded resume.
          </p>
        </div>
        <ResultSourceNote source="Rule-based" />
      </div>

      <div className="p-5 sm:p-6">
        {pending ? (
          <div
            role="status"
            aria-busy="true"
            data-testid="career-fit-pending"
            className="space-y-3"
          >
            {[0, 1, 2].map((row) => (
              <div
                key={row}
                className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4 motion-safe:animate-pulse"
              >
                <div className="size-14 shrink-0 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Updating your career fit from the uploaded resume…
            </p>
          </div>
        ) : top.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matches could be derived from your resume yet. Re-upload it in Match Analysis to
            refresh this section.
          </p>
        ) : (
          <div className="space-y-3">
            {top.map((match) => {
              const job = mockStore.getJob(match.jobId)
              if (!job) return null
              return (
                <div
                  key={match.id}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center"
                  data-testid="career-fit-match"
                >
                  <ScoreRing value={match.score} size={56} stroke={5} label="Fit" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-display text-sm font-semibold tracking-tight">
                        {job.title}
                      </p>
                      <Badge variant={levelVariant[match.level]} dot>
                        {levelLabel[match.level]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {job.company} · {job.location}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {match.strengths[0] && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" aria-hidden />
                          {match.strengths[0]}
                        </span>
                      )}
                      {match.missingSkills.slice(0, 2).map((missing) => (
                        <span key={missing.skill} className="inline-flex items-center gap-1">
                          <XCircle className="size-3 text-amber-500" aria-hidden />
                          {missing.skill} ({missing.importance})
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link to={`/jobs/${job.id}`} className="shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      rightIcon={<ArrowRight className="size-3.5" aria-hidden />}
                    >
                      Open role
                    </Button>
                  </Link>
                </div>
              )
            })}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-muted-foreground">
                Scores are computed locally from your resume — no AI call is made for this section.
              </p>
              <Link to="/match">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<ScanSearch className="size-3.5" aria-hidden />}
                >
                  Open full Match Analysis
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
