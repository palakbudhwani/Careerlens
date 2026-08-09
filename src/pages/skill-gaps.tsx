import { Gauge } from 'lucide-react'

import { PlaceholderPage, type PlaceholderFeature } from '@/pages/placeholder-page'

const features: PlaceholderFeature[] = [
  {
    label: 'Gap ranking',
    description: 'Every gap scored by importance and its effect on your target-role match rate.',
  },
  {
    label: 'Current vs required',
    description: 'A clear visual of where you are versus where the market expects you to be.',
  },
  {
    label: 'Closure plans',
    description: 'Courses, projects, and mentors mapped to each gap — with effort estimates.',
  },
  {
    label: 'Progress tracking',
    description: 'Watch gaps shrink as you complete the actions in your plan.',
  },
]

export default function SkillGapsPage() {
  return (
    <PlaceholderPage
      title="Skill Gaps"
      description="What is missing, how important it is, and how to close it."
      icon={Gauge}
      features={features}
    />
  )
}