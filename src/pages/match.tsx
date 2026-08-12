import { ArrowLeft, ScanSearch } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PlaceholderPage, type PlaceholderFeature } from '@/pages/placeholder-page'
import { Progress } from '@/components/ui/progress'
import { mockStore } from '@/lib/mock-store'

const features: PlaceholderFeature[] = [
  {
    label: 'Decomposed score',
    description: 'A total fit score split across hard skills, soft skills, experience, and education.',
  },
  {
    label: 'Evidence-based strengths',
    description: 'Which of your wins are driving the match — tied to specific resume lines.',
  },
  {
    label: 'Gap analysis',
    description: 'What is missing and exactly how much it costs you in score.',
  },
  {
    label: 'Tailored next steps',
    description: 'The things most likely to move this specific match into strong territory.',
  },
]

export default function MatchPage() {
  const { jobId } = useParams<{ jobId?: string }>()
  const match = jobId ? mockStore.getMatchForJob(jobId) : undefined
  const job = jobId ? mockStore.getJob(jobId) : undefined

  if (job && match) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Badge variant="outline">Match analysis</Badge>
              <Badge
                variant={match.level === 'strong' ? 'success' : match.level === 'moderate' ? 'warning' : 'destructive'}
                dot
              >
                {match.level}
              </Badge>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight">{job.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {job.company} — full match analysis is built in the next milestone.
            </p>
          </div>
          <Link to="/match">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="size-3.5" aria-hidden />}>
              All matches
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Overall fit
              <span className="font-display text-3xl font-bold text-brand-600 dark:text-brand-400">
                {match.score}%
              </span>
            </CardTitle>
            <CardDescription>{match.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={match.score} className="h-2.5" />
            {match.missingSkills.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Key gaps to watch:{' '}
                <span className="font-medium text-foreground">
                  {match.missingSkills.map((gap) => gap.skill).join(' · ')}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (jobId && !job) {
    return (
      <EmptyState
        icon={ScanSearch}
        title="Match not found"
        description="We could not find a match for that role in the demo dataset."
        action={
          <Link to="/match">
            <Button variant="outline" size="sm">
              View all matches
            </Button>
          </Link>
        }
      />
    )
  }

  return (
    <PlaceholderPage
      title="Match Analysis"
      description="Understand exactly why you match a job — strengths, gaps, and the evidence."
      icon={ScanSearch}
      features={features}
    />
  )
}