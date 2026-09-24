import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'

const STORAGE_KEY = 'nomcloud_cookie_consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  const respond = (value: 'accepted' | 'essential-only') => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // ignore storage errors — still dismiss the banner
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-4 animate-fade-up sm:p-6">
      <div className="glass mx-auto flex max-w-3xl flex-col items-start gap-4 rounded-3xl border border-ink/10 p-5 shadow-floaty dark:border-white/10 sm:flex-row sm:items-center sm:p-6">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Cookie className="h-5 w-5" />
        </div>
        <p className="flex-1 text-sm leading-relaxed text-ink dark:text-white">
          We use essential cookies to run Nom Cloud, and optional analytics cookies to improve this site. See our{' '}
          <Link to="/cookies" className="link-underline font-medium text-accent">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex w-full flex-shrink-0 gap-2 sm:w-auto">
          <button onClick={() => respond('essential-only')} className="btn-outline flex-1 justify-center px-4 py-2.5 text-xs sm:flex-none">
            Essential only
          </button>
          <button onClick={() => respond('accepted')} className="btn-accent flex-1 justify-center px-4 py-2.5 text-xs sm:flex-none">
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}
