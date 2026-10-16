import type { Job } from '@/types'

const typeLabels: Record<Job['type'], string> = {
  'full-time': 'Full-time',
  contract: 'Contract',
  internship: 'Internship',
}

const workModeLabels: Record<NonNullable<Job['workMode']>, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}

export function formatJobType(type: Job['type']): string {
  return typeLabels[type]
}

export function formatWorkMode(job: Job): string | null {
  if (!job.workMode) return null
  return workModeLabels[job.workMode]
}

export function deriveExperienceLevel(job: Job): string {
  const experience = job.experience?.toLowerCase() ?? ''
  const range = experience.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) {
    const upper = Number(range[2])
    if (upper <= 2) return 'Junior'
    if (upper <= 5) return 'Mid'
    return 'Senior'
  }

  const title = job.title.toLowerCase()
  if (/staff|principal|lead/.test(title)) return 'Staff'
  if (/senior/.test(title)) return 'Senior'
  if (/junior|entry|graduate|fresher|trainee|intern/.test(title)) return 'Junior'
  if (/fresher|entry|graduate|intern/.test(experience)) return 'Junior'

  return 'Mid'
}

export function buildJobMatchDescription(job: Job): string {
  return `${job.title} at ${job.company}\n\nJob Description:\n${job.description}\n\nRequirements:\n${job.requirements.join('\n')}\n\nPreferred:\n${job.preferred?.join('\n') ?? ''}`
}
