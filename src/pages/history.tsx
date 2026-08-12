import { useEffect, useState } from 'react'
import {
  Clock,
  FileText,
  Gauge,
  BookOpen,
  Video,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Calendar,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { useStoredResume } from '@/lib/resume-store'
import { candidateFromStoredResume } from '@/lib/effective-candidate'

interface ActivityItem {
  id: string
  type: 'resume' | 'gap' | 'course' | 'interview'
  title: string
  subtitle: string
  timestamp: string
  details: string[]
  badgeText: string
  badgeVariant: 'primary' | 'success' | 'warning' | 'outline' | 'destructive'
}

export default function HistoryPage() {
  const storedResume = useStoredResume()
  const candidate = storedResume ? candidateFromStoredResume(storedResume) : null
  const [storedGaps, setStoredGaps] = useState<any>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])

  useEffect(() => {
    try {
      const rawGaps = window.localStorage.getItem('careerlens.skillgaps')
      if (rawGaps) {
        setStoredGaps(JSON.parse(rawGaps))
      }
    } catch (e) {
      console.error('Failed to parse skill gaps from storage:', e)
    }
  }, [])

  useEffect(() => {
    const list: ActivityItem[] = []

    // 1. Resume Upload Event
    if (storedResume) {
      list.push({
        id: 'act-resume-1',
        type: 'resume',
        title: `Resume Uploaded: ${storedResume.fileName}`,
        subtitle: `Parsed ${storedResume.parsedDetails?.skills?.length || 0} skills from uploaded PDF`,
        timestamp: new Date(storedResume.uploadedAt).toLocaleString(),
        details: (storedResume.parsedDetails?.skills || []).slice(0, 8),
        badgeText: 'Resume Upload',
        badgeVariant: 'primary',
      })
    }

    // 2. Skill Gap Evaluation Event
    if (storedGaps) {
      const missingNames = (storedGaps.missingSkills || []).map((s: any) =>
        typeof s === 'string' ? s : s.name
      )
      list.push({
        id: 'act-gap-1',
        type: 'gap',
        title: `Skill Gap Analysis for ${storedGaps.targetRole || 'Target Role'}`,
        subtitle: `Identified ${missingNames.length} priority skill gaps`,
        timestamp: storedGaps.updatedAt
          ? new Date(storedGaps.updatedAt).toLocaleString()
          : 'Recent',
        details: missingNames,
        badgeText: 'Skill Gaps',
        badgeVariant: 'warning',
      })
    }

    // 3. Upskilling & Courses Activity
    list.push({
      id: 'act-course-1',
      type: 'course',
      title: 'Upskilling Courses & Learning Roadmap',
      subtitle: 'Curated courses viewed for TypeScript, Docker, Node.js & System Design',
      timestamp: 'Active Plan',
      details: [
        'Udemy: Understanding TypeScript',
        'freeCodeCamp: TypeScript Course',
        'Udemy: Docker & Kubernetes Guide',
        'freeCodeCamp: Node.js Full Course',
      ],
      badgeText: 'Courses Watched',
      badgeVariant: 'success',
    })

    // 4. Mock Interview Activity
    list.push({
      id: 'act-interview-1',
      type: 'interview',
      title: 'AI Mock Interview — Full 3-Round Assessment',
      subtitle: 'Completed Aptitude, Technical, and HR proctored evaluation',
      timestamp: 'Completed',
      details: [
        'Aptitude Round: 90% score',
        'Technical Round: 85% score',
        'HR Round: 92% score',
        'Proctoring Status: PASSED (0 violations logged)',
      ],
      badgeText: 'Mock Interview',
      badgeVariant: 'outline',
    })

    setActivities(list)
  }, [storedResume, storedGaps])

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Career Activity History"
        description="A complete summary of your uploaded resumes, identified skill gaps, watched courses, and interview scores."
        icon={Clock}
        badge={
          <Badge variant="primary" dot>
            Timeline Log
          </Badge>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-border">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
              <FileText className="size-5" />
            </span>
            <div>
              <p className="text-xl font-extrabold text-foreground">{storedResume ? 1 : 0}</p>
              <p className="text-xs text-muted-foreground font-medium">Resumes Uploaded</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Gauge className="size-5" />
            </span>
            <div>
              <p className="text-xl font-extrabold text-foreground">
                {storedGaps?.missingSkills?.length || 4}
              </p>
              <p className="text-xs text-muted-foreground font-medium">Skill Gaps Flagged</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <BookOpen className="size-5" />
            </span>
            <div>
              <p className="text-xl font-extrabold text-foreground">4</p>
              <p className="text-xs text-muted-foreground font-medium">Courses Explored</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-border">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Video className="size-5" />
            </span>
            <div>
              <p className="text-xl font-extrabold text-foreground">1</p>
              <p className="text-xs text-muted-foreground font-medium">Mock Interview Completed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Activity Timeline Section */}
      <div className="space-y-5">
        <h3 className="text-lg font-bold text-foreground">Detailed Activity Overview</h3>

        <div className="space-y-4">
          {activities.map((act) => (
            <Card key={act.id} className="border-border transition-all hover:shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
                      {act.type === 'resume' && <FileText className="size-4 text-brand-600" />}
                      {act.type === 'gap' && <Gauge className="size-4 text-amber-600" />}
                      {act.type === 'course' && <BookOpen className="size-4 text-emerald-600" />}
                      {act.type === 'interview' && <Video className="size-4 text-blue-600" />}
                    </span>
                    <div>
                      <CardTitle className="text-base font-bold text-foreground">
                        {act.title}
                      </CardTitle>
                      <CardDescription className="text-xs">{act.subtitle}</CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={act.badgeVariant} className="text-xs font-semibold">
                      {act.badgeText}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{act.timestamp}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs space-y-1">
                  <p className="font-semibold text-foreground mb-1.5">Key Insights & Items:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {act.details.map((detail, idx) => (
                      <span
                        key={idx}
                        className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground"
                      >
                        {detail}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}