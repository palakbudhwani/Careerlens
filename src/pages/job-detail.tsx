import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  ScanSearch,
  Sparkles,
  Tag,
  XCircle,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { mockStore } from '@/lib/mock-store'
import { formatSalaryRange } from '@/lib/utils'
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

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const job = id ? mockStore.getJob(id) : undefined
  const match: JobMatch | undefined = job ? mockStore.getMatchForJob(job.id) : undefined

  if (!job) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Role not found"
        description="We could not find that listing in the demo dataset. It may have been removed."
        action={
          <Link to="/jobs">
            <Button variant="outline" size="sm">
              Browse all jobs
            </Button>
          </Link>
        }
      />
    )
  }

  const hasScore = typeof job.matchScore === 'number' && Boolean(job.matchLevel)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge variant="outline">/{job.id}</Badge>
            {hasScore ? (
              <Badge variant={levelVariant[job.matchLevel as MatchLevel]} dot>
                {job.matchScore}% fit · {levelLabel[job.matchLevel as MatchLevel]}
              </Badge>
            ) : (
              <Badge variant="neutral" dot>
                Not scored
              </Badge>
            )}
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{job.title}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-3.5" aria-hidden />
              {job.company}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" aria-hidden />
              {job.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Banknote className="size-3.5" aria-hidden />
              {formatSalaryRange(job.salaryRange.min, job.salaryRange.max)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" aria-hidden />
              Posted {job.postedDaysAgo} {job.postedDaysAgo === 1 ? 'day' : 'days'} ago
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link to="/jobs">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="size-3.5" aria-hidden />}>
              Back to jobs
            </Button>
          </Link>
          <Link to={`/match/${job.id}`}>
            <Button size="sm" leftIcon={<ScanSearch className="size-3.5" aria-hidden />}>
              Analyze Match
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>About this role</CardTitle>
              <CardDescription>
                {job.company} · {job.type} · {job.workMode}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{job.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Responsibilities</CardTitle>
              <CardDescription>What the day-to-day looks like</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {job.responsibilities.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
                <CardDescription>Non-negotiable qualifications</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {job.requirements.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Preferred</CardTitle>
                <CardDescription>Nice-to-have background</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {job.preferred.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600/70 dark:text-brand-400/70" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand-600" aria-hidden />
                Match score
              </CardTitle>
              <CardDescription>How your profile compares to this role</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                {hasScore ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-4xl font-extrabold text-brand-600 dark:text-brand-400">
                        {job.matchScore}
                      </span>
                      <span className="text-sm font-medium text-muted-foreground">/ 100</span>
                    </div>
                    <Progress value={job.matchScore ?? 0} className="mt-3" />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">This role has not been scored yet.</p>
                )}
              </div>

              {match && (
                <>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Strengths
                    </p>
                    <ul className="space-y-1.5">
                      {match.strengths.slice(0, 3).map((strength) => (
                        <li key={strength} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gaps</p>
                    <ul className="space-y-1.5">
                      {match.gaps.slice(0, 3).map((gap) => (
                        <li key={gap} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                          <XCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              <div className="border-t pt-4">
                <Link to={`/match/${job.id}`} className="block">
                  <Button className="w-full" leftIcon={<ScanSearch className="size-4" aria-hidden />}>
                    Analyze Match
                  </Button>
                </Link>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Runs the full ATS & interview-prep analysis for this role
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand-600" aria-hidden />
                Skills
              </CardTitle>
              <CardDescription>Keywords this role targets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((skill) => (
                  <Badge key={skill.id} variant="primary">
                    {skill.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="size-4 text-brand-600" aria-hidden />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {job.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
