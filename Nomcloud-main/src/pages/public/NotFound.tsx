import { Link } from 'react-router-dom'
import { ArrowRight, Compass } from 'lucide-react'
import SEO from '@/components/layout/SEO'
import { useLanguage } from '@/context/LanguageContext'

export default function NotFound() {
  const { t } = useLanguage()
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <SEO title="Page Not Found" description="The page you're looking for may have been moved or never existed." path="/404" />
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Compass className="h-7 w-7" />
      </div>
      <p className="text-sm font-semibold uppercase tracking-wider text-graphite">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink dark:text-white">{t('notfound.title')}</h1>
      <p className="mt-3 max-w-md text-sm text-graphite">{t('notfound.body')}</p>
      <Link to="/" className="btn-primary mt-8 px-6 py-3 text-sm">
        {t('notfound.back')} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
