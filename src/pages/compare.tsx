import { GitCompare } from 'lucide-react'

import { PlaceholderPage, type PlaceholderFeature } from '@/pages/placeholder-page'

const features: PlaceholderFeature[] = [
  {
    label: 'Side-by-side roles',
    description: 'Compare two or more roles across score, compensation, growth, and fit factors.',
  },
  {
    label: 'Factor weighting',
    description: 'Weight what matters to you — pay, remote, learning curve — and see ranks shift.',
  },
  {
    label: 'Score attribution',
    description: 'Understand why one role ranks higher, dimension by dimension.',
  },
  {
    label: 'Decision summary',
    description: 'A shareable one-page verdict with the evidence behind it.',
  },
]

export default function ComparePage() {
  return (
    <PlaceholderPage
      title="Compare Jobs"
      description="Side-by-side comparison of your top opportunities."
      icon={GitCompare}
      features={features}
    />
  )
}