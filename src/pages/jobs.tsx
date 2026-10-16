import { useDeferredValue, useMemo, useRef, useState } from 'react'

import {
  ArrowRight,
  Bookmark,
  Briefcase,
  GitCompare,
  MapPin,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { CareerFit } from '@/components/jobs/career-fit'
import { FeaturedJobCard } from '@/components/jobs/featured-job-card'
import { JobCard } from '@/components/jobs/job-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { candidateFromStoredResume } from '@/lib/effective-candidate'
import { useCompareSelection } from '@/lib/compare-store'
import { deriveExperienceLevel, formatJobType } from '@/lib/job-utils'
import { mockStore } from '@/lib/mock-store'
import { deriveJobMatches } from '@/lib/resume-analysis'
import { useStoredResume } from '@/lib/resume-store'
import { toggleSavedJob, useSavedJobs } from '@/lib/saved-jobs-store'
import type { Job, JobMatch } from '@/types'

const workModeLabels: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

interface ActiveFilter {
  key: string
  label: string
  onRemove: () => void
}

export default function JobsPage() {
  const jobs = useMemo(() => mockStore.getJobs(), [])

  const [query, setQuery] = useState('')
  const [locationQuery, setLocationQuery] = useState('')
  const [location, setLocation] = useState('all')
  const [jobType, setJobType] = useState('all')
  const [category, setCategory] = useState('all')
  const [level, setLevel] = useState('all')
  const [workMode, setWorkMode] = useState('all')
  const [sort, setSort] = useState('newest')
  const [savedOnly, setSavedOnly] = useState(false)

  const resultsRef = useRef<HTMLDivElement>(null)

  const savedIds = useSavedJobs()
  const { ids: compareIds, toggle: toggleCompare, remaining: compareRemaining } =
    useCompareSelection()

  const resume = useStoredResume()
  const deferredResume = useDeferredValue(resume)

  // Career Fit scoring: deterministic, derived only from the uploaded resume.
  const fitMatches = useMemo(() => {
    if (!deferredResume) return null
    const candidate = candidateFromStoredResume(deferredResume)
    return deriveJobMatches(deferredResume, candidate, jobs).sort((a, b) => b.score - a.score)
  }, [deferredResume, jobs])

  const fitById = useMemo(() => {
    if (!fitMatches) return null
    const map: Record<string, JobMatch> = {}
    for (const match of fitMatches) map[match.jobId] = match
    return map
  }, [fitMatches])

  const fitPending = Boolean(resume) && resume !== deferredResume

  const locations = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.location))).sort(),
    [jobs],
  )
  const jobTypes = useMemo(() => Array.from(new Set(jobs.map((job) => job.type))).sort(), [jobs])
  const categories = useMemo(
    () => Array.from(new Set(jobs.map((job) => job.domain))).sort(),
    [jobs],
  )
  const levels = useMemo(
    () => Array.from(new Set(jobs.map((job) => deriveExperienceLevel(job)))).sort(),
    [jobs],
  )
  const workModes = useMemo(
    () =>
      Array.from(new Set(jobs.map((job) => job.workMode).filter(Boolean))).sort() as Array<
        NonNullable<Job['workMode']>
      >,
    [jobs],
  )

  const employerCount = useMemo(() => new Set(jobs.map((job) => job.company)).size, [jobs])
  const domainCount = useMemo(() => new Set(jobs.map((job) => job.domain)).size, [jobs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const loc = locationQuery.trim().toLowerCase()
    return jobs.filter((job) => {
      if (location !== 'all' && job.location !== location) return false
      if (jobType !== 'all' && job.type !== jobType) return false
      if (category !== 'all' && job.domain !== category) return false
      if (level !== 'all' && deriveExperienceLevel(job) !== level) return false
      if (workMode !== 'all' && job.workMode !== workMode) return false
      if (loc && !job.location.toLowerCase().includes(loc)) return false
      if (savedOnly && !savedIds.includes(job.id)) return false
      if (!q) return true

      const haystack = [
        job.title,
        job.company,
        job.location,
        job.type,
        job.domain,
        job.experience,
        job.source,
        job.workMode,
        ...job.skills.map((skill) => skill.name),
        ...job.tags,
        job.description,
        ...(job.responsibilities ?? []),
        ...job.requirements,
        ...(job.preferred ?? []),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [jobs, query, location, jobType, category, level, workMode, locationQuery, savedOnly, savedIds])

  const sorted = useMemo(() => {
    const list = [...filtered]
    const posted = (job: Job) => job.postedDaysAgo
    const unknownLast = (a: Job, b: Job): number | null => {
      const pa = posted(a)
      const pb = posted(b)
      if (pa === undefined && pb === undefined) return 0
      if (pa === undefined) return 1
      if (pb === undefined) return -1
      return null
    }
    if (sort === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sort === 'company') {
      list.sort((a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title))
    } else {
      const direction = sort === 'oldest' ? -1 : 1
      list.sort((a, b) => {
        const tie = unknownLast(a, b)
        if (tie !== null) return tie
        return direction * ((posted(a) ?? 0) - (posted(b) ?? 0))
      })
    }
    return list
  }, [filtered, sort])

  // Rule-based featured pick: the most recent posting among visible results
  // (unknown posting dates last, then alphabetical for a stable result).
  const featured = useMemo(() => {
    if (sorted.length === 0) return null
    const known = sorted.filter((job) => job.postedDaysAgo !== undefined)
    const pool = known.length > 0 ? known : [...sorted]
    return [...pool].sort((a, b) => {
      const da = a.postedDaysAgo ?? Number.MAX_SAFE_INTEGER
      const db = b.postedDaysAgo ?? Number.MAX_SAFE_INTEGER
      return da - db || a.title.localeCompare(b.title)
    })[0]
  }, [sorted])

  const featuredReason =
    featured && featured.postedDaysAgo !== undefined
      ? `Featured: most recently posted (${featured.postedDaysAgo} ${
          featured.postedDaysAgo === 1 ? 'day' : 'days'
          } ago)`
      : 'Featured: top of your current results (posting date not disclosed)'

  const activeFilters: ActiveFilter[] = []
  if (query.trim()) {
    activeFilters.push({ key: 'query', label: `“${query.trim()}”`, onRemove: () => setQuery('') })
  }
  if (locationQuery.trim()) {
    activeFilters.push({
      key: 'location-query',
      label: `Near ${locationQuery.trim()}`,
      onRemove: () => setLocationQuery(''),
    })
  }
  if (location !== 'all') {
    activeFilters.push({ key: 'location', label: location, onRemove: () => setLocation('all') })
  }
  if (jobType !== 'all') {
    activeFilters.push({
      key: 'type',
      label: formatJobType(jobType as Job['type']),
      onRemove: () => setJobType('all'),
    })
  }
  if (category !== 'all') {
    activeFilters.push({ key: 'category', label: category, onRemove: () => setCategory('all') })
  }
  if (level !== 'all') {
    activeFilters.push({ key: 'level', label: level, onRemove: () => setLevel('all') })
  }
  if (workMode !== 'all') {
    activeFilters.push({
      key: 'work-mode',
      label: workModeLabels[workMode] ?? workMode,
      onRemove: () => setWorkMode('all'),
    })
  }
  if (savedOnly) {
    activeFilters.push({ key: 'saved', label: 'Saved only', onRemove: () => setSavedOnly(false) })
  }

  const clearFilters = () => {
    setQuery('')
    setLocationQuery('')
    setLocation('all')
    setJobType('all')
    setCategory('all')
    setLevel('all')
    setWorkMode('all')
    setSavedOnly(false)
  }

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const compareFull = compareRemaining <= 0

  return (
    <div className="space-y-6">
      {/* ── A. Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-brand-50 via-card to-blue-50/50 p-6 shadow-card sm:p-8 dark:from-brand-950/50 dark:to-blue-950/40">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 left-10 size-64 rounded-full bg-blue-500/10 blur-3xl"
        />

        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary" dot>
              Job Command Center
            </Badge>
            <Badge variant="outline">{employerCount} employers</Badge>
            <Badge variant="outline">{domainCount} domains</Badge>
          </div>

          <h1 className="mt-4 max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Don’t just find a job.{' '}
            <span className="text-brand-600 dark:text-brand-400">Find your fit.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Real technology roles for students, freshers, and early-career engineers — every
            listing sourced from the employer’s own careers page and clearly labelled.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span>
              <span className="font-display text-base font-bold text-foreground">
                {jobs.length} job listings
              </span>
            </span>
            <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
            <span>
              <span className="font-display text-base font-bold text-foreground">
                {employerCount} employers
              </span>
            </span>
            <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
            <span>
              <span className="font-display text-base font-bold text-foreground">
                {domainCount} domains
              </span>
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-card/90 p-4 shadow-card lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by role, skill, or company…"
                aria-label="Search jobs from the hero"
                className="pl-9"
              />
            </div>
            <div className="relative flex-1 lg:max-w-56">
              <MapPin
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Location (city or state)…"
                aria-label="Search jobs by location from the hero"
                className="pl-9"
              />
            </div>
            <Button onClick={scrollToResults} rightIcon={<ArrowRight className="size-4" aria-hidden />}>
              Search jobs
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Search and filters update the full board below instantly.
          </p>
        </div>
      </section>

      {/* ── B. Resume-aware Career Fit ──────────────────────────── */}
      <CareerFit hasResume={Boolean(resume)} matches={fitMatches} pending={fitPending} />

      {/* ── C. Discovery toolbar ────────────────────────────────── */}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:items-center lg:gap-2">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
              className="lg:w-44"
            >
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
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
                  {formatJobType(item)}
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
            <Select
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value)}
              aria-label="Filter by work mode"
              className="lg:w-40"
            >
              <option value="all">All work modes</option>
              {workModes.map((item) => (
                <option key={item} value={item}>
                  {workModeLabels[item] ?? item}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort jobs"
              className="lg:w-40"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
              <option value="company">Company A–Z</option>
            </Select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">
            Showing{' '}
            <span className="font-semibold text-foreground">{filtered.length}</span> of {jobs.length}{' '}
            roles
          </span>
          {activeFilters.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground" aria-hidden>
                ·
              </span>
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={filter.onRemove}
                  aria-label={`Remove ${filter.label} filter`}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
                >
                  {filter.label}
                  <X className="size-3" aria-hidden />
                </button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                leftIcon={<X className="size-3" aria-hidden />}
              >
                Clear filters
              </Button>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            variant={savedOnly ? 'secondary' : 'outline'}
            aria-pressed={savedOnly}
            onClick={() => setSavedOnly((value) => !value)}
            leftIcon={<Bookmark className="size-3.5" aria-hidden />}
          >
            Saved only{savedIds.length > 0 ? ` (${savedIds.length})` : ''}
          </Button>
          <Link to="/compare">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<GitCompare className="size-3.5" aria-hidden />}
            >
              Compare ({compareIds.length}/3)
            </Button>
          </Link>
          <Link to="/match">
            <Button size="sm" variant="ghost" rightIcon={<ArrowRight className="size-3.5" aria-hidden />}>
              Match Analysis
            </Button>
          </Link>
        </div>
      </Card>

      {/* ── D. Featured listing + premium card grid ─────────────── */}
      <section ref={resultsRef} id="job-results" className="space-y-4 scroll-mt-6">
        {sorted.length > 0 && featured && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-4 text-brand-600 dark:text-brand-400" aria-hidden />
              <h2
                id="featured-heading"
                className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Featured listing
              </h2>
              <span className="text-xs text-muted-foreground">— {featuredReason}</span>
            </div>
            <FeaturedJobCard
              job={featured}
              reason={featuredReason}
              fit={fitById?.[featured.id]}
              saved={savedIds.includes(featured.id)}
              compared={compareIds.includes(featured.id)}
              compareFull={compareFull}
              onToggleSave={() => toggleSavedJob(featured.id)}
              onToggleCompare={() => toggleCompare(featured.id)}
            />
          </div>
        )}

        {sorted.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((job, index) => (
              <JobCard
                key={job.id}
                job={job}
                index={index}
                fit={fitById?.[job.id]}
                saved={savedIds.includes(job.id)}
                compared={compareIds.includes(job.id)}
                compareFull={compareFull}
                onToggleSave={() => toggleSavedJob(job.id)}
                onToggleCompare={() => toggleCompare(job.id)}
              />
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
      </section>
    </div>
  )
}
