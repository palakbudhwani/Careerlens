import { UserRound } from 'lucide-react'

import { PlaceholderPage, type PlaceholderFeature } from '@/pages/placeholder-page'

const features: PlaceholderFeature[] = [
  {
    label: 'Skills inventory',
    description: 'An editable map of everything you know, with proficiency levels and evidence.',
  },
  {
    label: 'Experience journal',
    description: 'Your roles and achievements, structured the way hiring managers want to read them.',
  },
  {
    label: 'Target role settings',
    description: 'Declare the roles you are aiming for and let CareerLens score against them.',
  },
  {
    label: 'Preferences',
    description: 'Location, remote preference, and salary range that shape every recommendation.',
  },
]

export default function CareerProfilePage() {
  return (
    <PlaceholderPage
      title="Career Profile"
      description="Your skills, experience, and aspirations in one living profile."
      icon={UserRound}
      features={features}
    />
  )
}