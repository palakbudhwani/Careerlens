import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  Search,
  Bookmark,
  BookmarkCheck,
  Building2,
  MapPin,
  DollarSign,
  Sparkles,
  ArrowRight,
  Filter,
  LoaderCircle,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api-client'

interface Job {
  id: string
  title: string
  company: string
  location: string
  type: string
  workMode: string
  salaryRange: { currency: string; min: number; max: number }
  postedDaysAgo: number
  description: string
  tags: string[]
  matchScore?: number
  matchLevel?: 'strong' | 'moderate' | 'weak'
  isSaved?: boolean
  isApplied?: boolean
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (modeFilter !== 'all') params.set('workMode', modeFilter)

      const data = await apiClient<Job[]>(`/jobs?${params.toString()}`)
      setJobs(data)
    } catch {
      // Fallback local jobs dataset
      setJobs([
        {
          id: 'job-001',
          title: 'Senior Frontend Engineer',
          company: 'Nimbus AI',
          location: 'New York, NY',
          type: 'full-time',
          workMode: 'hybrid',
          salaryRange: { currency: 'USD', min: 165000, max: 195000 },
          postedDaysAgo: 3,
          description: 'Build the interface layer of our AI analytics platform for 20k+ daily users.',
          tags: ['React', 'TypeScript', 'Design Systems', 'AI Products'],
          matchScore: 92,
          matchLevel: 'strong',
        },
        {
          id: 'job-002',
          title: 'Staff Frontend Engineer — ML Platform',
          company: 'Vector Labs',
          location: 'San Francisco, CA',
          type: 'full-time',
          workMode: 'remote',
          salaryRange: { currency: 'USD', min: 190000, max: 230000 },
          postedDaysAgo: 6,
          description: 'Own frontend architecture for internal ML training and evaluation platforms.',
          tags: ['Staff', 'ML Platform', 'Remote', 'TypeScript'],
          matchScore: 84,
          matchLevel: 'strong',
        },
        {
          id: 'job-003',
          title: 'AI Product Engineer',
          company: 'Lumenworks',
          location: 'Remote',
          type: 'full-time',
          workMode: 'remote',
          salaryRange: { currency: 'USD', min: 170000, max: 210000 },
          postedDaysAgo: 2,
          description: 'Prototype and ship AI-native workflow products using LLM APIs.',
          tags: ['AI Native', 'LLM', 'Small Team', 'Remote'],
          matchScore: 78,
          matchLevel: 'moderate',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [search, typeFilter, modeFilter])

  const toggleSave = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      const res = await apiClient<{ isSaved: boolean }>(`/jobs/${id}/save`, { method: 'POST' })
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, isSaved: res.isSaved } : j))
      )
    } catch {
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, isSaved: !j.isSaved } : j))
      )
    }
  }

  return (
    <div className="space-y-6 pb-12 text-left">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Discover Matched Roles</h1>
          <p className="text-sm text-muted-foreground">
            Roles tailored to your profile ranked by real-time fit analysis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <Sparkles className="size-3 text-brand-500" /> {jobs.length} roles found
          </Badge>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-card/60 backdrop-blur-md border-border/60 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by role, skill, company or tech tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-card/80 pl-9 pr-3.5 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/40 text-xs">
              <Filter className="size-3.5 text-muted-foreground ml-1.5" />
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  typeFilter === 'all' ? 'bg-brand-600 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setTypeFilter('full-time')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  typeFilter === 'full-time' ? 'bg-brand-600 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Full-time
              </button>
              <button
                onClick={() => setTypeFilter('contract')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  typeFilter === 'contract' ? 'bg-brand-600 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Contract
              </button>
            </div>

            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/40 text-xs">
              <button
                onClick={() => setModeFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  modeFilter === 'all' ? 'bg-brand-600 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Modes
              </button>
              <button
                onClick={() => setModeFilter('remote')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  modeFilter === 'remote' ? 'bg-brand-600 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Remote
              </button>
              <button
                onClick={() => setModeFilter('hybrid')}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  modeFilter === 'hybrid' ? 'bg-brand-600 text-white shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Hybrid
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Jobs List */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <LoaderCircle className="size-6 animate-spin text-brand-500" />
        </div>
      ) : jobs.length === 0 ? (
        <Card className="p-12 text-center">
          <Briefcase className="mx-auto size-10 text-muted-foreground/60 mb-2" />
          <h3 className="text-base font-bold text-foreground">No roles match your search filters</h3>
          <p className="text-xs text-muted-foreground mt-1">Try clearing search terms or modifying job mode filters.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <Link key={job.id} to={`/jobs/${job.id}`} className="block group">
              <Card className="p-5 transition-all hover:border-brand-500/50 hover:shadow-lg bg-card/80 backdrop-blur-md border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-lg font-bold text-foreground group-hover:text-brand-500 transition">
                        {job.title}
                      </h3>
                      {job.matchScore && (
                        <Badge
                          variant={job.matchLevel === 'strong' ? 'success' : job.matchLevel === 'moderate' ? 'warning' : 'outline'}
                          className="font-bold text-xs"
                        >
                          {job.matchScore}% Match
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                      <span className="flex items-center gap-1">
                        <Building2 className="size-3.5 text-brand-400" /> {job.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5 text-brand-400" /> {job.location} ({job.workMode})
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-emerald-400">
                        <DollarSign className="size-3.5" /> ${(job.salaryRange.min / 1000).toFixed(0)}k - ${(job.salaryRange.max / 1000).toFixed(0)}k
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 pt-1">{job.description}</p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-2">
                      {job.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/40">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => toggleSave(e, job.id)}
                      className="text-muted-foreground hover:text-brand-500"
                    >
                      {job.isSaved ? (
                        <BookmarkCheck className="size-5 text-brand-500 fill-brand-500/20" />
                      ) : (
                        <Bookmark className="size-5" />
                      )}
                    </Button>

                    <Button size="sm" className="text-xs gap-1 bg-brand-600 hover:bg-brand-500">
                      View Match <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}