import type { ReactNode } from 'react'

import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Check } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'

export interface PlaceholderFeature {
  label: string
  description: string
}

export interface PlaceholderPageProps {
  title: string
  description: string
  icon: LucideIcon
  features: PlaceholderFeature[]
  preview?: ReactNode
  context?: ReactNode
}

function PreviewSkeletons() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <Card key={index}>
          <div className="space-y-3 p-5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        </Card>
      ))}
    </div>
  )
}

export function PlaceholderPage({
  title,
  description,
  icon,
  features,
  preview,
  context,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        icon={icon}
        badge={
          <Badge variant="primary" dot>
            Coming soon
          </Badge>
        }
        actions={
          <Link to="/dashboard">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="size-3.5" aria-hidden />}>
              Dashboard
            </Button>
          </Link>
        }
      />

      {preview ?? <PreviewSkeletons />}

      <Card>
        <CardHeader>
          <CardTitle>What this workspace will do</CardTitle>
          <CardDescription>
            {context ??
              'Planned capabilities for this section of CareerLens. The full experience is built in a later milestone.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <li
                key={feature.label}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3.5"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  <Check className="size-3" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{feature.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}