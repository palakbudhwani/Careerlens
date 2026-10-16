import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { jobs } from '@/data/jobs'
import { readCompareSelection } from '@/lib/compare-store'
import { clearStoredResume, writeStoredResume } from '@/lib/resume-store'
import JobsPage from '@/pages/jobs'

// framer-motion's whileInView feature needs IntersectionObserver, which jsdom
// does not implement; a no-op stub keeps cards mounted and queryable.
vi.stubGlobal(
  'IntersectionObserver',
  class {
    root = null
    rootMargin = ''
    thresholds: number[] = []
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  },
)

function renderPage() {
  return render(
    <MemoryRouter>
      <JobsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  clearStoredResume()
})

function detailHrefs(): string[] {
  return screen
    .getAllByRole('link', { name: /view details/i })
    .map((link) => link.getAttribute('href') ?? '')
}

function detailIds(): string[] {
  return detailHrefs().map((href) => href.replace('/jobs/', ''))
}

function search(value: string): void {
  fireEvent.change(screen.getByPlaceholderText(/search by title/i), { target: { value } })
}

function selectByLabel(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('JobsPage', () => {
  it('lists every curated role with match and detail links', () => {
    renderPage()

    expect(screen.getByText(`${jobs.length} job listings`)).toBeTruthy()
    expect(detailHrefs()).toHaveLength(jobs.length)
    expect(screen.getAllByRole('link', { name: /analyze match/i })).toHaveLength(jobs.length)
  })

  it('shows domain badges for the new listings', () => {
    renderPage()

    // Domain badges appear on every card, and again on the featured listing.
    for (const domain of ['Cloud / DevOps', 'Data Analytics', 'Data Science', 'Frontend']) {
      expect(screen.getAllByText(domain).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('defaults to newest first with unknown posting dates last', () => {
    renderPage()

    const ids = detailIds()
    const known = jobs.filter((job) => job.postedDaysAgo !== undefined).map((job) => job.id)
    const unknown = jobs.filter((job) => job.postedDaysAgo === undefined).map((job) => job.id)

    expect(new Set(ids.slice(0, known.length))).toEqual(new Set(known))
    expect(new Set(ids.slice(known.length))).toEqual(new Set(unknown))
  })

  it('sorts by title A–Z on demand', () => {
    renderPage()

    selectByLabel('Sort jobs', 'title')

    const expected = [...jobs]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((job) => `/jobs/${job.id}`)
    expect(detailHrefs()).toEqual(expected)
  })

  it('sorts oldest first while keeping unknown dates last', () => {
    renderPage()

    selectByLabel('Sort jobs', 'oldest')

    const ids = detailIds()
    const knownOldestFirst = jobs
      .filter((job) => job.postedDaysAgo !== undefined)
      .sort((a, b) => (b.postedDaysAgo ?? 0) - (a.postedDaysAgo ?? 0))
      .map((job) => job.id)

    expect(ids.slice(0, knownOldestFirst.length)).toEqual(knownOldestFirst)
    expect(ids).toHaveLength(jobs.length)
  })

  it('filters by keyword and clears back to the full list', () => {
    renderPage()

    search('Splunk')

    const filtered = detailHrefs()
    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toContain('kpmg')

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(detailHrefs()).toHaveLength(jobs.length)
  })

  it('filters by location', () => {
    renderPage()

    selectByLabel('Filter by location', 'Pune, India')

    const hrefs = detailHrefs()
    expect(hrefs).toHaveLength(2)
    expect(hrefs.every((href) => href.includes('moonfire'))).toBe(true)
  })

  it('filters by job type', () => {
    renderPage()

    selectByLabel('Filter by job type', 'internship')

    const hrefs = detailHrefs()
    expect(hrefs).toHaveLength(1)
    expect(hrefs[0]).toContain('quickhyre')
  })

  it('shows an empty state when nothing matches', () => {
    renderPage()

    search('no-such-role-keyword')

    expect(screen.getByText('No roles match your filters')).toBeTruthy()
    expect(screen.queryAllByRole('link', { name: /view details/i })).toHaveLength(0)
    expect(screen.queryByTestId('featured-job')).toBeNull()
  })
})

describe('JobsPage command center', () => {
  it('shows the hero headline with computed listing, employer, and domain counts', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: /find your fit/i })).toBeTruthy()
    expect(screen.getByText(`${jobs.length} job listings`)).toBeTruthy()

    const employers = new Set(jobs.map((job) => job.company)).size
    const domains = new Set(jobs.map((job) => job.domain)).size
    expect(screen.getAllByText(`${employers} employers`).length).toBeGreaterThan(0)
    expect(screen.getAllByText(`${domains} domains`).length).toBeGreaterThan(0)
  })

  it('filters by category and clears back to the full list', () => {
    renderPage()

    const genAI = jobs.filter((job) => job.domain === 'GenAI')
    expect(genAI.length).toBeGreaterThan(0)

    selectByLabel('Filter by category', 'GenAI')
    expect(detailHrefs()).toHaveLength(genAI.length)

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(detailHrefs()).toHaveLength(jobs.length)
  })

  it('filters by work mode', () => {
    renderPage()

    const remote = jobs.filter((job) => job.workMode === 'remote')
    expect(remote.length).toBeGreaterThan(0)

    selectByLabel('Filter by work mode', 'remote')

    const hrefs = detailHrefs()
    expect(hrefs).toHaveLength(remote.length)
    expect(hrefs.every((href) => remote.some((job) => href.includes(job.id)))).toBe(true)
  })

  it('shows removable chips for active filters', () => {
    renderPage()

    selectByLabel('Filter by location', 'Pune, India')
    expect(detailHrefs()).toHaveLength(2)

    const chip = screen.getByRole('button', { name: /Remove Pune, India filter/i })
    fireEvent.click(chip)

    expect(detailHrefs()).toHaveLength(jobs.length)
    expect(screen.queryByRole('button', { name: /clear filters/i })).toBeNull()
  })

  it('links every card to its job detail route', () => {
    renderPage()

    const cards = screen.getAllByTestId('job-card')
    expect(cards).toHaveLength(jobs.length)

    const first = within(cards[0]).getByRole('link', { name: /view details/i })
    expect(first.getAttribute('href')).toMatch(/^\/jobs\/.+$/)
  })

  it('preserves each listing application URL on the cards and featured listing', () => {
    renderPage()

    const hrefs = screen
      .getAllByRole('link', { name: /^apply/i })
      .map((link) => link.getAttribute('href') ?? '')

    expect(new Set(hrefs)).toEqual(new Set(jobs.map((job) => job.redirectUrl)))
    for (const href of hrefs) expect(href).toMatch(/^https:\/\//)
  })

  it('features the most recently posted listing and links to its detail page', () => {
    renderPage()

    const featured = screen.getByTestId('featured-job')
    const expected = jobs
      .filter((job) => job.postedDaysAgo !== undefined)
      .sort(
        (a, b) =>
          (a.postedDaysAgo ?? 0) - (b.postedDaysAgo ?? 0) || a.title.localeCompare(b.title),
      )[0]

    expect(featured.getAttribute('data-job-id')).toBe(expected.id)
    expect(screen.getByRole('link', { name: /view full listing/i }).getAttribute('href')).toBe(
      `/jobs/${expected.id}`,
    )
    // The rule is stated both in the section header and on the card itself.
    expect(screen.getAllByText(/Featured: most recently posted/).length).toBeGreaterThanOrEqual(1)
  })

  it('saves a job, persists it, and filters down to saved roles', () => {
    renderPage()

    const job = jobs[0]
    fireEvent.click(screen.getByLabelText(`Save ${job.title}`))

    const stored = JSON.parse(window.localStorage.getItem('careerlens.savedJobs') ?? '[]')
    expect(stored).toContain(job.id)
    expect(screen.getByLabelText(`Remove ${job.title} from saved jobs`).getAttribute('aria-pressed')).toBe(
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: /Saved only \(1\)/ }))
    expect(detailHrefs()).toHaveLength(1)
    expect(detailHrefs()[0]).toContain(job.id)
  })

  it('keeps comparison selection shared and limited to three jobs', () => {
    renderPage()

    const compareButtons = screen.getAllByTestId('compare-job')
    expect(compareButtons).toHaveLength(jobs.length)

    fireEvent.click(compareButtons[0])
    fireEvent.click(compareButtons[1])
    fireEvent.click(compareButtons[2])

    expect(readCompareSelection()).toHaveLength(3)
    expect(compareButtons[0].getAttribute('aria-pressed')).toBe('true')

    // Fourth pick is blocked while three are selected.
    fireEvent.click(compareButtons[3])
    expect(readCompareSelection()).toHaveLength(3)
    expect((compareButtons[3] as HTMLButtonElement).disabled).toBe(true)
    expect((compareButtons[3] as HTMLButtonElement).title).toMatch(/limited to 3/i)

    // Removing one frees a slot again.
    fireEvent.click(compareButtons[0])
    expect(readCompareSelection()).toHaveLength(2)
    expect((compareButtons[3] as HTMLButtonElement).disabled).toBe(false)
  })

  it('invites an upload for Career Fit when no resume is loaded', () => {
    renderPage()

    expect(screen.getByTestId('career-fit')).toBeTruthy()
    expect(screen.getByText(/See how every role fits your resume/i)).toBeTruthy()
    expect(screen.getByTestId('career-fit-upload')).toBeTruthy()
    expect(screen.queryByTestId('result-source')).toBeNull()
    expect(screen.queryByTestId('career-fit-match')).toBeNull()
  })

  it('scores roles from an uploaded resume and labels the result source', () => {
    writeStoredResume({
      fileName: 'resume.pdf',
      fileSize: 2048,
      uploadedAt: new Date().toISOString(),
      parsedDetails: {
        name: 'Test User',
        email: 'test@example.com',
        skills: ['React', 'TypeScript', 'Python'],
        workExperience: [
          {
            role: 'Frontend Developer',
            company: 'Example Co',
            location: 'Remote',
            start: '2023',
            end: '2025',
            highlights: ['Built React dashboards'],
          },
        ],
        education: [{ degree: 'B.Tech', institution: 'Example University', year: '2023' }],
      },
      resumeText: 'Frontend developer with 2 years of experience in React and TypeScript.',
    })

    renderPage()

    expect(screen.getByTestId('career-fit')).toBeTruthy()
    const matches = screen.getAllByTestId('career-fit-match')
    expect(matches.length).toBeGreaterThan(0)
    expect(matches.length).toBeLessThanOrEqual(3)

    // Honest source labelling: deterministic scoring, no AI involved.
    expect(screen.getByText('Rule-based')).toBeTruthy()
    expect(screen.getByTestId('result-source')).toBeTruthy()

    // Cards pick up per-role fit badges.
    expect(screen.getAllByText(/\d+% fit/).length).toBeGreaterThan(0)
  })
})
