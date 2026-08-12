import { useMemo, useState } from 'react'

import { motion } from 'framer-motion'
import { ArrowRight, Banknote, Briefcase, Clock, MapPin, ScanSearch, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ScoreRing } from '@/components/landing/score-ring'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { mockStore } from '@/lib/mock-store'
import { formatSalaryRange } from '@/lib/utils'
import type { Job, MatchLevel } from '@/types'

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

function deriveExperienceLevel(job: Job): string {
  const title = job.title.toLowerCase()
  if (/staff|principal|lead/.test(title)) return 'Staff'
  if (/senior/.test(title)) return 'Senior'
  if (/junior|entry|graduate/.test(title)) return 'Junior'
  return 'Mid'
}

function JobCard({ job, index }: { job: Job; index: number }) {
  const hasScore = typeof job.matchScore === 'number'
  const level = job.matchLevel ? levelStyles[job.matchLevel] : null
  const monogram = job.company.slice(0, 1).toUpperCase()
  const visibleSkills = job.skills.slice(0, 3)
  const extraSkills = job.skills.length - visibleSkills.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: easeOut }}
      className="h-full"
    >
      <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-lg dark:hover:border-brand-500/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-blue-600 font-display text-sm font-bold text-white shadow-sm">
              {monogram}
            </span>
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

          {hasScore ? (
            <ScoreRing value={job.matchScore ?? 0} size={60} stroke={5} label="Match" />
          ) : (
            <Badge variant="neutral" dot>
              Not scored
            </Badge>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{typeLabels[job.type]}</Badge>
          <Badge variant="outline">{workModeLabels[job.workMode]}</Badge>
          <Badge variant="outline">{deriveExperienceLevel(job)}</Badge>
          {level && (
            <Badge variant={level.variant} dot>
              {level.label}
            </Badge>
          )}
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
          <span className="inline-flex items-center gap-1">
            <Banknote className="size-3" aria-hidden />
            {formatSalaryRange(job.salaryRange.min, job.salaryRange.max)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" aria-hidden />
            Posted {job.postedDaysAgo} {job.postedDaysAgo === 1 ? 'day' : 'days'} ago
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
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
      </div>
    </motion.div>
  )
}

export default function JobsPage() {
  const jobs = useMemo(() => mockStore.getJobs(), [])

  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('all')
  const [jobType, setJobType] = useState('all')
  const [level, setLevel] = useState('all')

  const locations = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.location))).sort(),
    [jobs],
  )
  const jobTypes = useMemo(() => Array.from(new Set(jobs.map((job) => job.type))).sort(), [jobs])
  const levels = useMemo(
    () => Array.from(new Set(jobs.map((job) => deriveExperienceLevel(job)))).sort(),
    [jobs],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs.filter((job) => {
      if (location !== 'all' && job.location !== location) return false
      if (jobType !== 'all' && job.type !== jobType) return false
      if (level !== 'all' && deriveExperienceLevel(job) !== level) return false
      if (!q) return true

      const haystack = [
        job.title,
        job.company,
        job.location,
        job.type,
        job.workMode,
        ...job.skills.map((skill) => skill.name),
        ...job.tags,
        job.description,
        ...job.responsibilities,
        ...job.requirements,
        ...job.preferred,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [jobs, query, location, jobType, level])

  const hasActiveFilters =
    query.trim() !== '' || location !== 'all' || jobType !== 'all' || level !== 'all'

  const clearFilters = () => {
    setQuery('')
    setLocation('all')
    setJobType('all')
    setLevel('all')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="outline">Job Discovery</Badge>
            <Badge variant="primary" dot>
              {jobs.length} live roles
            </Badge>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Discover Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Roles matched to your profile with live fit scores, searchable by title, skill, or company.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, company, skill, or keyword…"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:items-center lg:gap-2">
            <Select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              aria-label="Filter by location"
              className="lg:w-44"
            >
              <option value="all">All locations</option>
              {locations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Select
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              aria-label="Filter by job type"
              className="lg:w-40"
            >
              <option value="all">All types</option>
              {jobTypes.map((item) => (
                <option key={item} value={item}>
                  {typeLabels[item]}
                </option>
              ))}
            </Select>
            <Select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              aria-label="Filter by experience level"
              className="lg:w-40"
            >
              <option value="all">All levels</option>
              {levels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">
            Showing{' '}
            <span className="font-semibold text-foreground">{filtered.length}</span> of {jobs.length}{' '}
            roles
          </span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} leftIcon={<X className="size-3" aria-hidden />}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job, index) => (
            <JobCard key={job.id} job={job} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="No roles match your filters"
          description="Try a different search term, or clear the filters to see every open role."
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      )}
    </div>
  )
}
