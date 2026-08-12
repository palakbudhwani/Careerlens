import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  AlertCircle,
  Briefcase,
  BookOpen,
  ArrowRight,
  Sparkles,
  Search,
  ShieldCheck,
  Zap,
  Lock,
  Layers,
  LoaderCircle,
  Award
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/context/auth-context'

interface DashboardData {
  candidate: {
    id: string
    name: string
    initials: string
    title: string
    targetRole: string
    email: string
  }
  metrics: {
    careerReadiness: number
    careerReadinessGrowth: string
    profileStrength: number
    profileStrengthGrowth: string
    jobCompatibility: number
    jobCompatibilityGrowth: string
  }
  counts: {
    savedJobs: number
    appliedJobs: number
    activeSkillGaps: number
    completedCourses: number
  }
  recommendedRoles: Array<{
    id: string
    title: string
    company: string
    matchScore: number
    matchLevel: string
  }>
  skillIntelligence: Array<{
    name: string
    category: string
    proficiency: number
    status: string
  }>
  nextSkillCard: {
    skill: string
    description: string
    courseId: string
    courseTitle: string
  }
  recentMatches: Array<{
    id: string
    title: string
    company: string
    matchScore: number
  }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await apiClient<DashboardData>('/dashboard/stats')
        setData(res)
      } catch (err) {
        console.error('Failed to load dashboard stats:', err)
        setData({
          candidate: {
            id: 'cand-001',
            name: user?.name || 'Priya',
            initials: 'P',
            title: 'Senior Engineer',
            targetRole: 'Senior Frontend Engineer (AI Products)',
            email: 'priya@example.com',
          },
          metrics: {
            careerReadiness: 84,
            careerReadinessGrowth: '↑ 2.4%',
            profileStrength: 91,
            profileStrengthGrowth: '↑ 2.4%',
            jobCompatibility: 92,
            jobCompatibilityGrowth: '↑ 2.4%',
          },
          counts: { savedJobs: 4, appliedJobs: 2, activeSkillGaps: 3, completedCourses: 1 },
          recommendedRoles: [
            { id: 'job-001', title: 'Machine Learning Engineer', company: 'Nimbus AI', matchScore: 92, matchLevel: 'strong' },
            { id: 'job-002', title: 'Data Scientist', company: 'Vector Labs', matchScore: 88, matchLevel: 'strong' },
            { id: 'job-003', title: 'AI Engineer', company: 'Lumenworks', matchScore: 86, matchLevel: 'strong' },
          ],
          skillIntelligence: [
            { name: 'Python', category: 'technical', proficiency: 5, status: 'mastered' },
            { name: 'Machine Learning', category: 'technical', proficiency: 4, status: 'mastered' },
            { name: 'SQL', category: 'technical', proficiency: 4, status: 'mastered' },
            { name: 'TensorFlow', category: 'technical', proficiency: 4, status: 'mastered' },
            { name: 'AWS', category: 'tool', proficiency: 3, status: 'developing' },
            { name: 'Docker', category: 'tool', proficiency: 3, status: 'developing' },
          ],
          nextSkillCard: {
            skill: 'AWS + Docker',
            description: 'Deploy your model to the cloud',
            courseId: 'crs-003',
            courseTitle: 'Docker & CI/CD Pipelines for Modern Web Apps',
          },
          recentMatches: [
            { id: 'job-001', title: 'Machine Learning Engineer', company: 'Nimbus AI', matchScore: 92 },
          ],
        })
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [user])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <LoaderCircle className="size-8 animate-spin text-brand-500" />
        <p className="text-sm text-muted-foreground font-medium">Loading your career analytics dashboard...</p>
      </div>
    )
  }

  const candidateName = data?.candidate.name || user?.name || 'Priya'
  const firstName = candidateName.split(' ')[0]

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/60 px-5 py-3.5 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
            <ShieldCheck className="size-4" /> Private by design
          </span>
          <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
            <Zap className="size-4" /> Instant analysis
          </span>
          <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
            <Lock className="size-4" /> Secure backend API
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/resume">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Sparkles className="size-3.5 text-brand-500" /> Re-scan Resume
            </Button>
          </Link>
          <Link to="/jobs">
            <Button size="sm" className="gap-1.5 text-xs bg-brand-600 hover:bg-brand-500">
              Open Jobs <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-950/80 p-6 md:p-8 text-foreground shadow-2xl backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-20 -top-20 size-96 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 size-96 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6 mb-6">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand-400 uppercase">Good afternoon, {firstName}</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-white">Career analysis</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative min-w-[240px] md:min-w-[280px]">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                readOnly
                value="career.ai/app/analysis"
                className="w-full rounded-lg border border-border/60 bg-slate-900/80 pl-9 pr-3 py-2 text-xs font-mono text-muted-foreground focus:outline-none"
              />
            </div>
            <div className="hidden lg:flex items-center gap-3 rounded-xl border border-brand-500/40 bg-brand-950/50 p-2.5 pr-4 shadow-lg backdrop-blur-md">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-600 font-display text-xs font-bold text-white shadow">
                92%
              </div>
              <div className="text-left">
                <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Best match</p>
                <p className="text-xs font-bold text-white">Machine Learning Engineer</p>
                <span className="inline-block text-[10px] text-emerald-400 font-semibold">Strong fit</span>
              </div>
              <Link to="/match/job-001" className="ml-2">
                <Button size="sm" className="h-7 text-[11px] bg-brand-600 hover:bg-brand-500 text-white rounded-md px-2.5">
                  Ready to improve
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border/60 bg-slate-900/60 p-5 shadow-inner backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <span>Career Readiness</span>
              <Badge variant="success" className="text-[11px] font-bold px-2 py-0.5">
                {data?.metrics.careerReadinessGrowth}
              </Badge>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-4xl font-extrabold text-white">{data?.metrics.careerReadiness}</span>
              <span className="text-lg text-muted-foreground font-semibold">/100</span>
            </div>
            <Progress value={data?.metrics.careerReadiness || 0} className="mt-3.5 h-2 bg-slate-800" />
          </Card>

          <Card className="border-border/60 bg-slate-900/60 p-5 shadow-inner backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <span>Profile Strength</span>
              <Badge variant="success" className="text-[11px] font-bold px-2 py-0.5">
                {data?.metrics.profileStrengthGrowth}
              </Badge>
            </div>
            <div className="mt-3">
              <span className="font-display text-4xl font-extrabold text-white">{data?.metrics.profileStrength}%</span>
            </div>
            <Progress value={data?.metrics.profileStrength || 0} className="mt-3.5 h-2 bg-slate-800" />
          </Card>

          <Card className="border-border/60 bg-slate-900/60 p-5 shadow-inner backdrop-blur-md">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              <span>Job Compatibility</span>
              <Badge variant="success" className="text-[11px] font-bold px-2 py-0.5">
                {data?.metrics.jobCompatibilityGrowth}
              </Badge>
            </div>
            <div className="mt-3">
              <span className="font-display text-4xl font-extrabold text-white">{data?.metrics.jobCompatibility}%</span>
            </div>
            <Progress value={data?.metrics.jobCompatibility || 0} className="mt-3.5 h-2 bg-slate-800" />
          </Card>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card className="border-border/60 bg-slate-900/60 p-5 text-left backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="size-4 text-brand-400" /> Recommended Roles
              </h3>
              <Link to="/jobs" className="text-xs text-brand-400 hover:underline font-semibold flex items-center gap-1">
                View all <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="space-y-4">
              {data?.recommendedRoles.map((role) => (
                <div key={role.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-white">{role.title}</span>
                    <span className="font-display font-bold text-brand-400">{role.matchScore}%</span>
                  </div>
                  <Progress value={role.matchScore} className="h-2 bg-slate-800" />
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-border/60 bg-slate-900/60 p-5 text-left backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Layers className="size-4 text-brand-400" /> Skill Intelligence
              </h3>
              <Link to="/skill-gaps" className="text-xs text-brand-400 hover:underline font-semibold flex items-center gap-1">
                Skill gaps <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {data?.skillIntelligence.map((item) => (
                <div
                  key={item.name}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                    item.status === 'mastered'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  }`}
                >
                  {item.status === 'mastered' ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="size-3.5 shrink-0 text-amber-400" />
                  )}
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="relative overflow-hidden border border-brand-500/30 bg-gradient-to-br from-slate-900 via-slate-900/90 to-brand-950/60 p-6 text-left shadow-xl">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
              <BookOpen className="size-6" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Next skill to learn</span>
              <h3 className="text-xl font-bold text-white font-display">{data?.nextSkillCard.skill}</h3>
              <p className="text-xs text-muted-foreground">{data?.nextSkillCard.description}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4">
            <span className="text-xs font-medium text-muted-foreground truncate max-w-[220px]">
              {data?.nextSkillCard.courseTitle}
            </span>
            <Link to="/career-growth">
              <Button size="sm" className="bg-brand-600 hover:bg-brand-500 text-xs gap-1.5">
                Start Course <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="relative overflow-hidden border border-purple-500/30 bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/60 p-6 text-left shadow-xl">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Award className="size-6" />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Interview Practice</span>
              <h3 className="text-xl font-bold text-white font-display">AI Technical & Behavioral Prep</h3>
              <p className="text-xs text-muted-foreground">Practice real questions & get instant AI evaluation scores.</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4">
            <span className="text-xs font-medium text-muted-foreground">4 core questions available</span>
            <Link to="/interview">
              <Button size="sm" variant="outline" className="border-purple-500/40 text-purple-300 hover:bg-purple-500/20 text-xs gap-1.5">
                Practice Now <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}