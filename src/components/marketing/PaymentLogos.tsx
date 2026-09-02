import { Smartphone, Landmark, Send } from 'lucide-react'

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

  const isPayPal = method.name === 'PayPal'

  return (
    <div className="flex flex-shrink-0 items-center justify-center">
      <img
        src={logoSrc}
        alt={`${method.name} logo`}
        className="h-7 w-auto max-w-[120px] object-contain object-center select-none opacity-85"
        style={{
          filter: isPayPal ? 'grayscale(1) brightness(1.18) contrast(1.1)' : 'grayscale(1) brightness(1.18) contrast(1.1)',
          background: 'transparent',
          transform: 'none',
        }}
        loading="lazy"
      />
    </div>
  )
}
