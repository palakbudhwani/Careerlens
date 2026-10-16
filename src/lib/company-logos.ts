/**
 * Company → logo mapping for the Jobs command center.
 *
 * Every logo is an authentic asset, not a reconstruction:
 * - most come from Wikimedia Commons (public-domain or freely licensed files
 *   of the companies' official wordmarks),
 * - Zycus uses the header logo published on its own website (zycus.com).
 *
 * All files live in `src/assets/logos/` and are statically imported here, so
 * Vite bundles them with the app (no remote logo API, no third-party image
 * service, nothing fetched at runtime). Per-company provenance and licence are
 * recorded in each brand's `source` field.
 *
 * Employers whose logo could not be verified for local bundling resolve to
 * `logoSrc: null` and are rendered as an initials tile instead (see CompanyLogo).
 */

import americanExpressLogo from '@/assets/logos/american-express.svg'
import happiestMindsLogo from '@/assets/logos/happiest-minds.png'
import kpmgLogo from '@/assets/logos/kpmg.svg'
import ltLogo from '@/assets/logos/lt.svg'
import siemensEnergyLogo from '@/assets/logos/siemens-energy.svg'
import spGlobalLogo from '@/assets/logos/sp-global.svg'
import wiproLogo from '@/assets/logos/wipro.svg'
import zycusLogo from '@/assets/logos/zycus.webp'

export interface CompanyBrand {
  /** Exact `job.company` value this brand belongs to. */
  company: string
  /** Bundled authentic asset URL, or null when only an initials tile is available. */
  logoSrc: string | null
  /** Primary brand color, used for the initials tile and accents. */
  color: string
  /** 1–2 letter monogram for the fallback tile. */
  initials: string
  /** Provenance of the asset (used for reporting/audit). */
  source: string
}

const TILE_SOURCE =
  'No verified logo asset suitable for local bundling — rendered as an initials tile.'

const BRANDS: CompanyBrand[] = [
  {
    company: 'Zycus',
    logoSrc: zycusLogo,
    color: '#0B6FC4',
    initials: 'Z',
    source:
      'Official header logo published on zycus.com (“zycus-new-logo.webp”, media.zycus.com), bundled locally from src/assets/logos/.',
  },
  {
    company: 'Larsen & Toubro (L&T)',
    logoSrc: ltLogo,
    color: '#003B73',
    initials: 'LT',
    source:
      'Official wordmark from Wikimedia Commons (File:Larsen-&-Toubro-Logo.svg, public domain), bundled locally from src/assets/logos/.',
  },
  {
    company: 'Siemens Energy',
    logoSrc: siemensEnergyLogo,
    color: '#009999',
    initials: 'SE',
    source:
      'Official wordmark from Wikimedia Commons (File:Siemens Energy logo.svg, public domain), bundled locally from src/assets/logos/.',
  },
  {
    company: 'Quickhyre AI',
    logoSrc: null,
    color: '#0EA47E',
    initials: 'QH',
    source: TILE_SOURCE,
  },
  {
    company: 'Moonfire Private Limited',
    logoSrc: null,
    color: '#7C3AED',
    initials: 'MP',
    source: TILE_SOURCE,
  },
  {
    company: 'Wipro',
    logoSrc: wiproLogo,
    color: '#E4002B',
    initials: 'W',
    source:
      'Official wordmark from Wikimedia Commons (File:Wipro Primary Logo Color RGB.svg, public domain), bundled locally from src/assets/logos/.',
  },
  {
    company: 'KPMG India',
    logoSrc: kpmgLogo,
    color: '#00338D',
    initials: 'KI',
    source:
      'Official wordmark from Wikimedia Commons (File:KPMG blue logo.svg, public domain; credit kpmg.com), bundled locally from src/assets/logos/.',
  },
  {
    company: 'Happiest Minds Technologies',
    logoSrc: happiestMindsLogo,
    color: '#F7941E',
    initials: 'HM',
    source:
      'Official wordmark from Wikimedia Commons (File:HappiestMinds Logo Colour.png, CC BY-SA 4.0), bundled locally from src/assets/logos/.',
  },
  {
    company: 'Cyber Infrastructure (CIS)',
    logoSrc: null,
    color: '#2563EB',
    initials: 'CI',
    source: TILE_SOURCE,
  },
  {
    company: 'American Express',
    logoSrc: americanExpressLogo,
    color: '#006FCF',
    initials: 'AX',
    source:
      'Official wordmark from Wikimedia Commons (File:American Express logo (2018).svg, public domain; credit americanexpress.com), bundled locally from src/assets/logos/.',
  },
  {
    company: 'S&P Global',
    logoSrc: spGlobalLogo,
    color: '#0A1F44',
    initials: 'SG',
    source:
      'Official wordmark from Wikimedia Commons (File:S&P Global logo.svg, public domain; credit spglobal.com), bundled locally from src/assets/logos/.',
  },
  {
    company: 'Zeeve',
    logoSrc: null,
    color: '#4F46E5',
    initials: 'ZV',
    source: TILE_SOURCE,
  },
]

const BRAND_BY_COMPANY = new Map(BRANDS.map((brand) => [brand.company, brand]))

const NEUTRAL_COLOR = '#64748B'

/** Derive a short monogram from any company name (used by the fallback tile). */
export function companyInitials(company: string): string {
  const words = company
    .replace(/[()[\]]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9&]/gi, ''))
    .filter((word) => /[a-z0-9]/i.test(word))
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase()
}

/**
 * Resolve the brand for a company. Unknown companies never throw — they fall
 * back to a neutral initials tile so a new listing can ship without artwork.
 */
export function resolveCompanyBrand(company: string): CompanyBrand {
  const known = BRAND_BY_COMPANY.get(company)
  if (known) return known
  return {
    company,
    logoSrc: null,
    color: NEUTRAL_COLOR,
    initials: companyInitials(company),
    source: TILE_SOURCE,
  }
}

/** All brands currently mapped (reporting and tests). */
export function listCompanyBrands(): CompanyBrand[] {
  return [...BRANDS]
}

/** Light background tint for the initials tile. */
export function tileTint(color: string): string {
  return `${color}1A`
}
