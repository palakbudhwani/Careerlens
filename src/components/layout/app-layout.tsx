import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { AppHeader } from '@/components/layout/app-header'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { AppFooter } from '@/components/layout/app-footer'

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="hidden w-64 shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 z-30 w-64 border-r border-border bg-card">
          <AppSidebar />
        </div>
      </div>

      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <AppHeader onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
        <AppFooter />
      </div>
    </div>
  )
}