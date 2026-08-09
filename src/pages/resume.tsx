import { FileText } from 'lucide-react'

import { PlaceholderPage, type PlaceholderFeature } from '@/pages/placeholder-page'

const features: PlaceholderFeature[] = [
  {
    label: 'Upload & parse',
    description: 'Drag in a PDF or DOCX and watch it become structured, editable profile data.',
  },
  {
    label: 'Completeness score',
    description: 'A clear rating of your resume health with the highest-impact fixes prioritized.',
  },
  {
    label: 'Section intelligence',
    description: 'Per-section feedback on summary, experience, skills, and education.',
  },
  {
    label: 'Keyword coverage',
    description: 'See which keywords recruiters and ATS filters expect for your target roles.',
  },
  {
    label: 'Suggested improvements',
    description: 'Concrete edits — not vague advice — that measurably increase your match scores.',
  },
]

export default function ResumePage() {
  return (
    <PlaceholderPage
      title="Resume Intelligence"
      description="Upload, parse, and score your resume against real job requirements."
      icon={FileText}
      features={features}
    />
  )
}