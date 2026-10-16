import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const formatters = new Map<string, Intl.NumberFormat>()

function currencyFormatter(currency: string): Intl.NumberFormat {
  const key = `${currency}`
  const existing = formatters.get(key)
  if (existing) return existing

  const formatter = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
  formatters.set(key, formatter)
  return formatter
}

export function formatCurrency(value: number, currency = 'USD'): string {
  return currencyFormatter(currency).format(value)
}

export function formatSalaryRange(min: number, max: number, currency = 'USD'): string {
  return `${formatCurrency(min, currency)} – ${formatCurrency(max, currency)}`
}
