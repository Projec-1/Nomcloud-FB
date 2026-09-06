import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, CheckCircle2, KeyRound, Mail, Phone, School, User as UserIcon } from 'lucide-react'
import AuthLayout from '@/components/layout/AuthLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { isValidEmail, isValidPhone, minLength, type FieldErrors } from '@/utils/validators'

type InvitationOutcome = 'accepted' | 'already_accepted' | 'expired' | 'revoked' | 'not_found' | 'email_mismatch' | 'role_already_held'
type PageState = 'loading' | 'ready' | 'confirmation_required' | 'accepted' | 'already_accepted' | 'expired' | 'revoked' | 'not_found' | 'email_mismatch' | 'role_already_held' | 'error'

interface InvitationPreview {
  email: string
  role: 'admin' | 'teacher' | 'parent'
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function stateMessage(state: PageState): string {
  switch (state) {
    case 'already_accepted': return 'This invitation has already been accepted.'
    case 'expired': return 'This invitation has expired. Ask a school administrator to send a new one.'
    case 'revoked': return 'This invitation has been revoked. Ask a school administrator for a new invitation.'
    case 'not_found': return 'This invitation link is invalid.'
    case 'email_mismatch': return 'This account email does not match the invitation.'
    case 'role_already_held': return 'This role is already assigned to your account.'
    case 'error': return 'We could not complete this invitation. Please try again.'
    default: return ''
  }
}

export default function Signup() {
  const location = useLocation()
  const hasInvitationToken = Boolean(new URLSearchParams(location.search).get('token'))
  const [tokenHash, setTokenHash] = useState<string | null>(null)
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [form, setForm] = useState({ name: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const accepting = useRef(false)
  const [applicationForm, setApplicationForm] = useState({ schoolName: '', applicantName: '', email: '', phone: '', website: '' })
  const [applicationErrors, setApplicationErrors] = useState<FieldErrors>({})
  const [applicationLoading, setApplicationLoading] = useState(false)
  const [applicationSubmitted, setApplicationSubmitted] = useState(false)
  const [applicationError, setApplicationError] = useState('')

  const acceptInvitation = async (userId: string) => {
    if (!tokenHash || accepting.current) return
    accepting.current = true
    setLoading(true)

    const { data, error } = await supabase.rpc('accept_invitation', {
      p_token_hash: tokenHash,
      p_authenticated_user_id: userId,
    })

    if (error) {
      setPageState('error')
    } else {
      const outcome = (Array.isArray(data) ? data[0]?.outcome : data?.outcome) as InvitationOutcome | undefined
      setPageState(outcome ?? 'error')
      if (outcome === 'accepted' || outcome === 'role_already_held') {
        await supabase.auth.refreshSession()
      }
    }

    setLoading(false)
    accepting.current = false
  }

  useEffect(() => {
    let cancelled = false
    const rawToken = new URLSearchParams(location.search).get('token')

    const loadInvitation = async () => {
      if (!rawToken) return

      try {
        const hashedToken = await hashToken(rawToken)
        if (cancelled) return
        setTokenHash(hashedToken)

        const { data, error } = await supabase
          .from('invitations')
          .select('email,role,expires_at,accepted_at,revoked_at')
          .eq('token_hash', hashedToken)
          .maybeSingle()

        if (error || !data) {
          setPageState('not_found')
          return
        }

        const preview = data as InvitationPreview
        setInvitation(preview)
        if (preview.accepted_at) setPageState('already_accepted')
        else if (preview.revoked_at) setPageState('revoked')
        else if (new Date(preview.expires_at).getTime() <= Date.now()) setPageState('expired')
        else {
          setPageState('ready')
          const { data: sessionData } = await supabase.auth.getSession()
          if (sessionData.session?.user) await acceptInvitation(sessionData.session.user.id)
        }
      } catch {
        if (!cancelled) setPageState('error')
      }
    }

    void loadInvitation()
    return () => {
      cancelled = true
    }
  }, [location.search])

  const validateApplication = () => {
    const next: FieldErrors = {}
    if (!minLength(applicationForm.schoolName, 2)) next.schoolName = 'Please enter your school name.'
    if (!minLength(applicationForm.applicantName, 2)) next.applicantName = 'Please enter your name.'
    if (!isValidEmail(applicationForm.email)) next.email = 'Please enter a valid email address.'
    if (!isValidPhone(applicationForm.phone)) next.phone = 'Please enter a valid phone number.'
    setApplicationErrors(next)
    return Object.keys(next).length === 0
  }

  const submitApplication = async (event: FormEvent) => {
    event.preventDefault()
    setApplicationError('')
    if (applicationForm.website || !validateApplication()) return
    const cooldownKey = 'nomcloud_application_submission'
    const lastSubmitted = Number(window.localStorage.getItem(cooldownKey) || 0)
    if (Date.now() - lastSubmitted < 60_000) {
      setApplicationError('Please wait a minute before submitting another application.')
      return
    }
    setApplicationLoading(true)
    try {
      const { error } = await supabase.from('school_applications').insert({
        school_name: applicationForm.schoolName.trim(),
        administrator_name: applicationForm.applicantName.trim(),
        email: applicationForm.email.trim().toLowerCase(),
        phone: applicationForm.phone.trim(),
        status: 'pending',
      })
      if (error) throw error
      window.localStorage.setItem(cooldownKey, String(Date.now()))
      setApplicationSubmitted(true)
    } catch {
      setApplicationError('We could not submit your application. Please try again.')
    } finally {
      setApplicationLoading(false)
    }
  }

  const validate = () => {
    const next: FieldErrors = {}
    if (!minLength(form.name, 2)) next.name = 'Please enter your full name.'
    if (!minLength(form.password, 8)) next.password = 'Password must be at least 8 characters.'
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (!invitation || !validate()) return
    setLoading(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: invitation.email,
      password: form.password,
      options: { data: { full_name: form.name } },
    })

    let user = signUpData.user
    let session = signUpData.session

    if (signUpError?.message.toLowerCase().includes('already registered')) {
      const signIn = await supabase.auth.signInWithPassword({ email: invitation.email, password: form.password })
      user = signIn.data.user
      session = signIn.data.session
      if (signIn.error) {
        setFormError('This account already exists. Sign in with its password to accept the invitation.')
        setLoading(false)
        return
      }
    } else if (signUpError || !user) {
      setFormError('We could not create the account for this invitation.')
      setLoading(false)
      return
    }

    if (!session || !user) {
      const signIn = await supabase.auth.signInWithPassword({ email: invitation.email, password: form.password })
      if (signIn.data.session?.user) {
        await acceptInvitation(signIn.data.session.user.id)
        return
      }
      if (signIn.error?.code && signIn.error.code !== 'email_not_confirmed' && !signIn.error.message.toLowerCase().includes('email not confirmed')) {
        setFormError('This account already exists. Sign in with its password to accept the invitation.')
        setLoading(false)
        return
      }
      setPageState('confirmation_required')
      setLoading(false)
      return
    }

    await acceptInvitation(user.id)
  }

  const retryAfterConfirmation = async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) await acceptInvitation(data.session.user.id)
    else setFormError('Please confirm your email, then return to this link.')
  }

  const terminalMessage = stateMessage(pageState)

  if (!hasInvitationToken) {
    return (
      <AuthLayout title="Apply for Nom Cloud" subtitle="Tell us about your school and our team will review your application.">
        {applicationSubmitted ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <h2 className="mt-4 text-xl font-semibold text-ink dark:text-white">Application received</h2>
            <p className="mt-2 text-sm text-graphite">Thank you. Your application is under review. We will contact you at {applicationForm.email} if we need more information.</p>
          </div>
        ) : (
          <form onSubmit={submitApplication} className="space-y-4" noValidate>
            <Input label="School name" required icon={<School className="h-4 w-4" />} value={applicationForm.schoolName} onChange={(e) => setApplicationForm({ ...applicationForm, schoolName: e.target.value })} error={applicationErrors.schoolName} />
            <Input label="Your name" required icon={<UserIcon className="h-4 w-4" />} value={applicationForm.applicantName} onChange={(e) => setApplicationForm({ ...applicationForm, applicantName: e.target.value })} error={applicationErrors.applicantName} />
            <Input label="Email" type="email" required icon={<Mail className="h-4 w-4" />} value={applicationForm.email} onChange={(e) => setApplicationForm({ ...applicationForm, email: e.target.value })} error={applicationErrors.email} />
            <Input label="Phone" type="tel" required icon={<Phone className="h-4 w-4" />} value={applicationForm.phone} onChange={(e) => setApplicationForm({ ...applicationForm, phone: e.target.value })} error={applicationErrors.phone} />
            <input aria-hidden="true" tabIndex={-1} autoComplete="off" className="hidden" value={applicationForm.website} onChange={(e) => setApplicationForm({ ...applicationForm, website: e.target.value })} />
            {applicationError && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{applicationError}</p>}
            <Button type="submit" size="lg" loading={applicationLoading} className="w-full">Submit application <ArrowRight className="h-4 w-4" /></Button>
          </form>
        )}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Accept your invitation" subtitle="Use the invited email address to finish setting up your Nom Cloud account.">
      {pageState === 'loading' && <p className="text-sm text-graphite">Checking your invitation…</p>}
      {invitation && pageState !== 'loading' && (
        <div className="mb-5 rounded-xl bg-ink/5 px-4 py-3 text-sm text-graphite dark:bg-white/10">
          <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> {invitation.email}</div>
        </div>
      )}
      {pageState === 'ready' && invitation && (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input label="Full name" required icon={<UserIcon className="h-4 w-4" />} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Input label="Password" type="password" required icon={<KeyRound className="h-4 w-4" />} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} placeholder="8+ characters" />
          <Input label="Confirm password" type="password" required icon={<KeyRound className="h-4 w-4" />} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} error={errors.confirmPassword} />
          {formError && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{formError}</p>}
          <Button type="submit" size="lg" loading={loading} className="w-full">Accept invitation <ArrowRight className="h-4 w-4" /></Button>
        </form>
      )}
      {pageState === 'confirmation_required' && (
        <div className="space-y-4">
          <p className="text-sm text-graphite">Your account was created. Confirm your email address, then return here to finish accepting the invitation.</p>
          <Button type="button" onClick={retryAfterConfirmation} loading={loading} className="w-full">I confirmed my email</Button>
        </div>
      )}
      {pageState === 'accepted' && <p className="rounded-xl bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700">Invitation accepted. Your workspace is ready.</p>}
      {pageState === 'role_already_held' && <p className="rounded-xl bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700">{terminalMessage}</p>}
      {terminalMessage && !['accepted', 'role_already_held'].includes(pageState) && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{terminalMessage}</p>}
      {pageState !== 'ready' && pageState !== 'confirmation_required' && pageState !== 'accepted' && pageState !== 'role_already_held' && (
        <Link to="/login" className="mt-6 block text-center text-sm font-medium text-accent">Return to sign in</Link>
      )}
    </AuthLayout>
  )
}
