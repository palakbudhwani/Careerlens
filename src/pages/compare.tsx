import { useMemo, useRef, useState } from 'react'

import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Briefcase,
  Building2,
  CheckCircle2,
  GitCompare,
  MapPin,
  ScanSearch,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { ScoreRing } from '@/components/landing/score-ring'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import { mockStore } from '@/lib/mock-store'
import { formatSalaryRange } from '@/lib/utils'
import type { Job, JobMatch, MatchLevel } from '@/types'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const typeLabels: Record<Job['type'], string> = {
  'full-time': 'Full-time',
  contract: 'Contract',
  internship: 'Internship',
}

const workModeLabels: Record<Job['workMode'], string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

const levelStyles: Record<
  MatchLevel,
  { variant: 'success' | 'warning' | 'destructive'; label: string }
> = {
  strong: { variant: 'success', label: 'Strong fit' },
  moderate: { variant: 'warning', label: 'Moderate fit' },
  weak: { variant: 'destructive', label: 'Weak fit' },
}

function deriveExperienceLevel(title: string): string {
  const t = title.toLowerCase()
  if (/staff|principal|lead/.test(t)) return 'Staff'
  if (/senior/.test(t)) return 'Senior'
  if (/junior|entry|graduate/.test(t)) return 'Junior'
  return 'Mid'
}

function ScoreFor(job: Job, match?: JobMatch): number | undefined {
  if (typeof job.matchScore === 'number') return job.matchScore
  return match?.score
}

function LevelFor(job: Job, match?: JobMatch): MatchLevel | undefined {
  return job.matchLevel ?? match?.level
}

function NoData({ label = 'Not available' }: { label?: string }) {
  return <span className="text-xs italic text-muted-foreground/60">{label}</span>
}

function SelectedChip({
  job,
  onRemove,
}: {
  job: Job
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 py-1.5 pl-2 pr-1.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-blue-600 font-display text-[10px] font-bold text-white">
        {job.company.slice(0, 1).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="max-w-[180px] truncate text-xs font-semibold text-foreground">{job.title}</p>
        <p className="max-w-[180px] truncate text-[10px] text-muted-foreground">{job.company}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${job.title} from comparison`}
        className="ml-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}

function JobColumnHeader({
  job,
  match,
  isBest,
  onRemove,
}: {
  job: Job
  match?: JobMatch
  isBest: boolean
  onRemove: () => void
}) {
  const score = ScoreFor(job, match)
  const level = LevelFor(job, match)

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-blue-600 font-display text-xs font-bold text-white shadow-sm">
          {job.company.slice(0, 1).toUpperCase()}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${job.title} from comparison`}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          <p className="font-display text-sm font-semibold tracking-tight text-foreground">
            {job.title}
          </p>
          {isBest && (
            <Badge variant="primary" className="shrink-0 text-[10px]">
              Best
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {job.company} · {job.location}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        {typeof score === 'number' ? (
          <ScoreRing value={score} size={52} stroke={5} label="Match" />
        ) : (
          <Badge variant="neutral" dot>
            Not scored
          </Badge>
        )}
        {level && (
          <Badge variant={levelStyles[level].variant} dot>
            {levelStyles[level].label}
          </Badge>
        )}
      </div>

      <div className="flex gap-2">
        <Link to={`/match/${job.id}`} className="flex-1">
          <Button size="sm" className="w-full" leftIcon={<ScanSearch className="size-3.5" aria-hidden />}>
            Analyze Match
          </Button>
        </Link>
        <Link to={`/jobs/${job.id}`}>
          <Button
            size="sm"
            variant="ghost"
            rightIcon={<ArrowRight className="size-3.5" aria-hidden />}
          >
            View job
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default function ComparePage() {
  const jobs = useMemo(() => mockStore.getJobs(), [])
  const matchesById = useMemo(() => {
    const map: Record<string, JobMatch> = {}
    for (const match of mockStore.getMatches()) map[match.jobId] = match
    return map
  }, [])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [picker, setPicker] = useState('')
  const resultsRef = useRef<HTMLDivElement>(null)

  const selectedJobs = selectedIds
    .map((id) => jobs.find((job) => job.id === id))
    .filter((job): job is Job => Boolean(job))

  const availableJobs = jobs.filter((job) => !selectedIds.includes(job.id))

  const addJob = (id: string) => {
    if (!id || selectedIds.length >= 3 || selectedIds.includes(id)) return
    setSelectedIds((prev) => [...prev, id])
    setPicker('')
  }

  const removeJob = (id: string) => setSelectedIds((prev) => prev.filter((x) => x !== id))

  const ranked = useMemo(() => {
    return selectedJobs
      .map((job) => ({
        job,
        match: matchesById[job.id],
        score: ScoreFor(job, matchesById[job.id]),
      }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  }, [selectedIds, selectedJobs, matchesById])

  const withScore = ranked.filter((entry) => typeof entry.score === 'number')
  const canRecommend = selectedJobs.length >= 2 && withScore.length >= 2

  const best = withScore.length > 0 ? withScore[0] : null
  const bestScore = best ? best.score : undefined
  const bestIds =
    typeof bestScore === 'number'
      ? withScore.filter((entry) => entry.score === bestScore).map((entry) => entry.job.id)
      : []
  const isTie = bestIds.length > 1

  const maxSalaryMin = Math.max(...selectedJobs.map((job) => job.salaryRange.min), -1)

  const gridColumns = `minmax(150px, 190px) repeat(${selectedJobs.length}, minmax(240px, 1fr))`

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="outline">Job Comparison</Badge>
            <Badge variant="primary" dot>
              {jobs.length} roles available
            </Badge>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Compare Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select 2–3 roles and weigh them side by side on fit, compensation, skills, and gaps.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link to="/jobs">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Briefcase className="size-3.5" aria-hidden />}
            >
              Browse jobs
            </Button>
          </Link>
          <Link to="/match">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ScanSearch className="size-3.5" aria-hidden />}
            >
              Match Analysis
            </Button>
          </Link>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-brand-600 shadow-card dark:text-brand-400">
              <GitCompare className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-display text-base font-semibold tracking-tight">
                Build your comparison
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pick up to 3 roles from your live matches to compare side by side.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={picker}
              onChange={(e) => addJob(e.target.value)}
              aria-label="Add job to comparison"
              disabled={selectedJobs.length >= 3}
              className="sm:w-72"
            >
              <option value="">
                {selectedJobs.length >= 3 ? 'Maximum 3 selected' : 'Add a job…'}
              </option>
              {availableJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} · {job.company}
                </option>
              ))}
            </Select>
            <Button
              onClick={scrollToResults}
              disabled={selectedJobs.length < 2}
              leftIcon={<GitCompare className="size-4" aria-hidden />}
            >
              Compare Jobs
            </Button>
          </div>
        </div>

        {selectedJobs.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            {selectedJobs.map((job) => (
              <SelectedChip key={job.id} job={job} onRemove={() => removeJob(job.id)} />
            ))}
            <span className="text-xs text-muted-foreground">
              {selectedJobs.length} of 3 selected
            </span>
          </div>
        )}

        {selectedJobs.length === 1 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground">
            <AlertCircle className="size-4 shrink-0 text-amber-500" aria-hidden />
            Add one or two more roles to start comparing — at least 2 are required.
          </div>
        )}
      </Card>

      {selectedJobs.length === 0 ? (
        <EmptyState
          icon={GitCompare}
          title="Select 2–3 jobs to compare"
          description="Choose roles from the Jobs list to see them evaluated side by side on match, compensation, and skills."
          action={
            <Link to="/jobs">
              <Button variant="outline" size="sm" leftIcon={<Briefcase className="size-3.5" aria-hidden />}>
                Browse jobs
              </Button>
            </Link>
          }
        />
      ) : selectedJobs.length === 1 ? (
        <EmptyState
          icon={GitCompare}
          title="One more role needed to compare"
          description="Add a second job from the selector above and the comparison will render automatically."
        />
      ) : (
        <div ref={resultsRef} className="space-y-6 scroll-mt-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeOut }}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
          >
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-5 py-3.5">
              <GitCompare className="size-4 text-brand-600 dark:text-brand-400" aria-hidden />
              <p className="font-display text-sm font-semibold tracking-tight">
                Side-by-side comparison
              </p>
              <span className="ml-auto text-xs text-muted-foreground">
                {selectedJobs.length} roles
              </span>
            </div>

            <div className="overflow-x-auto">
              <div style={{ minWidth: 200 + selectedJobs.length * 260 }}>
                <div className="grid" style={{ gridTemplateColumns: gridColumns }}>
                  <div />
                  {selectedJobs.map((job) => {
                    const match = matchesById[job.id]
                    const score = ScoreFor(job, match)
                    const isBest = typeof bestScore === 'number' && score === bestScore
                    return (
                      <div key={job.id} className="border-l border-border">
                        <JobColumnHeader
                          job={job}
                          match={match}
                          isBest={isBest}
                          onRemove={() => removeJob(job.id)}
                        />
                      </div>
                    )
                  })}
                </div>

                <div className="grid border-t border-border" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Company · Location
                  </div>
                  {selectedJobs.map((job) => (
                    <div key={job.id} className="border-l border-border p-4">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
                        {job.company}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" aria-hidden />
                        {job.location}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid border-t border-border" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Employment type
                  </div>
                  {selectedJobs.map((job) => (
                    <div key={job.id} className="border-l border-border p-4 text-sm text-foreground">
                      {typeLabels[job.type]}
                    </div>
                  ))}
                </div>

                <div className="grid border-t border-border" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Work mode
                  </div>
                  {selectedJobs.map((job) => (
                    <div key={job.id} className="border-l border-border p-4 text-sm text-foreground">
                      {workModeLabels[job.workMode]}
                    </div>
                  ))}
                </div>

                <div className="grid border-t border-border" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Experience level
                  </div>
                  {selectedJobs.map((job) => (
                    <div key={job.id} className="border-l border-border p-4 text-sm text-foreground">
                      {deriveExperienceLevel(job.title)}
                    </div>
                  ))}
                </div>

                <div className="grid border-t border-border" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Salary
                  </div>
                  {selectedJobs.map((job) => {
                    const isTop = job.salaryRange.min === maxSalaryMin
                    return (
                      <div
                        key={job.id}
                        className={`border-l border-border p-4 text-sm ${
                          isTop ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                            <Banknote className="size-3.5 text-muted-foreground" aria-hidden />
                            {formatSalaryRange(job.salaryRange.min, job.salaryRange.max)}
                          </span>
                          {isTop && <Badge variant="primary" className="text-[10px]">Top</Badge>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="grid border-t border-border" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Match score
                  </div>
                  {selectedJobs.map((job) => {
                    const match = matchesById[job.id]
                    const score = ScoreFor(job, match)
                    const isBest = typeof bestScore === 'number' && score === bestScore
                    return (
                      <div
                        key={job.id}
                        className={`border-l border-border p-4 ${
                          isBest ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''
                        }`}
                      >
                        {typeof score === 'number' ? (
                          <div className="flex items-center gap-3">
                            <span className="font-display text-2xl font-bold tracking-tight text-brand-600 dark:text-brand-400">
                              {score}%
                            </span>
                            <Progress value={score} className="h-1.5 flex-1" />
                            {isBest && <Badge variant="primary" className="text-[10px]">Best</Badge>}
                          </div>
                        ) : (
                          <NoData label="Not scored" />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="grid border-t border-border" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Fit level
                  </div>
                  {selectedJobs.map((job) => {
                    const match = matchesById[job.id]
                    const level = LevelFor(job, match)
                    return (
                      <div key={job.id} className="border-l border-border p-4">
                        {level ? (
                          <Badge variant={levelStyles[level].variant} dot>
                            {levelStyles[level].label}
                          </Badge>
                        ) : (
                          <NoData />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="grid border-t border-border" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Key skills
                  </div>
                  {selectedJobs.map((job) => (
                    <div key={job.id} className="border-l border-border p-4">
                      {job.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {job.skills.slice(0, 5).map((skill) => (
                            <Badge key={skill.id} variant="primary" className="text-[11px]">
                              {skill.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <NoData />
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid border-t border-border" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Missing skills
                  </div>
                  {selectedJobs.map((job) => {
                    const match = matchesById[job.id]
                    return (
                      <div key={job.id} className="border-l border-border p-4">
                        {match && match.missingSkills.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {match.missingSkills.map((missing) => (
                              <Badge
                                key={missing.skill}
                                variant={
                                  missing.importance === 'critical' ? 'destructive' : 'outline'
                                }
                                className="text-[11px]"
                              >
                                {missing.skill}
                              </Badge>
                            ))}
                          </div>
                        ) : match ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3.5" aria-hidden />
                            No critical gaps
                          </span>
                        ) : (
                          <NoData />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="grid border-t border-border" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Key strengths
                  </div>
                  {selectedJobs.map((job) => {
                    const match = matchesById[job.id]
                    return (
                      <div key={job.id} className="border-l border-border p-4">
                        {match && match.strengths.length > 0 ? (
                          <ul className="space-y-1.5">
                            {match.strengths.slice(0, 3).map((strength) => (
                              <li
                                key={strength}
                                className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                              >
                                <CheckCircle2
                                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                                  aria-hidden
                                />
                                <span>{strength}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <NoData />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="grid border-t border-border" style={{ gridTemplateColumns: gridColumns }}>
                  <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Summary
                  </div>
                  {selectedJobs.map((job) => {
                    const match = matchesById[job.id]
                    return (
                      <div key={job.id} className="border-l border-border p-4">
                        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
                          {match?.summary ?? job.description}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: easeOut }}
            className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-600 via-brand-500 to-blue-600 text-white shadow-card-lg dark:border-brand-400/20"
          >
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -right-16 -top-20 size-64 rounded-full bg-white/10 blur-3xl" />
            </div>

            <div className="relative p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
                  <Trophy className="size-3.5" aria-hidden />
                  {canRecommend && best ? 'CareerLens recommendation' : 'Comparison summary'}
                </span>
              </div>

              {canRecommend && best ? (
                <>
                  <h2 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                    {isTie ? 'Tied for best overall fit' : 'Best overall fit'}
                  </h2>
                  <p className="mt-1.5 text-lg font-semibold text-white/95">{best.job.title}</p>
                  <p className="text-sm font-medium text-white/75">
                    {best.job.company} · {best.job.location}
                  </p>

                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85">
                    {isTie
                      ? `${best.job.title} and the other top scorer share the highest match score (${best.score}%) — pick based on which environment, compensation, and growth path suit you best.`
                      : `${best.job.title} leads this comparison with the highest match score (${best.score}%)${
                          best.match?.level
                            ? ` and a ${levelStyles[best.match.level].label.toLowerCase()} for your profile`
                            : ''
                        }.`}
                    {best.match && best.match.missingSkills.length > 0 && (
                      <span>
                        {' '}
                        Just note the gaps: {best.match.missingSkills
                          .slice(0, 2)
                          .map((m) => m.skill)
                          .join(' and ')}.
                      </span>
                    )}
                  </p>

                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {selectedJobs.map((job, index) => {
                      const entry = ranked.find((item) => item.job.id === job.id)
                      const score = entry?.score
                      const isWinner = bestIds.includes(job.id)
                      return (
                        <div
                          key={job.id}
                          className={`flex items-center gap-3 rounded-xl border p-3 ${
                            isWinner
                              ? 'border-white/40 bg-white/15'
                              : 'border-white/15 bg-white/5'
                          }`}
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 font-display text-xs font-bold">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{job.title}</p>
                            <p className="truncate text-[11px] text-white/70">{job.company}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-display text-base font-bold">
                              {typeof score === 'number' ? `${score}%` : '—'}
                            </p>
                            <p className="text-[9px] uppercase tracking-wider text-white/60">
                              Match
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                    Compare these roles on your own terms
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85">
                    Match scores aren't available for every role in this selection, so CareerLens
                    can't declare a single winner yet. Review the skills, compensation, and gaps
                    above, then decide based on the trade-offs that matter most to you.
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-medium backdrop-blur">
                    <Sparkles className="size-3.5" aria-hidden />
                    Upload a resume in Match Analysis to score every role
                  </div>
                </>
              )}

              {best && (
                <div className="mt-6 flex flex-wrap items-center gap-2.5">
                  <Link to={`/match/${best.job.id}`}>
                    <Button
                      className="bg-white text-brand-700 shadow-lg hover:bg-white/90 hover:text-brand-700"
                      leftIcon={<ScanSearch className="size-4" aria-hidden />}
                    >
                      Analyze {best.job.title.split(' ').slice(0, 2).join(' ')}
                    </Button>
                  </Link>
                  <Link to={`/jobs/${best.job.id}`}>
                    <Button
                      variant="outline"
                      className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                      rightIcon={<ArrowRight className="size-4" aria-hidden />}
                    >
                      View job details
                    </Button>
                  </Link>
                  <Link to="/jobs">
                    <Button
                      variant="outline"
                      className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                      leftIcon={<Briefcase className="size-4" aria-hidden />}
                    >
                      Back to jobs
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.section>
        </div>
      )}
    </div>
  )
}