import { fireEvent, render, screen } from '@testing-library/react'

import { describe, expect, it } from 'vitest'

import { CompanyLogo } from '@/components/jobs/company-logo'
import { resolveCompanyBrand } from '@/lib/company-logos'

describe('CompanyLogo', () => {
  it('renders the bundled logo for a mapped employer', () => {
    render(<CompanyLogo company="KPMG India" />)

    const container = screen.getByTestId('company-logo')
    expect(container.getAttribute('data-bundled')).toBe('true')
    expect(container.getAttribute('data-company')).toBe('KPMG India')

    const image = screen.getByTestId('company-logo-image')
    expect(image.getAttribute('src')).toBe(resolveCompanyBrand('KPMG India').logoSrc)
    expect(image.getAttribute('alt')).toBe('KPMG India logo')
    expect(screen.queryByTestId('company-logo-fallback')).toBeNull()
  })

  it('falls back to an initials tile when the employer has no verified logo', () => {
    render(<CompanyLogo company="Zeeve" />)

    expect(screen.queryByTestId('company-logo-image')).toBeNull()
    expect(screen.getByTestId('company-logo-fallback').textContent).toBe('ZV')
    expect(screen.getByTestId('company-logo').getAttribute('data-bundled')).toBe('false')
  })

  it('swaps to the initials tile when the image fails to load', () => {
    render(<CompanyLogo company="Wipro" />)
    expect(screen.getByTestId('company-logo-image')).toBeTruthy()

    fireEvent.error(screen.getByTestId('company-logo-image'))

    expect(screen.queryByTestId('company-logo-image')).toBeNull()
    expect(screen.getByTestId('company-logo-fallback').textContent).toBe('W')
  })

  it('renders a tile instead of crashing for an unknown company', () => {
    render(<CompanyLogo company="Totally Unknown Co" />)

    expect(screen.queryByTestId('company-logo-image')).toBeNull()
    expect(screen.getByTestId('company-logo-fallback').textContent).toBe('TU')
  })

  it('supports the larger detail-page size', () => {
    render(<CompanyLogo company="Siemens Energy" size="lg" />)
    expect(screen.getByTestId('company-logo').className).toContain('size-16')
  })
})
