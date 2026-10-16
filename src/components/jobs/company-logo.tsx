import { useState } from 'react'

import { resolveCompanyBrand, tileTint } from '@/lib/company-logos'
import { cn } from '@/lib/utils'

export type CompanyLogoSize = 'md' | 'lg'

const sizeStyles: Record<CompanyLogoSize, string> = {
  md: 'size-12',
  lg: 'size-16',
}

const initialSizeStyles: Record<CompanyLogoSize, string> = {
  md: 'text-sm',
  lg: 'text-lg',
}

export interface CompanyLogoProps {
  /** Exact `job.company` value — resolved through the local brand mapping. */
  company: string
  size?: CompanyLogoSize
  className?: string
}

/**
 * Employers logo slot for job cards, the featured listing, job detail, and
 * comparison. Uses a bundled logo image when one exists; otherwise (or when the image
 * fails to load) it renders an initials tile so identity is never lost.
 *
 * Containers are 48px (md) or 64px (lg) with `object-fit: contain`.
 */
export function CompanyLogo({ company, size = 'md', className }: CompanyLogoProps) {
  const [failed, setFailed] = useState(false)
  const brand = resolveCompanyBrand(company)
  const showLogo = Boolean(brand.logoSrc) && !failed

  return (
    <div
      data-testid="company-logo"
      data-company={company}
      data-bundled={showLogo ? 'true' : 'false'}
      title={company}
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card p-1.5',
        sizeStyles[size],
        className,
      )}
    >
      {showLogo ? (
        <img
          src={brand.logoSrc ?? undefined}
          alt={`${company} logo`}
          onError={() => setFailed(true)}
          data-testid="company-logo-image"
          className="size-full object-contain"
        />
      ) : (
        <span
          data-testid="company-logo-fallback"
          aria-label={`${company} monogram`}
          className={cn(
            'flex size-full items-center justify-center rounded-lg font-display font-bold',
            initialSizeStyles[size],
          )}
          style={{ color: brand.color, backgroundColor: tileTint(brand.color) }}
        >
          {brand.initials}
        </span>
      )}
    </div>
  )
}
