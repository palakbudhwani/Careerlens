import { Clock } from 'lucide-react'

import { PlaceholderPage, type PlaceholderFeature } from '@/pages/placeholder-page'

const features: PlaceholderFeature[] = [
  {
    label: 'Activity timeline',
    description: 'Every scan, match, comparison, and plan in chronological order.',
  },
  {
    label: 'Score history',
    description: 'Watch your match scores trend upward as you close skill gaps.',
  },
  {
    label: 'Replay reports',
    description: 'Open any past report exactly as it looked when it was generated.',
  },
  {
    label: 'Search & filter',
    description: 'Find anything by action type, role, or date range.',
  },
]

export default function HistoryPage() {
  return (
    <PlaceholderPage
      title="History"
      description="Every scan, match, and comparison in your career timeline."
      icon={Clock}
      features={features}
    />
  )
}