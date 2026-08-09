import { useId, type HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export function LogoMark({
  size = 28,
  className,
  ...props
}: { size?: number } & HTMLAttributes<HTMLSpanElement>) {
  const id = useId()
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden
      {...props}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id={`${id}-fill`} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7f88f6" />
            <stop offset="0.5" stopColor="#635cf0" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill={`url(#${id}-fill)`} />
        <circle cx="16" cy="16" r="6.2" fill="#ffffff" fillOpacity="0.92" />
        <circle cx="16" cy="16" r="2.4" fill="#4f42e3" />
        <path
          d="M10.4 14.6l-2.7-1M21.6 14.6l2.7-1M16.6 9.8l-.6-2.8M16.6 22.2l.6 2.8"
          stroke="#ffffff"
          strokeOpacity="0.75"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

export function Logo({
  size = 28,
  withText = true,
  className,
  textClassName,
}: {
  size?: number
  withText?: boolean
  className?: string
  textClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      {withText && (
        <span
          className={cn(
            'font-display text-lg font-bold tracking-tight text-foreground',
            textClassName,
          )}
        >
          CareerLens
        </span>
      )}
    </span>
  )
}