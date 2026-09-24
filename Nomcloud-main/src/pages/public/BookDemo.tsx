import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ArrowRight, School, Clock, Users, Sparkles } from 'lucide-react'
import SEO from '@/components/layout/SEO'
import Reveal from '@/components/marketing/Reveal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import { isValidEmail, isValidPhone, minLength, type FieldErrors } from '@/utils/validators'
import { submitDemoRequest, type DemoRequestPayload } from '@/services/demoService'
import { useToast } from '@/context/ToastContext'
import { useLanguage } from '@/context/LanguageContext'

const initialForm: DemoRequestPayload = {
  schoolName: '',
  administratorName: '',
  email: '',
  phone: '',
  schoolSize: '1–150 students',
  message: '',
}

export default function BookDemo() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [form, setForm] = useState<DemoRequestPayload>(initialForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const highlights = [
    { icon: Clock, text: t('bookDemo.highlight1') },
    { icon: Users, text: t('bookDemo.highlight2') },
    { icon: Sparkles, text: t('bookDemo.highlight3') },
  ]

  const update = (key: keyof DemoRequestPayload, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (!minLength(form.schoolName, 2)) next.schoolName = 'Please enter your school\'s name.'
    if (!minLength(form.administratorName, 2)) next.administratorName = 'Please enter your full name.'
    if (!isValidEmail(form.email)) next.email = 'Please enter a valid email address.'
    if (!isValidPhone(form.phone)) next.phone = 'Please enter a valid phone number.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await submitDemoRequest(form)
      setSubmitted(true)
    } catch {
      showToast({ type: 'error', title: 'Could not submit request', description: 'Please check your connection and try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <SEO
        title="Book a Demo"
        description="Book a personalized walkthrough of Nom Cloud tailored to your school's size and needs."
        path="/book-demo"
      />
      <section className="pt-20 pb-16 sm:pt-28">
        <div className="container grid gap-16 lg:grid-cols-5">
          <Reveal className="lg:col-span-2">
            <span className="eyebrow">{t('bookDemo.eyebrow')}</span>
            <h1 className="mt-6 text-display-md text-ink dark:text-white">{t('bookDemo.title')}</h1>
            <p className="mt-5 text-base leading-relaxed text-graphite">{t('bookDemo.subtitle')}</p>
            <div className="mt-9 space-y-5">
              {highlights.map((h) => (
                <div key={h.text} className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <h.icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm text-ink dark:text-white">{h.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft dark:bg-white/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white dark:bg-white dark:text-ink">
                <School className="h-4 w-4" />
              </div>
              <p className="text-sm text-graphite">
                {t('bookDemo.knowAlready')}{' '}
                <Link to="/signup" className="link-underline font-medium text-accent">
                  {t('bookDemo.createAccount')}
                </Link>{' '}
                {t('bookDemo.instead')}
              </p>
            </div>
          </Reveal>

          <Reveal delay={150} className="lg:col-span-3">
            <div className="card p-8 sm:p-10">
              {submitted ? (
                <div className="flex flex-col items-center py-10 text-center animate-fade-up">
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-semibold text-ink dark:text-white">{t('bookDemo.success.title')}</h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-graphite">
                    Thank you, {form.administratorName.split(' ')[0] || 'there'}. A member of our team will reach out to{' '}
                    <span className="font-medium text-ink dark:text-white">{form.email}</span> within one business day to
                    schedule your walkthrough of Nom Cloud for {form.schoolName}.
                  </p>
                  <div className="mt-8 w-full max-w-sm rounded-2xl bg-mist p-5 text-left text-sm dark:bg-white/5">
                    <p className="mb-3 font-medium text-ink dark:text-white">{t('bookDemo.summary.title')}</p>
                    <dl className="space-y-1.5 text-graphite">
                      <div className="flex justify-between">
                        <dt>{t('bookDemo.summary.school')}</dt>
                        <dd className="font-medium text-ink dark:text-white">{form.schoolName}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>{t('bookDemo.summary.contact')}</dt>
                        <dd className="font-medium text-ink dark:text-white">{form.administratorName}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>{t('bookDemo.summary.size')}</dt>
                        <dd className="font-medium text-ink dark:text-white">{form.schoolSize}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                    <Link to="/" className="btn-outline px-6 py-3 text-sm">
                      {t('bookDemo.backHome')}
                    </Link>
                    <Link to="/signup" className="btn-accent px-6 py-3 text-sm">
                      {t('bookDemo.createFreeAccount')} <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input
                      label={t('bookDemo.schoolName')}
                      required
                      value={form.schoolName}
                      onChange={(e) => update('schoolName', e.target.value)}
                      error={errors.schoolName}
                      placeholder="Riverside Academy"
                    />
                    <Input
                      label={t('bookDemo.adminName')}
                      required
                      value={form.administratorName}
                      onChange={(e) => update('administratorName', e.target.value)}
                      error={errors.administratorName}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input
                      label={t('bookDemo.email')}
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      error={errors.email}
                      placeholder="jane@riverside.ac.ke"
                    />
                    <Input
                      label={t('bookDemo.phone')}
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      error={errors.phone}
                      placeholder="+254 7XX XXX XXX"
                    />
                  </div>
                  <Select label={t('bookDemo.schoolSize')} value={form.schoolSize} onChange={(e) => update('schoolSize', e.target.value)}>
                    <option>1–150 students</option>
                    <option>151–500 students</option>
                    <option>501–1,200 students</option>
                    <option>1,200+ students</option>
                    <option>Multiple campuses</option>
                  </Select>
                  <Textarea
                    label={t('bookDemo.whatToSee')}
                    rows={4}
                    value={form.message}
                    onChange={(e) => update('message', e.target.value)}
                    placeholder="e.g. We're especially interested in fee management and the parent app…"
                  />
                  <Button type="submit" size="lg" loading={loading} className="w-full">
                    {t('bookDemo.submit')} <ArrowRight className="h-4 w-4" />
                  </Button>
                  <p className="text-center text-xs text-graphite">{t('bookDemo.disclaimer')}</p>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
