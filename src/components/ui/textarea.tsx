import { forwardRef, type TextareaHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-destructive',
        className,
      )}
      {...props}
    />
  )
})