import { motion, useReducedMotion } from 'framer-motion'
import { useId, type ReactNode } from 'react'

import { CountUp } from '@/components/landing/count-up'
import { cn } from '@/lib/utils'

export function ScoreRing({
  value,
  size = 96,
  stroke = 9,
  suffix = '%',
  label,
  className,
}: {
  value: number
  size?: number
  stroke?: number
  suffix?: string
  label?: ReactNode
  className?: string
}) {
  const id = useId()
  const reduced = useReducedMotion()
  const radius = (size - stroke) / 2
  const center = size / 2
  const endValue = Math.min(100, Math.max(0, value)) / 100

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#635cf0" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#${id}-stroke)`}
          initial={{ pathLength: reduced ? endValue : 0 }}
          whileInView={{ pathLength: endValue }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-bold tracking-tight">
          <CountUp value={value} suffix={suffix} />
        </span>
        {label && (
          <span className="mt-0.5 px-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}