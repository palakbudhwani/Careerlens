import { AnimatePresence, motion } from 'framer-motion'
import { Menu, MoonStar, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { navAnchors } from '@/data/landing'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'

function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
    >
      {isDark ? <Sun className="size-[18px]" aria-hidden /> : <MoonStar className="size-[18px]" aria-hidden />}
    </button>
  )
}

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md transition-colors duration-300',
        scrolled ? 'border-border' : 'border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0" aria-label="CareerLens home">
          <Logo />
        </Link>

        <nav className="ml-3 hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {navAnchors.map((anchor) => (
            <a
              key={anchor.href}
              href={anchor.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              {anchor.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link to="/login" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/dashboard" className="hidden sm:block">
            <Button size="sm">Open the app</Button>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground lg:hidden"
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-border bg-background lg:hidden"
            aria-label="Mobile"
          >
            <div className="space-y-1 px-4 py-4">
              {navAnchors.map((anchor) => (
                <a
                  key={anchor.href}
                  href={anchor.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/70"
                >
                  {anchor.label}
                </a>
              ))}
              <div className="!mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <Link to="/login" onClick={() => setMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Sign in
                  </Button>
                </Link>
                <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                  <Button className="w-full">Open the app</Button>
                </Link>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}