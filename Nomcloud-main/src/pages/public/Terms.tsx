import SEO from '@/components/layout/SEO'
import Reveal from '@/components/marketing/Reveal'
import { useLanguage } from '@/context/LanguageContext'

const sections = [
  {
    title: '1. Using Nom Cloud',
    body: 'By creating an account, you agree to use Nom Cloud only for legitimate school administration, teaching and parenting purposes, and to keep your login credentials confidential.',
  },
  {
    title: '2. School accounts',
    body: 'A school administrator account is responsible for the accuracy of data entered for that school, and for granting appropriate access to teachers and parents.',
  },
  {
    title: '3. Payments',
    body: 'Fee payments made through Nom Cloud are processed via the payment method the parent selects. Nom Cloud is not a bank; it facilitates payment initiation and records the outcome on behalf of the school.',
  },
  {
    title: '4. Acceptable use',
    body: 'You may not use Nom Cloud to send harmful, harassing, or fraudulent communications, or to attempt to access data outside your assigned role.',
  },
  {
    title: '5. Service availability',
    body: 'We aim for high uptime but do not guarantee uninterrupted service. We\'ll communicate planned maintenance in advance where possible.',
  },
  {
    title: '6. Termination',
    body: 'A school may close its account at any time and request a full data export beforehand. We may suspend accounts used in violation of these terms.',
  },
  {
    title: '7. Limitation of liability',
    body: 'Nom Cloud is provided "as is." To the extent permitted by law, we are not liable for indirect damages arising from use of the platform.',
  },
  {
    title: '8. Contact',
    body: 'Questions about these terms can be sent to hello@nomcloud.academy.',
  },
]

export default function Terms() {
  const { t } = useLanguage()
  return (
    <div>
      <SEO title="Terms of Service" description="The terms governing use of the Nom Cloud platform by schools, teachers and parents." path="/terms" />
      <section className="pt-20 pb-12 sm:pt-28">
        <div className="container max-w-3xl text-center">
          <Reveal>
            <span className="eyebrow">{t('legal.badge')}</span>
            <h1 className="mx-auto mt-6 text-display-lg text-ink dark:text-white">{t('legal.terms.title')}</h1>
            <p className="mx-auto mt-6 text-base text-graphite">{t('legal.effective')}</p>
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
