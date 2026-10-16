import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { jobs } from '@/data/jobs'
import { readCompareSelection } from '@/lib/compare-store'
import JobDetailPage from '@/pages/job-detail'

function renderDetail(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/jobs/${id}`]}>
      <Routes>
        <Route path="/jobs/:id" element={<JobDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const job = jobs.find((entry) => entry.salaryRange && entry.postedDaysAgo !== undefined) ?? jobs[0]

beforeEach(() => {
  window.localStorage.clear()
})

describe('JobDetailPage', () => {
  it('shows every verified detail of the listing', () => {
    renderDetail(job.id)

    expect(screen.getByRole('heading', { level: 1, name: job.title })).toBeTruthy()
    expect(screen.getAllByText(job.company).length).toBeGreaterThan(0)
    expect(screen.getAllByText(job.location).length).toBeGreaterThan(0)
    expect(screen.getByText(`Source: ${job.source}`)).toBeTruthy()

    if (job.salaryRange) {
      expect(screen.getAllByText(/₹|\$|€|£/).length).toBeGreaterThan(0)
    }
    if (job.postedDaysAgo !== undefined) {
      expect(
        screen.getByText(
          `Posted ${job.postedDaysAgo} ${job.postedDaysAgo === 1 ? 'day' : 'days'} ago`,
        ),
      ).toBeTruthy()
    }

    expect(screen.getByRole('heading', { name: 'Requirements' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Skills' })).toBeTruthy()
  })

  it('preserves the original application URL', () => {
    renderDetail(job.id)

    const apply = screen.getByRole('link', { name: /Apply on Original Website/i })
    expect(apply.getAttribute('href')).toBe(job.redirectUrl)
    expect(apply.getAttribute('target')).toBe('_blank')
    expect(apply.getAttribute('rel')).toContain('noopener')
  })

  it('renders the company logo slot with a bundled image or monogram', () => {
    renderDetail(job.id)

    const logo = screen.getByTestId('company-logo')
    expect(logo.getAttribute('data-company')).toBe(job.company)
    const bundled = logo.getAttribute('data-bundled')
    const image = screen.queryByTestId('company-logo-image')
    const fallback = screen.queryByTestId('company-logo-fallback')
    expect(bundled === 'true' ? image : fallback).toBeTruthy()
  })

  it('offers save, comparison, and match-analysis entry points', () => {
    renderDetail(job.id)

    const save = screen.getByTestId('save-job-detail')
    expect(save.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(save)
    expect(save.getAttribute('aria-pressed')).toBe('true')
    const stored = JSON.parse(window.localStorage.getItem('careerlens.savedJobs') ?? '[]')
    expect(stored).toContain(job.id)

    fireEvent.click(screen.getByTestId('compare-job-detail'))
    expect(readCompareSelection()).toContain(job.id)

    expect(screen.getAllByRole('link', { name: /Analyze Match/i })[0].getAttribute('href')).toBe(
      `/match/${job.id}`,
    )
    expect(screen.getAllByRole('link', { name: /View comparison/i })[0].getAttribute('href')).toBe(
      '/compare',
    )
  })

  it('shows an empty state for an unknown listing', () => {
    renderDetail('does-not-exist')

    expect(screen.getByText('Role not found')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Browse all jobs/i })).toBeTruthy()
  })
})
