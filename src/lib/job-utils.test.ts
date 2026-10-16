import { describe, expect, it } from 'vitest'

import { buildJobMatchDescription, deriveExperienceLevel, formatJobType, formatWorkMode } from '@/lib/job-utils'
import type { Job } from '@/types'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-fixture',
    title: 'Software Engineer',
    company: 'Acme',
    location: 'Pune, India',
    type: 'full-time',
    domain: 'Software',
    description: 'Build things.',
    requirements: ['Requirement one.', 'Requirement two.'],
    skills: [],
    tags: [],
    ...overrides,
  }
}

describe('deriveExperienceLevel', () => {
  it('maps numeric ranges to levels by their upper bound', () => {
    expect(deriveExperienceLevel(makeJob({ experience: '0–1 years' }))).toBe('Junior')
    expect(deriveExperienceLevel(makeJob({ experience: '0–2 years' }))).toBe('Junior')
    expect(deriveExperienceLevel(makeJob({ experience: '3–5 years' }))).toBe('Mid')
    expect(deriveExperienceLevel(makeJob({ experience: '6–9 years' }))).toBe('Senior')
  })

  it('reads junior signals from the title when no range exists', () => {
    expect(deriveExperienceLevel(makeJob({ title: 'Frontend Developer Trainee – React (Fresher)' }))).toBe('Junior')
    expect(deriveExperienceLevel(makeJob({ title: 'AI/Machine Learning Engineer', experience: 'Entry-level / Graduate' }))).toBe('Junior')
  })

  it('reads senior signals from the title', () => {
    expect(deriveExperienceLevel(makeJob({ title: 'Senior Analyst' }))).toBe('Senior')
    expect(deriveExperienceLevel(makeJob({ title: 'Staff Engineer' }))).toBe('Staff')
  })

  it('falls back to Mid when nothing signals a level', () => {
    expect(deriveExperienceLevel(makeJob())).toBe('Mid')
  })
})

describe('buildJobMatchDescription', () => {
  it('packages title, company, description, requirements and preferred qualifications', () => {
    const job = makeJob({
      title: 'Data Analyst',
      company: 'S&P Global',
      description: 'Analyse private markets data.',
      requirements: ['SQL.', 'Attention to detail.'],
      preferred: ['Fund accounting knowledge.'],
    })

    const text = buildJobMatchDescription(job)
    expect(text).toContain('Data Analyst at S&P Global')
    expect(text).toContain('Job Description:\nAnalyse private markets data.')
    expect(text).toContain('Requirements:\nSQL.\nAttention to detail.')
    expect(text).toContain('Preferred:\nFund accounting knowledge.')
  })

  it('still renders the Preferred section when a job has none', () => {
    const text = buildJobMatchDescription(makeJob())
    expect(text.endsWith('Preferred:\n')).toBe(true)
  })
})

describe('formatters', () => {
  it('labels employment types and work modes', () => {
    expect(formatJobType('full-time')).toBe('Full-time')
    expect(formatJobType('internship')).toBe('Internship')
    expect(formatWorkMode(makeJob({ workMode: 'hybrid' }))).toBe('Hybrid')
    expect(formatWorkMode(makeJob())).toBeNull()
  })
})
