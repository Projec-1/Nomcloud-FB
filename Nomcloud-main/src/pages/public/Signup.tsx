import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react'
import AuthLayout from '@/components/layout/AuthLayout'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import RequestProcessing from '@/components/ui/RequestProcessing'
import { supabase } from '@/lib/supabase'
import { isValidEmail, isValidPhone, minLength, type FieldErrors } from '@/utils/validators'
import { queueEmail } from '@/services/emailOutbox'
import { buildClientRequestEmail } from '@/services/emailTemplate'

type Position = 'Administrator' | 'Principal' | 'Director' | 'Owner' | 'Other'

interface ApplicationForm {
  fullName: string
  email: string
  phone: string
  position: Position | ''
  schoolName: string
  country: string
  schoolAddress: string
  campusCount: string
  studentRange: string
  classRange: string
  staffRange: string
  curriculum: string
  currentSystem: string
  reasons: string[]
}

const initialForm: ApplicationForm = {
  fullName: '',
  email: '',
  phone: '',
  position: '',
  schoolName: '',
  country: '',
  schoolAddress: '',
  campusCount: '',
  studentRange: '',
  classRange: '',
  staffRange: '',
  curriculum: '',
  currentSystem: '',
  reasons: [],
}

const positions: Position[] = ['Administrator', 'Principal', 'Director', 'Owner', 'Other']
const campusRanges = ['1', '2–3', '4–6', '7+']
const studentRanges = ['1–150', '151–500', '501–1,000', '1,001+']
const classRanges = ['1–10', '11–30', '31–60', '61+']
const staffRanges = ['1–10', '11–30', '31–75', '76+']
const reasons = [
  'Bring school operations into one system',
  'Improve teaching and learning coordination',
  'Give families better visibility',
  'Support multiple campuses',
  'Replace spreadsheets or disconnected tools',
  'Improve reporting and decision-making',
]

export default function Signup() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<ApplicationForm>(initialForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const update = <K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const validateStep = (currentStep: number): boolean => {
    const next: FieldErrors = {}

    if (currentStep === 1) {
      if (!minLength(form.fullName, 2)) next.fullName = 'Please enter your full name.'
      if (!isValidEmail(form.email)) next.email = 'Please enter a valid email address.'
      if (!isValidPhone(form.phone)) next.phone = 'Please enter a valid phone number.'
      if (!form.position) next.position = 'Please select your position.'
    }

    if (currentStep === 2) {
      if (!minLength(form.schoolName, 2)) next.schoolName = 'Please enter your school name.'
      if (!/^[A-Za-z]{2}$/.test(form.country.trim())) next.country = 'Enter a two-letter country code, such as SO or KE.'
      if (!minLength(form.schoolAddress, 3)) next.schoolAddress = 'Please enter identifying details for the school.'
    }

    if (currentStep === 3) {
      if (!form.campusCount) next.campusCount = 'Please select the number of campuses.'
      if (!form.studentRange) next.studentRange = 'Please select the student range.'
      if (!form.classRange) next.classRange = 'Please select the class range.'
      if (!form.staffRange) next.staffRange = 'Please select the teachers/staff range.'
      if (!minLength(form.curriculum, 2)) next.curriculum = 'Please describe the curriculum.'
      if (!minLength(form.currentSystem, 2)) next.currentSystem = 'Please describe the current system.'
      if (form.reasons.length === 0) next.reasons = 'Select at least one reason.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const nextStep = () => {
    if (validateStep(step)) setStep((current) => Math.min(current + 1, 4))
  }

  const previousStep = () => {
    setErrors({})
    setStep((current) => Math.max(current - 1, 1))
  }

  const toggleReason = (reason: string) => {
    update('reasons', form.reasons.includes(reason)
      ? form.reasons.filter((item) => item !== reason)
      : [...form.reasons, reason])
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitError('')
    if (!validateStep(3)) {
      setStep(3)
      return
    }

    setLoading(true)
    const { error } = await supabase.from('school_applications').insert({
      school_name: form.schoolName.trim(),
      administrator_name: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      school_size_band: form.studentRange,
      country: form.country.trim().toUpperCase(),
      applicant_position: form.position,
      school_address: form.schoolAddress.trim(),
      campus_count: form.campusCount,
      student_count_band: form.studentRange,
      class_count_band: form.classRange,
      staff_count_band: form.staffRange,
      curriculum: form.curriculum.trim(),
      current_system: form.currentSystem.trim(),
      reasons: form.reasons,
      status: 'pending',
    })

    if (error) {
      setSubmitError('We could not submit your application. Please check your details and try again.')
      setLoading(false)
      return
    }

    try {
      queueEmail(buildClientRequestEmail({
        schoolName: form.schoolName.trim(),
        contactName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        studentCount: form.studentRange,
        message: `Application for ${form.position}. Curriculum: ${form.curriculum.trim()}. Current system: ${form.currentSystem.trim()}.`,
        submittedAt: new Date().toISOString(),
      }))
    } catch (queueError) {
      console.error('[NomCloud] School application saved but notification queue failed.', queueError)
    }

    setLoading(false)
    setSubmitted(true)
  }

  if (loading) {
    return (
      <AuthLayout title="Application in progress" subtitle="Please keep this window open while we submit your school details.">
        <RequestProcessing title="Submitting your school application" description="Your information is being securely sent for review." />
      </AuthLayout>
    )
  }

  if (submitted) {
    return (
      <AuthLayout title="Your application is under review" subtitle="Thank you for your interest in Nom Cloud.">
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-500" />
          <p className="mt-5 text-sm leading-relaxed text-graphite">
            We have received your school application. Our team will review it and contact you using the details provided.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-graphite">
            When your school is approved, you will receive an email to activate your account.
          </p>
          <div className="mt-6 w-full rounded-2xl bg-mist p-5 text-left text-sm dark:bg-white/5">
            <p className="mb-3 font-medium text-ink dark:text-white">Application summary</p>
            <dl className="space-y-1.5 text-graphite">
              <div className="flex justify-between gap-4"><dt>School</dt><dd className="text-right font-medium text-ink dark:text-white">{form.schoolName}</dd></div>
              <div className="flex justify-between gap-4"><dt>Contact</dt><dd className="text-right font-medium text-ink dark:text-white">{form.fullName}</dd></div>
              <div className="flex justify-between gap-4"><dt>Email</dt><dd className="text-right font-medium text-ink dark:text-white">{form.email}</dd></div>
            </dl>
          </div>
          <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/login" className="sm:w-auto">
              <Button variant="accent" className="w-full sm:w-auto">
                Back to sign in <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/" className="sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                Back to home
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Apply for Nom Cloud"
      subtitle="Tell us about yourself and your school. This application does not create an account."
    >
      <div className="mb-8 flex items-center gap-2" aria-label={`Step ${step} of 4`}>
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? 'bg-accent' : 'bg-ink/10 dark:bg-white/10'}`} />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold text-ink dark:text-white">About you</h2>
            <Input label="Full name" name="fullName" required value={form.fullName} onChange={(event) => update('fullName', event.target.value)} error={errors.fullName} />
            <Input label="Email address" name="email" type="email" required value={form.email} onChange={(event) => update('email', event.target.value)} error={errors.email} />
            <Input label="Phone number" name="phone" type="tel" required value={form.phone} onChange={(event) => update('phone', event.target.value)} error={errors.phone} />
            <Select label="Your position" name="position" required value={form.position} onChange={(event) => update('position', event.target.value as Position)} error={errors.position}>
              <option value="">Select your position</option>
              {positions.map((position) => <option key={position} value={position}>{position}</option>)}
            </Select>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold text-ink dark:text-white">Your school</h2>
            <Input label="School name" name="schoolName" required value={form.schoolName} onChange={(event) => update('schoolName', event.target.value)} error={errors.schoolName} />
            <Input label="Country code" name="country" required maxLength={2} value={form.country} onChange={(event) => update('country', event.target.value.toUpperCase())} error={errors.country} hint="Use the two-letter code, such as SO or KE." />
            <Textarea label="School address and identifying details" name="schoolAddress" required value={form.schoolAddress} onChange={(event) => update('schoolAddress', event.target.value)} error={errors.schoolAddress} placeholder="City, neighbourhood, postal address, or other details that identify your school." />
            {/* A searchable Ministry directory is a future enhancement; it is not built here. */}
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-semibold text-ink dark:text-white">School scale</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Select label="Number of campuses" name="campusCount" required value={form.campusCount} onChange={(event) => update('campusCount', event.target.value)} error={errors.campusCount}>
                <option value="">Select a range</option>
                {campusRanges.map((range) => <option key={range} value={range}>{range}</option>)}
              </Select>
              <Select label="Total students" name="studentRange" required value={form.studentRange} onChange={(event) => update('studentRange', event.target.value)} error={errors.studentRange}>
                <option value="">Select a range</option>
                {studentRanges.map((range) => <option key={range} value={range}>{range}</option>)}
              </Select>
              <Select label="Total classes" name="classRange" required value={form.classRange} onChange={(event) => update('classRange', event.target.value)} error={errors.classRange}>
                <option value="">Select a range</option>
                {classRanges.map((range) => <option key={range} value={range}>{range}</option>)}
              </Select>
              <Select label="Teachers/staff" name="staffRange" required value={form.staffRange} onChange={(event) => update('staffRange', event.target.value)} error={errors.staffRange}>
                <option value="">Select a range</option>
                {staffRanges.map((range) => <option key={range} value={range}>{range}</option>)}
              </Select>
            </div>
            <Input label="Curriculum" name="curriculum" required value={form.curriculum} onChange={(event) => update('curriculum', event.target.value)} error={errors.curriculum} placeholder="For example, national curriculum or Cambridge" />
            <Input label="Current system" name="currentSystem" required value={form.currentSystem} onChange={(event) => update('currentSystem', event.target.value)} error={errors.currentSystem} placeholder="For example, spreadsheets, paper, or another platform" />
            <fieldset>
              <legend className="label">Main reasons for using Nom Cloud <span className="text-brand"> *</span></legend>
              <div className="space-y-2">
                {reasons.map((reason) => (
                  <label key={reason} className="flex items-start gap-3 rounded-xl border border-ink/10 px-3 py-2.5 text-sm text-ink dark:border-white/10 dark:text-white">
                    <input type="checkbox" checked={form.reasons.includes(reason)} onChange={() => toggleReason(reason)} className="mt-0.5 accent-brand" />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
              {errors.reasons && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.reasons}</p>}
            </fieldset>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-lg font-semibold text-ink dark:text-white">Review your application</h2>
            <div className="space-y-3 rounded-2xl bg-mist p-5 text-sm dark:bg-white/5">
              <p><strong>Applicant:</strong> {form.fullName} · {form.email}</p>
              <p><strong>Position:</strong> {form.position}</p>
              <p><strong>School:</strong> {form.schoolName} · {form.country.toUpperCase()}</p>
              <p><strong>Campuses:</strong> {form.campusCount} · <strong>Students:</strong> {form.studentRange}</p>
              <p><strong>Classes:</strong> {form.classRange} · <strong>Teachers/staff:</strong> {form.staffRange}</p>
              <p><strong>Curriculum:</strong> {form.curriculum}</p>
              <p><strong>Current system:</strong> {form.currentSystem}</p>
              <p><strong>Reasons:</strong> {form.reasons.join(', ')}</p>
            </div>
            {submitError && <p className="text-sm font-medium text-red-500">{submitError}</p>}
          </>
        )}

        <p className="pt-1 text-sm text-graphite">
          Already have an account?{' '}
          <Link to="/login" className="link-underline font-medium text-accent">
            Sign in
          </Link>
        </p>

        <div className="flex justify-between gap-3 pt-2">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={previousStep} icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
          ) : <span />}
          {step < 4 ? (
            <Button type="button" variant="accent" onClick={nextStep}>Continue <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button type="submit" variant="accent" loading={loading}>Submit application</Button>
          )}
        </div>
      </form>
    </AuthLayout>
  )
}
