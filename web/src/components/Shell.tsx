import type { ReactNode } from 'react'
import { Home, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'

interface ShellProps {
  children: ReactNode
}

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/account', label: 'Account', icon: User },
] as const

export function Shell({ children }: ShellProps) {
  return (
    <div className="relative min-h-[100dvh]">
      <div className="mx-auto max-w-[1540px] px-2 pt-1 sm:px-4 lg:px-8 lg:py-8">
        <div className="min-h-[100dvh] pb-14 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-7 lg:pb-0">
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex lg:min-h-[calc(100dvh-4rem)] lg:flex-col lg:gap-5 lg:rounded-[2rem] lg:border lg:border-[var(--line)] lg:bg-[var(--glass-strong)] lg:p-6 lg:shadow-[var(--shadow-soft)] lg:backdrop-blur-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--glass)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[var(--accent-deep)]">
              slowdown
            </div>

            <nav className="space-y-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex w-full items-center gap-3 rounded-[1rem] px-4 py-3 text-left text-sm font-semibold transition duration-200 ${
                      isActive
                        ? 'border border-[var(--accent-soft)] bg-[var(--accent-gradient)] text-[var(--ink)] shadow-[var(--shadow-card)]'
                        : 'border border-transparent text-[var(--muted)] hover:bg-[var(--glass-hover)] hover:text-[var(--ink)]'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto text-[0.65rem] text-[var(--muted)]">
              Part of{' '}
              <a
                href="https://freeappstore.online"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[var(--ink)]"
              >
                FreeAppStore
              </a>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile dock */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--dock)]/92 px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1 backdrop-blur-2xl lg:hidden">
        <div className="mx-auto grid max-w-xs grid-cols-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 rounded-[1rem] px-2 py-2 text-center ${
                  isActive
                    ? 'bg-[var(--ink)] text-[var(--paper)] shadow-[var(--shadow-card)]'
                    : 'text-[var(--muted)]'
                }`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={1.7} />
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.14em]">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
