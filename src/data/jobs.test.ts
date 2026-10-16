import { describe, expect, it } from 'vitest'

import { jobs, jobListings } from '@/data/jobs'
import { deriveExperienceLevel } from '@/lib/job-utils'

const REQUIRED_DOMAINS = [
  'GenAI',
  'Machine Learning',
  'Software',
  'Frontend',
  'Data Science',
  'Data Analytics',
  'Cloud / DevOps',
  'Cybersecurity',
]

const VALID_TYPES = new Set(['full-time', 'contract', 'internship'])
const VALID_WORK_MODES = new Set(['remote', 'hybrid', 'onsite'])

describe('job dataset', () => {
  it('exports the same collection under both names', () => {
    expect(jobListings).toBe(jobs)
  })

  it('ships exactly 14 curated listings', () => {
    expect(jobs).toHaveLength(14)
  })

  it('has unique listing ids', () => {
    const ids = jobs.map((job) => job.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps every required field populated', () => {
    for (const job of jobs) {
      expect(job.id, job.id).toBeTruthy()
      expect(job.title, job.id).toBeTruthy()
      expect(job.company, job.id).toBeTruthy()
      expect(job.location, job.id).toBeTruthy()
      expect(job.domain, job.id).toBeTruthy()
      expect(job.description, job.id).toBeTruthy()
      expect(job.requirements.length, job.id).toBeGreaterThan(0)
      expect(job.skills.length, job.id).toBeGreaterThan(0)
      expect(job.tags.length, job.id).toBeGreaterThan(0)
      expect(job.source, job.id).toBeTruthy()
      for (const item of job.requirements) expect(item.trim(), job.id).not.toBe('')
    }
  })

  it('uses valid employment types and work modes', () => {
    for (const job of jobs) {
      expect(VALID_TYPES.has(job.type), job.id).toBe(true)
      if (job.workMode !== undefined) {
        expect(VALID_WORK_MODES.has(job.workMode), job.id).toBe(true)
      }
    }
  })

  it('draws from at least 10 distinct employers with at most 2 listings each', () => {
    const counts = new Map<string, number>()
    for (const job of jobs) {
      counts.set(job.company, (counts.get(job.company) ?? 0) + 1)
    }
    expect(counts.size).toBeGreaterThanOrEqual(10)
    for (const [company, count] of counts) {
      expect(count, company).toBeLessThanOrEqual(2)
    }
  })

  it('links to unique https apply URLs', () => {
    const urls = jobs.map((job) => job.redirectUrl)
    for (const job of jobs) {
      const url = job.redirectUrl
      expect(url, `${job.id} needs an apply link`).toBeTruthy()
      let parsed: URL
      try {
        parsed = new URL(String(url))
      } catch {
        throw new Error(`${job.id} apply link is not a parseable URL: ${String(url)}`)
      }
      expect(parsed.protocol, job.id).toBe('https:')
      expect(parsed.hostname, job.id).toBeTruthy()
      expect(parsed.hostname, job.id).not.toContain(' ')
      expect(url, job.id).not.toMatch(/\s/)
    }
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('points the S&P Global listing at the verified official application page', () => {
    const sp = jobs.find((job) => job.id === 'job-sp-global-data-analyst-bangalore')
    expect(sp, 'S&P Global listing must exist').toBeDefined()
    if (!sp) return
    expect(sp.title).toBe('Data Analyst')
    expect(sp.company).toBe('S&P Global')
    expect(sp.location).toBe('Bangalore, India')
    expect(sp.redirectUrl).toBe(
      'https://spgi.wd5.myworkdayjobs.com/en-us/SPGI_Careers/job/Bengaluru-Karnataka/Data-Analyst_325334/apply',
    )
    expect(deriveExperienceLevel(sp)).toBe('Junior')
    expect(jobs.filter((job) => job.company === 'S&P Global')).toHaveLength(1)
  })

  it('never links to retired job requisitions', () => {
    const retired = [
      'https://careers.spglobal.com/jobs/329304?lang=en-us',
      'https://zycus.talismatic.com/jobs/JQ2742JNY',
      'https://zycus.talismatic.com/jobs/JYD4N4ZJG',
    ]
    for (const job of jobs) {
      expect(retired, job.id).not.toContain(job.redirectUrl)
    }
  })

  it('links Zycus listings through the working company job pages', () => {
    const zycus = jobs.filter((job) => job.company === 'Zycus')
    expect(zycus).toHaveLength(2)
    for (const job of zycus) {
      expect(job.redirectUrl, job.id).toMatch(
        /^https:\/\/zycus\.talismatic\.com\/zycus\/jobs\/[A-Z0-9]+$/,
      )
    }
  })

  it('keeps salary ranges positive and ordered', () => {
    for (const job of jobs) {
      if (!job.salaryRange) continue
      expect(job.salaryRange.min, job.id).toBeGreaterThan(0)
      expect(job.salaryRange.max, job.id).toBeGreaterThan(job.salaryRange.min)
      expect(job.salaryRange.currency, job.id).toBeTruthy()
    }
  })

  it('keeps posted ages non-negative when present', () => {
    for (const job of jobs) {
      if (job.postedDaysAgo === undefined) continue
      expect(job.postedDaysAgo, job.id).toBeGreaterThanOrEqual(0)
      expect(job.postedDaysAgo, job.id).toBeLessThan(400)
    }
  })

  it('uses unique skill ids across the dataset', () => {
    const ids = jobs.flatMap((job) => job.skills.map((skill) => skill.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const job of jobs) {
      const names = job.skills.map((skill) => skill.name)
      expect(new Set(names).size, job.id).toBe(names.length)
    }
  })

  it('covers every required career domain', () => {
    const domains = new Set(jobs.map((job) => job.domain))
    for (const domain of REQUIRED_DOMAINS) {
      expect(domains.has(domain), `missing domain: ${domain}`).toBe(true)
    }
  })

  it('stays focused on entry-level roles', () => {
    for (const job of jobs) {
      const level = deriveExperienceLevel(job)
      expect(['Junior', 'Mid'], `${job.id} → ${level}`).toContain(level)
    }
  })
})
