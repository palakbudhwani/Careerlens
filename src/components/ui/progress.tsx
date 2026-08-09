import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

export interface ProgressProps {
  value: number
  className?: string
  indicatorClassName?: string
}

export function Progress({ value, className, indicatorClassName }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <motion.div
        className={cn('h-full rounded-full bg-primary', indicatorClassName)}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}