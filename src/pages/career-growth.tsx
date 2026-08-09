import { TrendingUp } from 'lucide-react'

import { PlaceholderPage, type PlaceholderFeature } from '@/pages/placeholder-page'

const features: PlaceholderFeature[] = [
  {
    label: 'Role roadmap',
    description: 'A time-boxed path from where you are to your target role, informed by real matches.',
  },
  {
    label: 'Impact-weighted actions',
    description: 'Recommendations ranked by the score they would unlock per unit of effort.',
  },
  {
    label: 'Milestone tracking',
    description: 'Quarterly milestones with clear completion criteria.',
  },
  {
    label: 'Progress narrative',
    description: 'A living record of growth you can export for reviews and interviews.',
  },
]

export default function CareerGrowthPage() {
  return (
    <PlaceholderPage
      title="Career Growth"
      description="A roadmap for your next role — courses, projects, and milestones."
      icon={TrendingUp}
      features={features}
    />
  )
}