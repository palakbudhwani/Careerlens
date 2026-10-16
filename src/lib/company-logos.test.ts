import { describe, expect, it } from 'vitest'

import { jobs } from '@/data/jobs'
import {
  companyInitials,
  listCompanyBrands,
  resolveCompanyBrand,
} from '@/lib/company-logos'

const TILE_COMPANIES = [
  'Moonfire Private Limited',
  'Quickhyre AI',
  'Cyber Infrastructure (CIS)',
  'Zeeve',
]

describe('company logo mapping', () => {
  it('covers every employer used by the job dataset', () => {
    const companies = new Set(jobs.map((job) => job.company))
    expect(companies.size).toBeGreaterThanOrEqual(10)

    for (const company of companies) {
      const brand = resolveCompanyBrand(company)
      expect(brand.company, company).toBeTruthy()
      expect(brand.initials, company).toBeTruthy()
      expect(brand.color, company).toMatch(/^#[0-9a-f]{6}$/i)
      expect(brand.source, company).toBeTruthy()
    }
  })

  it('bundles every mapped logo locally with no remote URLs', () => {
    // Each logoSrc comes from a static `import` in company-logos.ts, so the
    // asset itself must exist for this module (and this test) to load at all.
    const bundled = listCompanyBrands().filter((brand) => brand.logoSrc)
    expect(bundled.length).toBeGreaterThanOrEqual(8)

    for (const brand of bundled) {
      expect(brand.logoSrc, brand.company).toBeTruthy()
      expect(brand.logoSrc, brand.company).not.toMatch(/^https?:\/\//)
      expect(brand.source, brand.company).toMatch(/bundled/i)
    }
  })

  it('uses an initials tile only where no logo could be verified', () => {
    const tiles = listCompanyBrands()
      .filter((brand) => brand.logoSrc === null)
      .map((brand) => brand.company)

    expect(tiles).toHaveLength(TILE_COMPANIES.length)
    for (const company of TILE_COMPANIES) expect(tiles).toContain(company)

    for (const brand of listCompanyBrands().filter((b) => b.logoSrc === null)) {
      expect(brand.source, brand.company).toMatch(/initials tile/)
    }
  })

  it('never throws for an unknown company', () => {
    const brand = resolveCompanyBrand('Completely Unknown Co')
    expect(brand.logoSrc).toBeNull()
    expect(brand.initials).toBeTruthy()
    expect(brand.color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('derives readable monograms from company names', () => {
    expect(companyInitials('S&P Global')).toBe('SG')
    expect(companyInitials('Larsen & Toubro (L&T)')).toBe('LT')
    expect(companyInitials('Moonfire Private Limited')).toBe('MP')
    expect(companyInitials('Acme')).toBe('AC')
    expect(companyInitials('   ')).toBe('?')
  })
})
