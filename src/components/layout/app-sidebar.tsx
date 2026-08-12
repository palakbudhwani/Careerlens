import { Link, NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { navGroups } from '@/data/navigation'
import { Logo } from '@/components/ui/logo'
import { useAuth } from '@/context/auth-context'


export function AppSidebar({
  onNavigate,
}: {
  onNavigate?: () => void
}) {
  // Get currently logged-in user
  const { user } = useAuth()

  return (
    <aside className="flex h-full flex-col bg-card">
      <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
        <Link
          to="/dashboard"
          onClick={onNavigate}
          aria-label="CareerLens home"
        >
          <Logo />
        </Link>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-3 py-4"
        aria-label="Primary"
      >
        {navGroups.map((group) => (
          <div
            key={group.label}
            className="mb-6 last:mb-2"
          >
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>

            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className={cn(
                            'size-[18px] shrink-0 transition-colors',
                            isActive
                              ? 'text-brand-600 dark:text-brand-400'
                              : 'text-muted-foreground group-hover:text-foreground',
                          )}
                          aria-hidden
                        />

                        <span className="flex-1 truncate">
                          {item.label}
                        </span>

                        {isActive && (
                          <span
                            className="size-1.5 shrink-0 rounded-full bg-brand-600 dark:bg-brand-400"
                            aria-hidden
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Logged-in user */}
      <div className="border-t border-border p-3">
        <Link
          to="/profile"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/70"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600/15 text-sm font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            {user?.initials || 'U'}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {user?.name || 'User'}
            </span>

            <span className="block truncate text-xs text-muted-foreground">
              {user?.title || 'Career Explorer'}
            </span>
          </span>
        </Link>
      </div>
    </aside>
  )
}