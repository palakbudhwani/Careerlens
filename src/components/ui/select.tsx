import { forwardRef, type SelectHTMLAttributes } from 'react'

import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-lg border border-input bg-card pl-3.5 pr-9 text-sm text-foreground shadow-xs transition-colors focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  )
})