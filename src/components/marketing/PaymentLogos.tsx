import { useEffect, useState } from 'react'
import { DeviceMobile as Smartphone, Bank as Landmark, PaperPlaneTilt as Send } from '@phosphor-icons/react'

// Payment methods accepted for parent fee payments, ordered from most to least widely
// recognized in the Somali / East African market.
//
// Mastercard and PayPal use their real brand marks (via the open-source Simple Icons
// CDN) — displaying a card network's mark to show it's accepted is standard merchant
// practice worldwide and doesn't imply a special partnership.
//
// EVC Plus, Dahabshiil, WAAFI, eDahab, Premier Bank, Salaam Somali Bank and the
// International Bank of Somalia are regional mobile-money and banking brands whose
// official logo artwork isn't available to us here. Rather than guess at (and risk
// misrepresenting) their registered marks, each gets a clean, original wordmark badge
// in the brand's own colors instead — clearly a Nom Cloud-drawn badge, not a copy of
// their trademark.
export type PaymentMethod = {
  name: string
  tint: string
  kind: 'mark' | 'wordmark'
  markSrc?: string
  icon?: typeof Smartphone
  imageSrc?: string
}

export const paymentMethods: PaymentMethod[] = [
  { name: 'EVC Plus', tint: '#F7A81B', kind: 'wordmark', icon: Smartphone, imageSrc: '/EVC-PLUS-Logo-01-230x128.png' },
  { name: 'Mastercard', tint: '#000000', kind: 'mark', markSrc: 'https://cdn.jsdelivr.net/npm/simple-icons@14.11.1/icons/mastercard.svg', imageSrc: '/MasterCard_early_1990s_logo.png' },
  { name: 'Dahabshiil', tint: '#0071E3', kind: 'wordmark', icon: Send, imageSrc: '/DahabshiilBank_unnamed-removebg-preview.png' },
  { name: 'PayPal', tint: '#FFFFFF', kind: 'mark', markSrc: 'https://cdn.jsdelivr.net/npm/simple-icons@14.11.1/icons/paypal.svg', imageSrc: '/PayPal.svg.webp' },
  { name: 'WAAFI', tint: '#1DA1E8', kind: 'wordmark', icon: Smartphone, imageSrc: '/WAAFI%20LOGOremovebg-preview.png' },
  { name: 'eDahab', tint: '#FF5A1F', kind: 'wordmark', icon: Smartphone, imageSrc: '/new_edahabplus_logo-c6461d7c.png' },
  { name: 'Premier Bank', tint: '#0B3D2E', kind: 'wordmark', icon: Landmark, imageSrc: '/premier-bank.png' },
  { name: 'Salaam Somali Bank', tint: '#0E7C61', kind: 'wordmark', icon: Landmark, imageSrc: '/salaam%20somali%20banklogo-copy.png' },
  { name: 'International Bank of Somalia', tint: '#5B3A9B', kind: 'wordmark', icon: Landmark, imageSrc: '/International%20bank%20of%20somalia.png' },
]

export function PaymentBadge({ method, dark = true }: { method: PaymentMethod; dark?: boolean }) {
  const logoSrc = method.imageSrc ?? method.markSrc

  return (
    <div className="flex h-14 w-40 shrink-0 items-center justify-center px-4">
      <img
        src={logoSrc}
        alt={`${method.name} logo`}
        className="h-9 w-full max-w-[136px] object-contain object-center select-none opacity-80"
        style={{
          filter: dark ? 'grayscale(1) brightness(1.18) contrast(1.1)' : 'grayscale(1) contrast(1.05)',
          background: 'transparent',
          transform: 'none',
        }}
        loading="lazy"
      />
    </div>
  )
}

export function PaymentMarquee() {
  const [paused, setPaused] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncPreference = () => setPaused(preference.matches)
    syncPreference()
    preference.addEventListener('change', syncPreference)
    return () => preference.removeEventListener('change', syncPreference)
  }, [])

  return (
    <div
      role="region"
      aria-label="Accepted payment methods"
      className={`payment-marquee ${paused ? 'is-paused' : ''}`}
    >
      <div className="payment-marquee__viewport">
        <div className="payment-marquee__track">
          <div className="payment-marquee__group">
            {paymentMethods.map((method) => <PaymentBadge key={method.name} method={method} />)}
          </div>
          <div className="payment-marquee__group" aria-hidden="true">
            {paymentMethods.map((method) => <PaymentBadge key={`duplicate-${method.name}`} method={method} />)}
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label={paused ? 'Resume payment logo motion' : 'Pause payment logo motion'}
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
        className="mx-auto mt-2 block min-h-11 px-3 text-xs font-medium text-graphite underline underline-offset-4 hover:text-ink dark:hover:text-white"
      >
        {paused ? 'Play animation' : 'Pause animation'}
      </button>
    </div>
  )
}
