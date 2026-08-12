import { useRef, useState } from 'react'

import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  MoonStar,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserCog,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { useClickOutside } from '@/hooks/use-click-outside'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/context/auth-context'
import { notifications } from '@/data/notifications'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'


function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
          transition={{ duration: 0.18 }}
          className="inline-flex"
        >
          {isDark ? (
            <Sun className="size-[18px]" aria-hidden />
          ) : (
            <MoonStar className="size-[18px]" aria-hidden />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}


function NotificationMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, () => setOpen(false))

  const unread = notifications.filter((n) => n.unread).length

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications (${unread} unread)`}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Bell className="size-[18px]" aria-hidden />

        {unread > 0 && (
          <span
            className="absolute right-2 top-2 size-2 rounded-full bg-brand-600 ring-2 ring-card dark:bg-brand-400"
            aria-hidden
          />
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-popover"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <p className="font-display text-sm font-semibold">
                Notifications
              </p>
              <BadgeDot count={unread} />
            </div>

            <Separator />

            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={cn(
                    'px-4 py-3',
                    notification.unread && 'bg-accent/40',
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        'mt-1 size-2 shrink-0 rounded-full',
                        notification.kind === 'match' && 'bg-emerald-500',
                        notification.kind === 'gap' && 'bg-amber-500',
                        notification.kind === 'system' && 'bg-brand-500',
                      )}
                      aria-hidden
                    />

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {notification.title}
                      </p>

                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {notification.description}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Separator />

            <Link
              to="/history"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-brand-600 transition-colors hover:bg-muted/60 dark:text-brand-400"
            >
              View all activity
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


function BadgeDot({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
      {count} new
    </span>
  )
}


function UserMenu() {
  const [open, setOpen] = useState(false)

  const ref = useRef<HTMLDivElement>(null)

  const navigate = useNavigate()

  // Get currently logged-in user
  const { user, logout } = useAuth()

  useClickOutside(ref, () => setOpen(false))

  const items = [
    {
      label: 'Profile',
      to: '/profile',
      icon: UserCog,
    },
    {
      label: 'Settings',
      to: '/settings',
      icon: Settings,
    },
  ]

  const handleLogout = () => {
    setOpen(false)

    // Remove token and clear authenticated user
    logout()

    // Go to login page
    navigate('/login')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-600/15 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          {user?.initials || 'U'}
        </span>

        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-popover shadow-popover"
          >
            <div className="px-4 py-3">
              <p className="truncate text-sm font-semibold text-foreground">
                {user?.name || 'User'}
              </p>

              <p className="truncate text-xs text-muted-foreground">
                {user?.email || ''}
              </p>
            </div>

            <Separator />

            <div className="p-1.5">
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted/70"
                >
                  <item.icon
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />

                  {item.label}
                </Link>
              ))}

              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


export function AppHeader({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div className="hidden h-10 w-full max-w-md items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 text-sm text-muted-foreground shadow-xs md:flex">
        <Search className="size-4" aria-hidden />

        <span className="truncate">
          Search jobs, skills, courses…
        </span>

        <span className="ml-auto hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
          ⌘K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Link to="/match" className="hidden xl:inline-flex">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={
              <Sparkles
                className="size-3.5"
                aria-hidden
              />
            }
          >
            New match
          </Button>
        </Link>

        <ThemeToggle />

        <NotificationMenu />

        <Separator
          orientation="vertical"
          className="mx-1.5 hidden h-6 sm:block"
        />

        <UserMenu />
      </div>
    </header>
  )
}