import SEO from '@/components/layout/SEO'
import Reveal from '@/components/marketing/Reveal'
import { useLanguage } from '@/context/LanguageContext'

const sections = [
  {
    title: 'What are cookies?',
    body: 'Cookies are small pieces of data stored in your browser. Nom Cloud uses them to keep you signed in, remember your theme and language preference, and understand how the marketing site is used.',
  },
  {
    title: 'Essential cookies',
    body: 'Required for the platform to function — keeping you logged in and remembering your role. These cannot be disabled without breaking core functionality.',
  },
  {
    title: 'Preference cookies',
    body: 'Remember choices like dark mode and language, so you don\'t need to reselect them on every visit.',
  },
  {
    title: 'Analytics cookies',
    body: 'Help us understand which pages are useful so we can improve the marketing site. These are optional and can be declined below.',
  },
  {
    title: 'Managing your preference',
    body: 'You can change your cookie preference at any time by clicking "Cookie Preferences" in the footer.',
  },
]

export default function Cookies() {
  const { t } = useLanguage()
  return (
    <div>
      <SEO title="Cookie Policy" description="How Nom Cloud uses essential, preference and analytics cookies across the site." path="/cookies" />
      <section className="pt-20 pb-12 sm:pt-28">
        <div className="container max-w-3xl text-center">
          <Reveal>
            <span className="eyebrow">{t('legal.badge')}</span>
            <h1 className="mx-auto mt-6 text-display-lg text-ink dark:text-white">{t('legal.cookies.title')}</h1>
            <p className="mx-auto mt-6 text-base text-graphite">{t('legal.cookies.subtitle')}</p>
          </Reveal>
        </div>
      </section>
      <section className="pb-24">
        <div className="container max-w-3xl">
          <Reveal className="card space-y-8 p-8 sm:p-12">
            {sections.map((s) => (
              <div key={s.title}>
                <h2 className="text-lg font-semibold text-ink dark:text-white">{s.title}</h2>
                <p className="mt-2.5 text-sm leading-relaxed text-graphite">{s.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>
    </div>
  )
}
