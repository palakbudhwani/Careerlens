import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { LoaderCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-sm hover:bg-brand-700 focus-visible:outline-ring dark:hover:bg-brand-500',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground',
  ghost: 'text-foreground hover:bg-muted/70',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-red-600 shadow-sm',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-6 text-sm',
  icon: 'size-10',
}

const baseStyles =
  'inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-55'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, leftIcon, rightIcon, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading ? rightIcon : null}
    </button>
  )
})