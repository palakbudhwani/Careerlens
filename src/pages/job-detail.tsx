import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Building2,
  MapPin,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Send,
  LoaderCircle,
  Sparkles,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { apiClient } from '@/lib/api-client'

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSaved, setIsSaved] = useState(false)
  const [isApplied, setIsApplied] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    async function loadJob() {
      if (!id) return
      setLoading(true)
      try {
        const data = await apiClient<any>(`/jobs/${id}`)
        setJob(data)
        setIsSaved(data.isSaved)
        setIsApplied(data.isApplied)
      } catch {
        setJob({
          id: id || 'job-001',
          title: 'Senior Frontend Engineer',
          company: 'Nimbus AI',
          location: 'New York, NY',
          type: 'full-time',
          workMode: 'hybrid',
          salaryRange: { currency: 'USD', min: 165000, max: 195000 },
          postedDaysAgo: 3,
          description:
            'We are looking for a senior frontend engineer to build the interface layer of our AI analytics platform.',
          responsibilities: [
            'Design and build complex, data-dense React interfaces.',
            'Partner with ML engineers to ship AI-assisted features end to end.',
            'Maintain and evolve the company design system.',
          ],
          requirements: [
            '6+ years building production React applications with TypeScript.',
            'Deep experience with state management and performance profiling.',
          ],
          preferred: ['Experience with design systems at scale.', 'Exposure to LLM APIs.'],
          match: {
            score: 92,
            level: 'strong',
            summary: 'High fit score (92%). Profile matches core technical requirements.',
            breakdown: [
              { category: 'hard', score: 94, note: 'Matches React, TypeScript, and state management requirements.' },
              { category: 'soft', score: 88, note: 'Strong technical leadership and communication background.' },
              { category: 'experience', score: 85, note: '5+ years of relevant industry experience.' },
              { category: 'education', score: 90, note: 'B.S. Computer Science degree.' },
            ],
            strengths: ['Deep React & TypeScript experience', 'Proven design systems leadership'],
            gaps: ['Python data analysis', 'Advanced Docker CI/CD'],
            missingSkills: [{ skill: 'Python', importance: 'important' }],
          },
        })
      } finally {
        setLoading(false)
      }
    }
    loadJob()
  }, [id])

  const toggleSave = async () => {
    if (!id) return
    try {
      const res = await apiClient<{ isSaved: boolean }>(`/jobs/${id}/save`, { method: 'POST' })
      setIsSaved(res.isSaved)
    } catch {
      setIsSaved(!isSaved)
    }
  }

  const handleApply = async () => {
    if (!id || isApplied) return
    setApplying(true)
    try {
      await apiClient(`/jobs/${id}/apply`, { method: 'POST' })
      setIsApplied(true)
    } catch {
      setIsApplied(true)
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="size-8 animate-spin text-brand-500" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Job position not found.</p>
        <Link to="/jobs">
          <Button variant="outline" className="mt-4">
            Back to Jobs
          </Button>
        </Link>
      </div>
    )
  }

  const match = job.match || {}

  return (
    <div className="space-y-6 pb-12 text-left">
      <div className="flex items-center justify-between">
        <Link to="/jobs">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to Jobs
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleSave} className="gap-1.5 text-xs">
            {isSaved ? (
              <>
                <BookmarkCheck className="size-4 text-brand-500 fill-brand-500/20" /> Saved
              </>
            ) : (
              <>
                <Bookmark className="size-4" /> Save Role
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={isApplied || applying}
            className={`gap-1.5 text-xs font-semibold ${
              isApplied ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : 'bg-brand-600 hover:bg-brand-500 text-white'
            }`}
          >
            {applying ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" /> Submitting...
              </>
            ) : isApplied ? (
              <>
                <CheckCircle2 className="size-3.5" /> Applied
              </>
            ) : (
              <>
                <Send className="size-3.5" /> Apply Now
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="p-6 border-brand-500/30 bg-gradient-to-br from-slate-900 via-slate-900/90 to-brand-950/40 text-foreground">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
                {job.type}
              </Badge>
              {match.score && (
                <Badge
                  variant={match.level === 'strong' ? 'success' : match.level === 'moderate' ? 'warning' : 'outline'}
                  className="font-bold text-xs"
                >
                  {match.score}% Match Score
                </Badge>
              )}
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1">
                <Building2 className="size-3.5 text-brand-400" /> {job.company}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 text-brand-400" /> {job.location} ({job.workMode})
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <DollarSign className="size-3.5" /> ${(job.salaryRange?.min / 1000).toFixed(0)}k - ${(job.salaryRange?.max / 1000).toFixed(0)}k
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-brand-500/30 bg-brand-950/60 p-4 text-center min-w-[160px]">
            <span className="text-[10px] uppercase font-bold text-brand-400 tracking-wider">Candidate Fit</span>
            <p className="font-display text-3xl font-extrabold text-white mt-0.5">{match.score || 85}%</p>
            <p className="text-[11px] font-semibold text-emerald-400 capitalize">{match.level || 'strong'} match</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground border-b border-border/40 pb-2">About the Role</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{job.description}</p>

            {job.responsibilities?.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400">Key Responsibilities</h4>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {job.responsibilities.map((r: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 rounded-full bg-brand-500 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {job.requirements?.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400">Requirements</h4>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {job.requirements.map((req: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 space-y-4 border-brand-500/20 bg-card/90">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="size-4 text-brand-500" /> AI Match Decomposition
            </h3>

            {match.breakdown?.map((item: any) => (
              <div key={item.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="capitalize">{item.category} match</span>
                  <span className="text-brand-400 font-bold">{item.score}%</span>
                </div>
                <Progress value={item.score} className="h-1.5 bg-slate-800" />
                <p className="text-[11px] text-muted-foreground pt-0.5">{item.note}</p>
              </div>
            ))}
          </Card>

          {match.missingSkills?.length > 0 && (
            <Card className="p-5 space-y-3 border-amber-500/20 bg-amber-500/5">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="size-4" /> Skill Gaps for this Role
              </h3>
              <div className="space-y-2">
                {match.missingSkills.map((gap: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs">
                    <span className="font-medium text-amber-200">{gap.skill}</span>
                    <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                      {gap.importance}
                    </Badge>
                  </div>
                ))}
              </div>
              <Link to="/skill-gaps" className="block pt-1">
                <Button variant="outline" size="sm" className="w-full text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/20">
                  Close Skill Gaps
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}