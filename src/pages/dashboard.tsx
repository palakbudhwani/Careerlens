import { LayoutDashboard } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { PlaceholderPage } from '@/pages/placeholder-page'
import { Skeleton } from '@/components/ui/skeleton'
import { mockStore } from '@/lib/mock-store'

function DashboardPreview() {
  const candidate = mockStore.getCandidate()

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-brand-200 bg-gradient-to-br from-brand-600 to-blue-600 p-6 text-white shadow-card dark:border-brand-500/30">
        <div className="absolute -right-10 -top-16 size-48 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <p className="text-sm font-medium text-brand-100">Welcome back</p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
          {candidate.name.split(' ')[0]}, your career is looking strong.
        </h2>
        <p className="mt-1.5 max-w-lg text-sm text-brand-100">
          Your resume is fully parsed and 4 matches are waiting. CareerLens is analyzing how your
          profile measures up against your target role.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index}>
            <div className="space-y-2.5 p-5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard"
      description="Your career command center — match overview, skill health, and next best actions."
      icon={LayoutDashboard}
      preview={<DashboardPreview />}
      features={[
        {
          label: 'Match overview',
          description: 'Your best current matches and live fit scores at a glance.',
        },
        {
          label: 'Resume health',
          description: 'Completeness, coverage, and suggested resume improvements.',
        },
        {
          label: 'Skill trend',
          description: 'How your skill set is growing relative to your target roles.',
        },
        {
          label: 'Next actions',
          description: 'A prioritized queue of the highest-impact moves for this week.',
        },
      ]}
      context={
        <>
          The dashboard landing experience is built in the next milestone. The banner and cards above
          are a preview using your seeded demo profile.
        </>
      }
    />
  )
}