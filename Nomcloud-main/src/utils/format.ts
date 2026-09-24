export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', opts)
  } catch {
    return iso
  }
}

export function formatDateShort(iso: string): string {
  return formatDate(iso, { month: 'short', day: 'numeric' })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCurrencyPrecise(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('')
}

export function timeAgo(iso: string): string {
  const now = new Date().getTime()
  const then = new Date(iso).getTime()
  const diffMs = now - then
  const diffMins = Math.round(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.round(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDateShort(iso)
}

export function percentage(value: number, max: number): number {
  if (max === 0) return 0
  return Math.round((value / max) * 100)
}

/**
 * Money in the school's own currency.
 *
 * Phase 8 batch 6. `formatCurrency` and `formatCurrencyPrecise` hardcode USD,
 * which was fine while every figure came from a mock seed. Real fee_records and
 * fee_payments each carry their own `currency` column, defaulted from the
 * school, so a school billing in SOS would otherwise have every amount labelled
 * with a dollar sign. Both older helpers are left untouched for the screens that
 * still use them.
 */
export function formatMoney(amount: number, currency: string, precise = false): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: precise ? 2 : 0,
      maximumFractionDigits: precise ? 2 : 0,
    }).format(amount)
  } catch {
    // An unknown or malformed currency code must not blank out a balance.
    return `${currency} ${amount.toFixed(precise ? 2 : 0)}`
  }
}
