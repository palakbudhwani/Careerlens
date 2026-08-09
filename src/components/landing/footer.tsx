import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { Logo } from '@/components/ui/logo'
import {
  footerCareerLinks,
  footerCompanyLinks,
  footerLegalLinks,
  footerProductLinks,
  type FooterLinkEntry,
} from '@/data/landing'

const columns: { heading: string; links: FooterLinkEntry[] }[] = [
  { heading: 'Product', links: footerProductLinks },
  { heading: 'Career tools', links: footerCareerLinks },
  { heading: 'Company', links: footerCompanyLinks },
  { heading: 'Legal', links: footerLegalLinks },
]

export function LandingFooter() {
  const [notice, setNotice] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!notice) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setNotice(null), 4200)
    return () => window.clearTimeout(timer.current)
  }, [notice])

  function showNotice(label: string) {
    setNotice(`The ${label} page is on its way — explore the product in the meantime.`)
  }

  return (
    <footer className="border-t border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Link to="/" aria-label="CareerLens home">
              <Logo />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              CareerLens is an AI-powered resume analyser that turns your CV into a clear, actionable
              career direction — from matching to skill gaps and next steps.
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {column.heading}
              </p>
              <ul className="space-y-2.5">
                {column.links.map((entry) => (
                  <li key={entry.label}>
                    {entry.to?.startsWith('/') ? (
                      <Link
                        to={entry.to}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {entry.label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => showNotice(entry.label)}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {entry.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-5 sm:flex-row">
          <p className="text-xs text-muted-foreground">© 2026 CareerLens. All rights reserved.</p>
          <p className="text-xs text-muted-foreground">
            Built for people charting their next move.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice}
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-popover"
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </footer>
  )
}