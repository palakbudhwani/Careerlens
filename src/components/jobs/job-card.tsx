import { motion } from 'framer-motion'
import {
  ArrowRight,
  Banknote,
  Bookmark,
  Clock,
  ExternalLink,
  GitCompare,
  GraduationCap,
  MapPin,
  ScanSearch,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { CompanyLogo } from '@/components/jobs/company-logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deriveExperienceLevel, formatJobType, formatWorkMode } from '@/lib/job-utils'
import { formatSalaryRange } from '@/lib/utils'
import type { Job, JobMatch, MatchLevel } from '@/types'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const fitVariant: Record<MatchLevel, 'success' | 'warning' | 'destructive'> = {
  strong: 'success',
  moderate: 'warning',
  weak: 'destructive',
}

export interface JobCardProps {
  job: Job
  index: number
  fit?: JobMatch
  saved: boolean
  compared: boolean
  compareFull: boolean
  onToggleSave: () => void
  onToggleCompare: () => void
}

export function JobCard({
  job,
  index,
  fit,
  saved,
  compared,
  compareFull,
  onToggleSave,
  onToggleCompare,
}: JobCardProps) {
  const visibleSkills = job.skills.slice(0, 3)
  const extraSkills = job.skills.length - visibleSkills.length
  const workMode = formatWorkMode(job)
  const compareDisabled = compareFull && !compared

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: Math.min(index, 6) * 0.05, ease: easeOut }}
      className="h-full"
      data-testid="job-card"
      data-job-id={job.id}
    >
      <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-lg dark:hover:border-brand-500/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <CompanyLogo company={job.company} size="md" />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold tracking-tight text-foreground">
                {job.title}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{job.company}</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" aria-hidden />
                  {job.location}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Badge variant="outline">{job.domain}</Badge>
            {fit && (
              <Badge variant={fitVariant[fit.level]} dot>
                {fit.score}% fit
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{formatJobType(job.type)}</Badge>
          {workMode && <Badge variant="outline">{workMode}</Badge>}
          <Badge variant="outline">{deriveExperienceLevel(job)}</Badge>
        </div>

        <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {job.description}
        </p>

        {job.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {visibleSkills.map((skill) => (
              <Badge key={skill.id} variant="primary" className="text-[11px]">
                {skill.name}
              </Badge>
            ))}
            {extraSkills > 0 && (
              <span className="text-[11px] text-muted-foreground">+{extraSkills} more</span>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {job.experience && (
            <span className="inline-flex items-center gap-1">
              <GraduationCap className="size-3" aria-hidden />
              {job.experience}
            </span>
          )}
          {job.salaryRange && (
            <span className="inline-flex items-center gap-1">
              <Banknote className="size-3" aria-hidden />
              {formatSalaryRange(job.salaryRange.min, job.salaryRange.max, job.salaryRange.currency)}
            </span>
          )}
          {typeof job.postedDaysAgo === 'number' && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              Posted {job.postedDaysAgo} {job.postedDaysAgo === 1 ? 'day' : 'days'} ago
            </span>
          )}
        </div>

        <div className="mt-auto pt-4">
          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Link to={`/match/${job.id}`} className="flex-1">
              <Button
                size="sm"
                className="w-full"
                leftIcon={<ScanSearch className="size-3.5" aria-hidden />}
              >
                Analyze Match
              </Button>
            </Link>
            <Link to={`/jobs/${job.id}`}>
              <Button size="sm" variant="ghost" rightIcon={<ArrowRight className="size-3.5" aria-hidden />}>
                View details
              </Button>
            </Link>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <a
              href={job.redirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
              data-testid="apply-link"
            >
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                leftIcon={<ExternalLink className="size-3.5" aria-hidden />}
              >
                Apply
              </Button>
            </a>
            <Button
              size="sm"
              variant={saved ? 'secondary' : 'ghost'}
              aria-pressed={saved}
              aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}
              data-testid="save-job"
              onClick={onToggleSave}
              leftIcon={
                <Bookmark
                  className={`size-3.5 ${saved ? 'fill-current text-brand-600 dark:text-brand-400' : ''}`}
                  aria-hidden
                />
              }
            >
              {saved ? 'Saved' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant={compared ? 'secondary' : 'ghost'}
              aria-pressed={compared}
              disabled={compareDisabled}
              aria-label={`Compare ${job.title}`}
              data-testid="compare-job"
              onClick={onToggleCompare}
              title={compareDisabled ? 'Comparison is limited to 3 jobs' : undefined}
              leftIcon={<GitCompare className="size-3.5" aria-hidden />}
            >
              {compared ? 'Added' : 'Compare'}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
