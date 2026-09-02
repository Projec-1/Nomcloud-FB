import { useState, type FormEvent } from 'react'
import { Mail, Phone, MapPin, CheckCircle2, ArrowRight } from 'lucide-react'
import SEO from '@/components/layout/SEO'
import Reveal from '@/components/marketing/Reveal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { isValidEmail, minLength, type FieldErrors } from '@/utils/validators'
import { submitContactMessage } from '@/services/contactService'
import { useToast } from '@/context/ToastContext'
import { useLanguage } from '@/context/LanguageContext'

export default function Contact() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const [form, setForm] = useState({ name: '', email: '', topic: 'General Inquiry', message: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const contactInfo = [
    { icon: Mail, label: t('contact.email'), value: 'Sul.abdulsaq@gmail.com' },
    { icon: Phone, label: t('contact.phone'), value: '+252617377918' },
    { icon: MapPin, label: t('contact.office'), value: 'Via Liberia, Mogadishu, Somalia' },
  ]

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (!minLength(form.name, 2)) next.name = t('contact.error.name')
    if (!isValidEmail(form.email)) next.email = t('contact.error.email')
    if (!minLength(form.message, 10)) next.message = t('contact.error.message')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await submitContactMessage(form)
      setSubmitted(true)
      showToast({ type: 'success', title: 'Message sent', description: 'We\'ll get back to you within one business day.' })
    } catch {
      showToast({ type: 'error', title: 'Something went wrong', description: 'Please try again in a moment.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <SEO
        title="Contact Us"
        description="Questions about Nom Cloud, pricing, or onboarding? Get in touch — our team responds within one business day."
        path="/contact"
      />
      <section className="pt-20 pb-16 sm:pt-28">
        <div className="container text-center">
          <Reveal>
            <span className="eyebrow">{t('contact.eyebrow')}</span>
            <h1 className="mx-auto mt-6 max-w-3xl text-display-lg text-ink dark:text-white">{t('contact.title')}</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-graphite">{t('contact.subtitle')}</p>
          </Reveal>
        </div>
      </section>

      <section className="pb-24">
        <div className="container grid gap-12 lg:grid-cols-5">
          <Reveal className="lg:col-span-2">
            <div className="card h-full p-8">
              <h2 className="text-lg font-semibold text-ink dark:text-white">{t('contact.getInTouch')}</h2>
              <div className="mt-6 space-y-5">
                {contactInfo.map((info) => (
                  <div key={info.label} className="flex items-start gap-4">
                    <div className="rounded-xl bg-brand/10 p-2.5 text-brand">
                      <info.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs text-graphite">{info.label}</p>
                      <p className="text-sm font-medium text-ink dark:text-white">{info.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={120} className="lg:col-span-3">
            <div className="card p-8 sm:p-10">
              {submitted ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-ink dark:text-white">{t('contact.success.title')}</h3>
                  <p className="mt-2 max-w-sm text-sm text-graphite">
                    Thank you, {form.name.split(' ')[0]}. Our team will reply to {form.email} within one business day.
                  </p>
                  <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
                    {t('contact.success.another')}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input
                      label={t('contact.name')}
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      error={errors.name}
                      placeholder="Jane Doe"
                    />
                    <Input
                      label={t('contact.emailAddress')}
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      error={errors.email}
                      placeholder="jane@school.ac.ke"
                    />
                  </div>
                  <Select label={t('contact.topic')} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                    <option>{t('contact.topic.general')}</option>
                    <option>{t('contact.topic.sales')}</option>
                    <option>{t('contact.topic.support')}</option>
                    <option>{t('contact.topic.partnerships')}</option>
                  </Select>
                  <Textarea
                    label={t('contact.message')}
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    error={errors.message}
                    placeholder={t('contact.messagePlaceholder')}
                  />
                  <Button type="submit" size="lg" loading={loading} className="w-full sm:w-auto">
                    {t('contact.send')} <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
