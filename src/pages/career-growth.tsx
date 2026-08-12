import { useEffect, useState } from 'react'
import {
  TrendingUp,
  ExternalLink,
  BookOpen,
  Clock,
  Award,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Calendar,
  CheckSquare,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import {
  apiService,
  type CareerGrowthPlanResponse,
  type CourseRecommendation,
  type CareerMilestone,
} from '@/lib/api-service'
import { useStoredResume } from '@/lib/resume-store'
import { candidateFromStoredResume } from '@/lib/effective-candidate'

export default function CareerGrowthPage() {
  const storedResume = useStoredResume()
  const candidate = storedResume ? candidateFromStoredResume(storedResume) : null

  const [targetRole, setTargetRole] = useState<string>('Full-Stack Engineer')
  const [missingSkills, setMissingSkills] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [growthPlan, setGrowthPlan] = useState<CareerGrowthPlanResponse | null>(null)
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let role = candidate?.targetRole || candidate?.preferredRoles?.[0] || 'Full-Stack Engineer'
    let skills: string[] = ['TypeScript', 'Docker', 'System Design', 'PostgreSQL']

    try {
      const storedGaps = window.localStorage.getItem('careerlens.skillgaps')
      if (storedGaps) {
        const parsed = JSON.parse(storedGaps)
        if (parsed.targetRole) role = parsed.targetRole
        if (Array.isArray(parsed.missingSkills)) {
          skills = parsed.missingSkills.map((s: any) => (typeof s === 'string' ? s : s.name))
        }
      }
    } catch (e) {
      console.error('Failed to parse stored skill gaps:', e)
    }

    setTargetRole(role)
    setMissingSkills(skills)
  }, [storedResume])

  const fetchGrowthPlan = async () => {
    setLoading(true)
    setError(null)
    try {
      const resumeText = storedResume?.resumeText || ''
      const plan = await apiService.getCareerGrowthPlan(missingSkills, targetRole, resumeText)
      setGrowthPlan(plan)
    } catch (err: any) {
      console.error('Failed to load career growth plan:', err)
      setError(err.message || 'Failed to fetch course recommendations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (targetRole) {
      fetchGrowthPlan()
    }
  }, [targetRole, missingSkills])

  const toggleActionItem = (id: string) => {
    setCompletedActions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const getProviderBadgeStyle = (provider: string = '') => {
    const p = provider.toLowerCase()
    if (p.includes('udemy')) return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900'
    if (p.includes('coursera')) return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900'
    if (p.includes('freecodecamp') || p.includes('youtube')) return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900'
    return 'bg-secondary text-secondary-foreground'
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Career Growth & Upskilling"
        description="Curated learning courses with direct links and milestone roadmaps to help you close your skill gaps."
        icon={TrendingUp}
        badge={
          <Badge variant="primary" dot>
            Courses & Links
          </Badge>
        }
      />

      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Target Career Role:
                </span>
                <Badge variant="primary" className="text-xs font-bold">
                  {targetRole}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Showing courses targeting {missingSkills.length} key skill gaps: {missingSkills.slice(0, 5).join(', ')}
                {missingSkills.length > 5 ? ` +${missingSkills.length - 5} more` : ''}
              </p>
            </div>

            <div className="flex gap-2">
              <Link to="/skill-gaps">
                <Button variant="outline" size="sm">
                  Change Target Role / Gaps
                </Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={fetchGrowthPlan} disabled={loading}>
                <RefreshCw className={`mr-1.5 size-3.5 ${loading ? 'animate-spin' : ''}`} /> Re-analyze
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-4 w-1/3 mb-2" />
                <Skeleton className="h-6 w-3/4 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-4/5 mb-4" />
                <Skeleton className="h-9 w-full" />
              </Card>
            ))}
          </div>
        </div>
      )}

      {error && !loading && (
        <Card className="border-destructive/30 bg-destructive/10 p-5 text-destructive">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchGrowthPlan}>
              <RefreshCw className="mr-1.5 size-3.5" /> Retry
            </Button>
          </div>
        </Card>
      )}

      {!loading && !error && growthPlan && (
        <div className="space-y-10">
          {growthPlan.summary && (
            <Card className="border-brand-200/80 bg-brand-50/40 p-5 dark:border-brand-900/40 dark:bg-brand-950/20">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-600 dark:text-brand-400" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Growth Roadmap Strategy</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{growthPlan.summary}</p>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                <BookOpen className="size-5 text-brand-600 dark:text-brand-400" />
                Recommended Upskilling Courses ({growthPlan.courses?.length || 0})
              </h3>
              <p className="text-xs text-muted-foreground">
                Hand-picked courses with direct links to help you master missing skills for {targetRole}.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {growthPlan.courses?.map((course: CourseRecommendation) => (
                <Card
                  key={course.id}
                  className="flex flex-col justify-between border-border transition-all hover:border-brand-300 hover:shadow-md dark:hover:border-brand-800"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="outline" className="w-fit text-[11px] font-bold text-brand-600 dark:text-brand-400">
                        {course.skillName}
                      </Badge>
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getProviderBadgeStyle(
                          course.provider
                        )}`}
                      >
                        {course.provider}
                      </span>
                    </div>

                    <CardTitle className="mt-2 text-base font-bold text-foreground line-clamp-2">
                      {course.title}
                    </CardTitle>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" /> {course.duration}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Award className="size-3" /> {course.level}
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-foreground">{course.type}</span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    <CardDescription className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                      {course.description}
                    </CardDescription>

                    <a
                      href={course.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full"
                    >
                      <Button variant="primary" size="sm" className="w-full justify-center shadow-sm">
                        Go to Course <ExternalLink className="ml-2 size-3.5" />
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {growthPlan.milestones && growthPlan.milestones.length > 0 && (
            <div className="space-y-4 pt-4">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <Calendar className="size-5 text-brand-600 dark:text-brand-400" />
                  Upskilling Milestone Roadmap
                </h3>
                <p className="text-xs text-muted-foreground">
                  Step-by-step phased execution plan to achieve complete readiness for {targetRole}.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {growthPlan.milestones.map((ms: CareerMilestone, idx: number) => {
                  const isChecked = !!completedActions[`milestone-${idx}`]
                  return (
                    <Card
                      key={ms.phase}
                      className={`border-border transition-all ${
                        isChecked ? 'bg-emerald-50/30 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800' : ''
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="primary" className="text-[11px] font-bold">
                            {ms.phase}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => toggleActionItem(`milestone-${idx}`)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <CheckSquare
                              className={`size-4 ${isChecked ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                            />
                          </button>
                        </div>
                        <CardTitle className="mt-2 text-sm font-bold text-foreground">
                          {ms.focus}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0 text-xs">
                        <div>
                          <span className="font-semibold text-foreground">Action Required:</span>
                          <p className="mt-0.5 text-muted-foreground leading-relaxed">{ms.action}</p>
                        </div>
                        <div className="rounded-md border border-border bg-secondary/50 p-2.5">
                          <span className="font-semibold text-brand-600 dark:text-brand-400">Target Outcome:</span>
                          <p className="mt-0.5 text-foreground leading-relaxed font-medium">{ms.targetOutcome}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          <Card className="border-border bg-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-foreground">Want to re-evaluate your target role match?</h4>
                <p className="text-xs text-muted-foreground">
                  Update your skills or analyze a different role target on the Skill Gaps page.
                </p>
              </div>
              <Link to="/skill-gaps">
                <Button variant="outline" size="sm">
                  Back to Skill Gaps <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}