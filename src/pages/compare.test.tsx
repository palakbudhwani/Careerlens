import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { jobs } from '@/data/jobs'
import { readCompareSelection, writeCompareSelection } from '@/lib/compare-store'
import ComparePage from '@/pages/compare'

function renderPage() {
  return render(
    <MemoryRouter>
      <ComparePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('ComparePage', () => {
  it('restores the selection made on the Jobs page', () => {
    const [first, second] = jobs
    writeCompareSelection([first.id, second.id])

    renderPage()

    expect(screen.getByText('2 of 3 selected')).toBeTruthy()
    expect(screen.getAllByText(first.title).length).toBeGreaterThan(0)
    expect(screen.getAllByText(second.title).length).toBeGreaterThan(0)
    expect(readCompareSelection()).toEqual([first.id, second.id])
  })

  it('removes a role and writes the change back to the shared selection', () => {
    const [first, second] = jobs
    writeCompareSelection([first.id, second.id])

    renderPage()

    // The remove control appears both as a chip and on the column header.
    fireEvent.click(screen.getAllByLabelText(`Remove ${first.title} from comparison`)[0])

    expect(readCompareSelection()).toEqual([second.id])
    expect(screen.getByText('1 of 3 selected')).toBeTruthy()
  })

  it('adds a third role from the picker and blocks a fourth', () => {
    const [first, second, third, fourth] = jobs
    writeCompareSelection([first.id, second.id])

    renderPage()

    const picker = screen.getByLabelText('Add job to comparison') as HTMLSelectElement
    expect(picker.disabled).toBe(false)

    fireEvent.change(picker, { target: { value: third.id } })
    expect(readCompareSelection()).toEqual([first.id, second.id, third.id])

    const updated = screen.getByLabelText('Add job to comparison') as HTMLSelectElement
    expect(updated.disabled).toBe(true)
    expect(updated.options[0].textContent).toMatch(/Maximum 3 selected/)

    // A direct write beyond the limit is capped by the store.
    writeCompareSelection([first.id, second.id, third.id, fourth.id])
    expect(readCompareSelection()).toHaveLength(3)
  })
})
