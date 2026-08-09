import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

const accentColors = {
  brand: 'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
} as const

export function MetricBar({
  label,
  value,
  accent = 'brand',
  className,
}: {
  label: string
  value: number
  accent?: keyof typeof accentColors
  className?: string
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn('h-full rounded-full', accentColors[accent])}
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  )
}