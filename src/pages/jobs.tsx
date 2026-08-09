import { Briefcase } from 'lucide-react'

import { PlaceholderPage, type PlaceholderFeature } from '@/pages/placeholder-page'

const features: PlaceholderFeature[] = [
  {
    label: 'Smart discovery',
    description: 'Browse roles ranked by fit score, with filtering by skills, seniority, and mode.',
  },
  {
    label: 'Live match chips',
    description: 'Every listing carries its match score and level before you ever open it.',
  },
  {
    label: 'Skill-aware search',
    description: 'Search by terms that match your growing skill set, not just job titles.',
  },
  {
    label: 'Saved roles',
    description: 'Pin opportunities and track them over time in one place.',
  },
]

export default function JobsPage() {
  return (
    <PlaceholderPage
      title="Discover Jobs"
      description="Browse roles matched to your profile with live fit scores."
      icon={Briefcase}
      features={features}
    />
  )
}