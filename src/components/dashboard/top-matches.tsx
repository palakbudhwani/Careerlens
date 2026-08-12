import { motion } from 'framer-motion'
import { ArrowRight, Briefcase, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ScoreRing } from '@/components/landing/score-ring'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DashboardSectionHeader } from '@/components/dashboard/section-header'
import type { DashboardData, MatchWithJob } from '@/components/dashboard/dashboard-data'
import type { MatchLevel } from '@/types'

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1]

const levelStyles: Record<
  MatchLevel,
  { variant: 'success' | 'warning' | 'destructive'; label: string }
> = {
  strong: { variant: 'success', label: 'Strong fit' },
  moderate: { variant: 'warning', label: 'Moderate fit' },
  weak: { variant: 'destructive', label: 'Weak fit' },
}

function JobMatchCard({ match, job }: MatchWithJob) {
  const level = levelStyles[match.level]
  const monogram = (job?.company ?? '?').slice(0, 1).toUpperCase()

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-lg sm:flex-row sm:items-center dark:hover:border-brand-500/30">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-blue-600 font-display text-sm font-bold text-white shadow-sm">
            {monogram}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold tracking-tight text-foreground">
              {job?.title ?? match.jobId}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{job?.company}</span>
              {job && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" aria-hidden />
                  {job.location}
                </span>
              )}
            </p>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {match.summary}
        </p>

        {match.missingSkills.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Missing:</span>
            {match.missingSkills.slice(0, 2).map((missing) => (
              <Badge key={missing.skill} variant="outline" className="text-[11px]">
                {missing.skill}
              </Badge>
            ))}
            {match.missingSkills.length > 2 && (
              <span className="text-[11px] text-muted-foreground">
                +{match.missingSkills.length - 2} more
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link to={`/match/${match.jobId}`}>
            <Button size="sm" rightIcon={<ArrowRight className="size-3.5" aria-hidden />}>
              Analyze match
            </Button>
          </Link>
          <Link to={`/jobs/${match.jobId}`}>
            <Button size="sm" variant="ghost">
              View job
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:items-end">
        <ScoreRing value={match.score} size={64} stroke={6} label="Match" />
        <Badge variant={level.variant} dot>
          {level.label}
        </Badge>
      </div>
    </div>
  )
}

export function TopMatches({ data }: { data: DashboardData }) {
  return (
    <div>
      <DashboardSectionHeader
        icon={Briefcase}
        eyebrow="Live fit scores"
        title="Top job matches"
        description="The roles you fit best right now"
        viewAllTo="/jobs"
        viewAllLabel="Explore jobs"
      />
      <div className="space-y-3">
        {data.topMatches.map((item, index) => (
          <motion.div
            key={item.match.id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.45, delay: index * 0.08, ease: easeOut }}
          >
            <JobMatchCard match={item.match} job={item.job} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
