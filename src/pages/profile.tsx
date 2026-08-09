import { UserCog } from 'lucide-react'

import { PlaceholderPage, type PlaceholderFeature } from '@/pages/placeholder-page'

const features: PlaceholderFeature[] = [
  {
    label: 'Personal details',
    description: 'Your contact information and public-facing identity across CareerLens.',
  },
  {
    label: 'Professional info',
    description: 'Title, headline, and the summary CareerLens uses in reports.',
  },
  {
    label: 'Privacy controls',
    description: 'Choose what the demo exposes in matches, comparisons, and exports.',
  },
  {
    label: 'Account data',
    description: 'Local demo data — export or reset everything from one place.',
  },
]

export default function ProfilePage() {
  return (
    <PlaceholderPage
      title="Profile"
      description="Your personal details and professional identity."
      icon={UserCog}
      features={features}
    />
  )
}