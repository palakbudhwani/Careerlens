import { ArrowLeft, Briefcase } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { mockStore } from '@/lib/mock-store'
import { formatSalaryRange } from '@/lib/utils'

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const job = id ? mockStore.getJob(id) : undefined

  return (
    <div className="space-y-6">
      {job ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="outline">/{job.id}</Badge>
                <Badge variant={job.matchLevel === 'strong' ? 'success' : job.matchLevel === 'moderate' ? 'warning' : 'destructive'} dot>
                  {typeof job.matchScore === 'number' ? `${job.matchScore}% fit` : 'Not scored'}
                </Badge>
              </div>
              <h1 className="font-display text-2xl font-bold tracking-tight">{job.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {job.company} · {job.location} · {job.workMode} · {formatSalaryRange(job.salaryRange.min, job.salaryRange.max)}
              </p>
            </div>
            <Link to="/jobs">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="size-3.5" aria-hidden />}>
                Back to jobs
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Job detail — coming soon</CardTitle>
              <CardDescription>
                The full detail page for this role — responsibilities, requirements, and a full match
                breakdown — is built in the next milestone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{job.description}</p>
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Key skills
                </p>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <Badge key={skill.id} variant="primary">
                      {skill.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="Role not found"
          description="We could not find that listing in the demo dataset. It may have been removed."
          action={
            <Link to="/jobs">
              <Button variant="outline" size="sm">
                Browse all jobs
              </Button>
            </Link>
          }
        />
      )}
    </div>
  )
}