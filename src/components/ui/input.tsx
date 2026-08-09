import { forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-destructive focus-visible:border-destructive focus-visible:outline-ring/0',
        className,
      )}
      {...props}
    />
  )
})