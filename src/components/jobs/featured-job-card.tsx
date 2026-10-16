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
  Sparkles,
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

export interface FeaturedJobCardProps {
  job: Job
  reason: string
  fit?: JobMatch
  saved: boolean
  compared: boolean
  compareFull: boolean
  onToggleSave: () => void
  onToggleCompare: () => void
}

/**
 * The premium hero listing above the grid. The pick is rule-based and stated
 * on the card (most recent posting among the current results) — nothing about
 * it is sponsored or fabricated.
 */
export function FeaturedJobCard({
  job,
  reason,
  fit,
  saved,
  compared,
  compareFull,
  onToggleSave,
  onToggleCompare,
}: FeaturedJobCardProps) {
  const workMode = formatWorkMode(job)
  const compareDisabled = compareFull && !compared
  const visibleSkills = job.skills.slice(0, 5)
  const extraSkills = job.skills.length - visibleSkills.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOut }}
      data-testid="featured-job"
      data-job-id={job.id}
      className="relative overflow-hidden rounded-2xl border border-brand-200 bg-card shadow-card-lg dark:border-brand-500/30"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-blue-500/5"
      />

      <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row">
        <div className="flex min-w-0 flex-1 gap-4">
          <CompanyLogo company={job.company} size="lg" />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary" className="gap-1">
                <Sparkles className="size-3" aria-hidden />
                Featured
              </Badge>
              <Badge variant="outline">{job.domain}</Badge>
              {fit && (
                <Badge variant={fitVariant[fit.level]} dot>
                  {fit.score}% fit for you
                </Badge>
              )}
            </div>

            <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-foreground">
              {job.title}
            </h3>

            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <MapPin className="size-3.5" aria-hidden />
                {job.company} · {job.location}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="size-3.5" aria-hidden />
                {formatJobType(job.type)}
                {workMode ? ` · ${workMode}` : ''}
              </span>
              <span className="inline-flex items-center gap-1.5">{deriveExperienceLevel(job)}</span>
              {job.salaryRange && (
                <span className="inline-flex items-center gap-1.5">
                  <Banknote className="size-3.5" aria-hidden />
                  {formatSalaryRange(
                    job.salaryRange.min,
                    job.salaryRange.max,
                    job.salaryRange.currency,
                  )}
                </span>
              )}
              {typeof job.postedDaysAgo === 'number' && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" aria-hidden />
                  Posted {job.postedDaysAgo} {job.postedDaysAgo === 1 ? 'day' : 'days'} ago
                </span>
              )}
            </p>

            <p className="mt-3 line-clamp-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {job.description}
            </p>

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

            <p className="mt-3 text-[11px] text-muted-foreground">
              {reason} · Listing source:{' '}
              <span className="font-medium text-foreground">
                {job.source ?? 'Original employer listing'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 lg:w-56 lg:border-l lg:border-border lg:pl-5">
          <Link to={`/jobs/${job.id}`} className="w-full">
            <Button className="w-full" rightIcon={<ArrowRight className="size-4" aria-hidden />}>
              View full listing
            </Button>
          </Link>
          <Link to={`/match/${job.id}`} className="w-full">
            <Button
              variant="outline"
              className="w-full"
              leftIcon={<ScanSearch className="size-4" aria-hidden />}
            >
              Run match analysis
            </Button>
          </Link>
          <a
            href={job.redirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
            data-testid="apply-link-featured"
          >
            <Button
              variant="outline"
              className="w-full"
              leftIcon={<ExternalLink className="size-4" aria-hidden />}
            >
              Apply now
            </Button>
          </a>

          <div className="mt-1 flex gap-2">
            <Button
              size="sm"
              variant={saved ? 'secondary' : 'outline'}
              className="flex-1"
              aria-pressed={saved}
              aria-label={saved ? `Remove ${job.title} from saved jobs (featured)` : `Save ${job.title} (featured)`}
              data-testid="save-job-featured"
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
              variant={compared ? 'secondary' : 'outline'}
              className="flex-1"
              aria-pressed={compared}
              disabled={compareDisabled}
              aria-label={`Compare ${job.title} (featured)`}
              data-testid="compare-job-featured"
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
