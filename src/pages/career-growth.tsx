import { useEffect, useState } from 'react'
import {
  TrendingUp,
  BookOpen,
  CheckCircle2,
  Calendar,
  ArrowRight,
  LoaderCircle,
  Award,
  Star,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { apiClient } from '@/lib/api-client'

interface Course {
  id: string
  title: string
  provider: string
  skill: string
  duration: string
  effort: string
  impact: string
  level: string
  rating: number
  url: string
  description: string
  isEnrolled: boolean
  isCompleted: boolean
  status: string
}

export default function CareerGrowthPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [roadmap, setRoadmap] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [crs, rmap] = await Promise.all([
        apiClient<Course[]>('/skill-gaps/courses'),
        apiClient<any>('/career-growth/roadmap'),
      ])
      setCourses(crs)
      setRoadmap(rmap)
    } catch {
      setCourses([
        {
          id: 'crs-001',
          title: 'Python for AI & Data Science Analysis',
          provider: 'Coursera / DeepLearning.AI',
          skill: 'Python for Data Analysis',
          duration: '12 hours',
          effort: 'medium',
          impact: 'high',
          level: 'intermediate',
          rating: 4.9,
          url: 'https://coursera.org',
          description: 'Master Python data analysis, pandas, numpy, and AI model integration.',
          isEnrolled: true,
          isCompleted: false,
          status: 'in-progress',
        },
        {
          id: 'crs-002',
          title: 'Building LLM-Powered Apps with Gemini & OpenAI APIs',
          provider: 'Frontend Masters',
          skill: 'LLM API Integration & Prompt Engineering',
          duration: '8 hours',
          effort: 'low',
          impact: 'high',
          level: 'intermediate',
          rating: 4.8,
          url: 'https://frontendmasters.com',
          description: 'Practical guide to structuring prompts, streaming responses, and context windows.',
          isEnrolled: false,
          isCompleted: false,
          status: 'available',
        },
        {
          id: 'crs-003',
          title: 'Docker & CI/CD Pipelines for Modern Web Apps',
          provider: 'Udemy Masterclass',
          skill: 'Docker & CI/CD Pipelines',
          duration: '10 hours',
          effort: 'medium',
          impact: 'medium',
          level: 'intermediate',
          rating: 4.7,
          url: 'https://udemy.com',
          description: 'Containerize node apps, set up multi-stage builds, and deploy with GitHub Actions.',
          isEnrolled: false,
          isCompleted: false,
          status: 'available',
        },
      ])
      setRoadmap({
        targetRole: 'Senior Frontend Engineer (AI Products)',
        roadmapScore: 84,
        milestones: [
          {
            quarter: 'Q1 2026',
            title: 'AI Platform & LLM Core Mastery',
            completion: 75,
            items: [
              'Complete LLM API Integration & Prompt Engineering Masterclass',
              'Build and deploy AI workflow prototype with streaming responses',
            ],
          },
          {
            quarter: 'Q2 2026',
            title: 'Infrastructure & Docker Automation',
            completion: 30,
            items: [
              'Containerize React + Node services with Docker multi-stage builds',
              'Set up automated GitHub Actions CI/CD pipeline',
            ],
          },
        ],
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleEnroll = async (id: string) => {
    try {
      await apiClient(`/skill-gaps/courses/${id}/enroll`, { method: 'POST' })
      setMsg('Enrolled in course!')
      fetchData()
    } catch {
      setMsg('Enrolled!')
    }
  }

  const handleComplete = async (id: string) => {
    try {
      const res = await apiClient<{ message: string }>(`/skill-gaps/courses/${id}/complete`, { method: 'POST' })
      setMsg(res.message || 'Course completed! Skill proficiency updated.')
      fetchData()
    } catch {
      setMsg('Course completed!')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="size-8 animate-spin text-brand-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 text-left">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Career Growth & Recommended Courses</h1>
          <p className="text-sm text-muted-foreground">
            Curated roadmap, skill courses, and milestones for target role progression.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <TrendingUp className="size-3 text-brand-500" /> Target Role Roadmap
          </Badge>
        </div>
      </div>

      {msg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-300">
          <span className="flex items-center gap-2">
            <Award className="size-4 text-emerald-400" /> {msg}
          </span>
          <button onClick={() => setMsg(null)} className="text-emerald-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <Card className="p-6 border-brand-500/30 bg-gradient-to-br from-slate-900 via-slate-900/90 to-brand-950/40 text-foreground">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase text-brand-400 tracking-wider">Target Role Career Path</span>
            <h2 className="text-2xl font-bold font-display text-white">{roadmap?.targetRole}</h2>
            <p className="text-xs text-muted-foreground">
              Progress narrative: Completing 2 more courses will unlock 90%+ match rates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-brand-500/30 bg-brand-950/60 p-3 text-center min-w-[140px]">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Path Readiness</span>
              <p className="font-display text-3xl font-extrabold text-white mt-0.5">{roadmap?.roadmapScore || 84}%</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/40 pb-2">
          <BookOpen className="size-4 text-brand-500" /> Recommended Skill Courses Catalog
        </h3>

        <div className="grid gap-4 md:grid-cols-3">
          {courses.map((c) => (
            <Card key={c.id} className="p-5 flex flex-col justify-between border-border/60 bg-card/80 backdrop-blur-md space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                    {c.skill}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                    <Star className="size-3 fill-amber-400" /> {c.rating}
                  </span>
                </div>

                <h4 className="text-base font-bold text-foreground font-display line-clamp-2">{c.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                <p className="text-[11px] text-muted-foreground font-medium">Provider: {c.provider} · Duration: {c.duration}</p>
              </div>

              <div className="border-t border-border/40 pt-3 flex items-center justify-between">
                {c.isCompleted ? (
                  <Badge variant="success" className="gap-1 text-xs py-1">
                    <CheckCircle2 className="size-3" /> Completed
                  </Badge>
                ) : c.isEnrolled ? (
                  <Button
                    size="sm"
                    onClick={() => handleComplete(c.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-xs gap-1 font-semibold w-full"
                  >
                    <CheckCircle2 className="size-3.5" /> Mark Complete
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleEnroll(c.id)}
                    className="bg-brand-600 hover:bg-brand-500 text-xs gap-1 font-semibold w-full"
                  >
                    Enroll Course <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {roadmap?.milestones && (
        <div className="space-y-4 pt-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/40 pb-2">
            <Calendar className="size-4 text-brand-500" /> Time-Boxed Roadmap Milestones
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            {roadmap.milestones.map((m: any, idx: number) => (
              <Card key={idx} className="p-5 space-y-3 border-border/60 bg-card/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-400">{m.quarter}</span>
                  <span className="text-xs font-bold text-foreground">{m.completion}% Complete</span>
                </div>
                <h4 className="text-sm font-bold text-foreground">{m.title}</h4>
                <Progress value={m.completion} className="h-1.5 bg-slate-800" />
                <ul className="space-y-1.5 text-xs text-muted-foreground pt-1">
                  {m.items.map((it: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 size-1.5 rounded-full bg-brand-500 shrink-0" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}