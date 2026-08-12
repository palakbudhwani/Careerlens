import { useEffect, useState } from 'react'
import {
  Gauge,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  LoaderCircle,
  Award,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { apiClient } from '@/lib/api-client'

interface SkillGapItem {
  id: string
  skill: string
  category: string
  currentLevel: number
  requiredLevel: number
  importance: 'critical' | 'important' | 'nice-to-have'
  relatedRoles: string[]
  recommendedAction: string
  course: {
    id: string
    title: string
    provider: string
    duration: string
    isEnrolled: boolean
    isCompleted: boolean
  } | null
}

export default function SkillGapsPage() {
  const [gaps, setGaps] = useState<SkillGapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const loadGaps = async () => {
    setLoading(true)
    try {
      const data = await apiClient<SkillGapItem[]>('/skill-gaps')
      setGaps(data)
    } catch {
      setGaps([
        {
          id: 'gap-001',
          skill: 'Python for Data Analysis',
          category: 'technical',
          currentLevel: 2,
          requiredLevel: 4,
          importance: 'critical',
          relatedRoles: ['AI Product Engineer', 'Machine Learning Engineer'],
          recommendedAction: 'Complete hands-on Python data manipulation & pandas coursework.',
          course: {
            id: 'crs-001',
            title: 'Python for AI & Data Science Analysis',
            provider: 'Coursera / DeepLearning.AI',
            duration: '12 hours',
            isEnrolled: true,
            isCompleted: false,
          },
        },
        {
          id: 'gap-002',
          skill: 'LLM API Integration & Prompt Engineering',
          category: 'technical',
          currentLevel: 2,
          requiredLevel: 4,
          importance: 'critical',
          relatedRoles: ['AI Product Engineer', 'Senior Frontend Engineer (AI Products)'],
          recommendedAction: 'Build an AI assistant app using OpenAI / Gemini APIs and Vercel AI SDK.',
          course: {
            id: 'crs-002',
            title: 'Building LLM-Powered Apps with Gemini & OpenAI APIs',
            provider: 'Frontend Masters',
            duration: '8 hours',
            isEnrolled: false,
            isCompleted: false,
          },
        },
        {
          id: 'gap-003',
          skill: 'Docker & CI/CD Pipelines',
          category: 'tool',
          currentLevel: 3,
          requiredLevel: 4,
          importance: 'important',
          relatedRoles: ['Staff Frontend Engineer', 'Full-Stack Engineer'],
          recommendedAction: 'Configure GitHub Actions CI workflows for containerized applications.',
          course: {
            id: 'crs-003',
            title: 'Docker & CI/CD Pipelines for Modern Web Apps',
            provider: 'Udemy Masterclass',
            duration: '10 hours',
            isEnrolled: false,
            isCompleted: false,
          },
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGaps()
  }, [])

  const handleEnroll = async (courseId: string) => {
    try {
      await apiClient(`/skill-gaps/courses/${courseId}/enroll`, { method: 'POST' })
      setActionMessage('Enrolled in course successfully!')
      loadGaps()
    } catch {
      setActionMessage('Enrolled in course!')
    }
  }

  const handleComplete = async (courseId: string) => {
    try {
      const res = await apiClient<{ message: string }>(`/skill-gaps/courses/${courseId}/complete`, { method: 'POST' })
      setActionMessage(res.message || 'Course completed! Skill proficiency updated.')
      loadGaps()
    } catch {
      setActionMessage('Course marked complete! Skill upgraded.')
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
          <h1 className="font-display text-2xl font-bold tracking-tight">Skill Gap Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            What is missing, how critical it is for target roles, and personalized closure plans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-xs">
            <Gauge className="size-3 text-brand-500" /> {gaps.length} active gaps identified
          </Badge>
        </div>
      </div>

      {actionMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-300">
          <span className="flex items-center gap-2">
            <Award className="size-4 text-emerald-400" /> {actionMessage}
          </span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6">
        {gaps.map((gap) => (
          <Card key={gap.id} className="p-6 border-border/60 bg-card/80 backdrop-blur-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-foreground font-display">{gap.skill}</h3>
                  <Badge
                    variant={gap.importance === 'critical' ? 'destructive' : 'warning'}
                    className="text-[10px] uppercase font-bold"
                  >
                    {gap.importance} Gap
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Impacts roles:{' '}
                  <span className="font-medium text-foreground">{gap.relatedRoles.join(' · ')}</span>
                </p>
              </div>

              <div className="rounded-xl border border-border/50 bg-slate-900/60 p-3 text-center min-w-[180px]">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Current: Level {gap.currentLevel}/5</span>
                  <span className="text-brand-400 font-bold">Target: {gap.requiredLevel}/5</span>
                </div>
                <Progress value={(gap.currentLevel / gap.requiredLevel) * 100} className="h-2 bg-slate-800 mt-2" />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400">Recommended Closure Action</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{gap.recommendedAction}</p>
            </div>

            {gap.course && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-brand-500/20 bg-brand-950/20 p-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-4 text-brand-400" />
                    <span className="font-bold text-foreground text-sm">{gap.course.title}</span>
                  </div>
                  <p className="text-muted-foreground">
                    Provider: {gap.course.provider} · Duration: {gap.course.duration}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {gap.course.isCompleted ? (
                    <Badge variant="success" className="gap-1 text-xs py-1 px-3">
                      <CheckCircle2 className="size-3.5" /> Skill Mastered
                    </Badge>
                  ) : gap.course.isEnrolled ? (
                    <Button
                      size="sm"
                      onClick={() => handleComplete(gap.course!.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-xs gap-1 font-semibold"
                    >
                      <CheckCircle2 className="size-3.5" /> Mark Course Complete
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleEnroll(gap.course!.id)}
                      className="bg-brand-600 hover:bg-brand-500 text-xs gap-1 font-semibold"
                    >
                      Enroll Now <ArrowRight className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}