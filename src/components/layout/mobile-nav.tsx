import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

import { AppSidebar } from '@/components/layout/app-sidebar'

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-sm lg:hidden"
            aria-hidden
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-card-lg lg:hidden"
            role="dialog"
            aria-label="Navigation"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="absolute right-3 top-4 z-10 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              <X className="size-5" aria-hidden />
            </button>
            <AppSidebar onNavigate={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}