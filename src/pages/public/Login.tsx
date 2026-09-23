import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowRight, Mail, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import AuthLayout from '@/components/layout/AuthLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { isValidEmail } from '@/utils/validators'
import { useToast } from '@/context/ToastContext'
import { useLanguage } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase'
import { fetchActiveMemberships, fetchPlatformAdminStatus, isTransientIdentityFailure } from '@/services/identityService'
import { workspacesForMembershipRoles } from '@/lib/roles'
import { mustChangePassword } from '@/services/accountService'
import { resolveSchoolShortcode } from '@/lib/schoolShortcode'
import { fetchLoginBranding, type LoginBranding } from '@/services/storageService'
import { schoolInitial } from '@/services/schoolService'
import type { Role } from '@/types'

export default function Login() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation() as { search: string; state?: { from?: string } }
  // Set by ResetPassword after a successful change, so the person is told why
  // they are being asked to sign in again.
  const passwordUpdated = new URLSearchParams(location.search).get('password') === 'updated'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationRequired, setConfirmationRequired] = useState(false)
  const [resendingConfirmation, setResendingConfirmation] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [branding, setBranding] = useState<LoginBranding | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)
  // "Forgot password?" turns this card into the request form and back.
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin')
  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // A school's own login page, before sign-in. The shortcode comes from the
  // school's subdomain or ?school=, and school_login_branding returns the name,
  // colour and logo path of that one active school only. The logo itself is
  // served from the public school-branding bucket by exact path; no session is
  // needed and nothing lets this page list or read any other file.
  useEffect(() => {
    const shortcode = resolveSchoolShortcode(window.location.hostname, location.search)
    setBranding(null)
    setLogoFailed(false)
    if (!shortcode) return
    let cancelled = false
    fetchLoginBranding(shortcode)
      .then((result) => {
        if (!cancelled) setBranding(result)
      })
      .catch(() => {
        // Branding is decoration: on failure the default login page is shown.
      })
    return () => {
      cancelled = true
    }
  }, [location.search])

  const destinationForRoles = (roles: Role[]) => {
    const role = (['admin', 'teacher', 'parent'] as Role[]).find((candidate) => roles.includes(candidate))
    return role ? `/app/${role}` : null
  }


  const requestedPathForRoles = (roles: Role[]) => {
    const requested = location.state?.from
    if (!requested || !requested.startsWith('/app/')) return null
    return roles.some((role) => requested === `/app/${role}` || requested.startsWith(`/app/${role}/`)) ? requested : null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setConfirmationRequired(false)
    setConfirmationSent(false)
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }
    setLoading(true)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError || !data.user) {
      setLoading(false)
      if (signInError?.code === 'email_not_confirmed' || signInError?.message.toLowerCase().includes('email not confirmed')) {
        setConfirmationRequired(true)
        setError('Please confirm your email address before signing in.')
      } else {
        setError('Invalid email or password.')
      }
      return
    }

    try {
      // A temporary password gets no workspace at all, not even a redirect
      // through one. The guards enforce the same rule on every other route.
      if (mustChangePassword(data.user)) {
        navigate('/first-login', { replace: true })
        return
      }

      // An unrevoked platform_admins row is the sole determinant of platform
      // authority, and such an account holds no school membership by design.
      if (await fetchPlatformAdminStatus(data.user.id)) {
        showToast({ type: 'success', title: 'Welcome back!' })
        navigate('/platform')
        return
      }

      const memberships = await fetchActiveMemberships(data.user.id)
      const roles = workspacesForMembershipRoles(memberships.map((membership) => membership.role))
      const destination = requestedPathForRoles(roles) || destinationForRoles(roles)

      if (!destination) {
        setError('Your account is not assigned an active school workspace or platform administrator role.')
        return
      }

      showToast({ type: 'success', title: 'Welcome back!' })
      navigate(destination)
    } catch (identityError: unknown) {
      // Reaching here does NOT mean this account has no workspace — that case is
      // answered above, in its own sentence. This is the server refusing or
      // failing to answer, and saying "we could not load your workspace" for it
      // reads as a verdict on the account, which is both wrong and frightening.
      setError(
        isTransientIdentityFailure(identityError)
          ? 'We could not reach the server just now. Please try signing in again.'
          : 'Something went wrong while loading your account. Please try again, or contact your administrator if this continues.',
      )
    } finally {
      setLoading(false)
    }
  }

  /**
   * Asks Supabase to send the recovery email.
   *
   * `redirectTo` is built from the origin the application is actually being
   * served from, never a hard-coded host, so a link always comes back to the
   * same deployment the request was made on. Supabase only honours an origin on
   * its redirect allow-list and otherwise falls back to the project's Site URL.
   *
   * The confirmation never says whether the address is registered: this page
   * deliberately gives non-enumerable answers, exactly as sign-in does.
   */
  const requestPasswordReset = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const target = resetEmail.trim()
    if (!isValidEmail(target)) {
      setError('Please enter a valid email address.')
      return
    }
    setResetSending(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetSending(false)
    if (resetError) {
      setError('We could not send the reset email just now. Please try again in a moment.')
      return
    }
    setResetSent(true)
  }

  const resendConfirmation = async () => {
    setResendingConfirmation(true)
    setConfirmationSent(false)
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    setResendingConfirmation(false)
    if (resendError) {
      setError('We could not resend the confirmation email. Please try again.')
      return
    }
    setConfirmationSent(true)
  }

  return (
    <AuthLayout title={t('auth.login.title')} subtitle={t('auth.login.subtitle')}>
      {branding && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-ink/5 p-3 dark:border-white/10" data-testid="school-login-branding">
          {branding.logoUrl && !logoFailed ? (
            <img
              src={branding.logoUrl}
              alt={`${branding.name} logo`}
              onError={() => setLogoFailed(true)}
              className="h-12 w-12 flex-shrink-0 rounded-xl object-contain"
            />
          ) : (
            <span
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
              style={{ backgroundColor: branding.primaryColor }}
            >
              {schoolInitial(branding.name)}
            </span>
          )}
          <p className="min-w-0 truncate font-semibold text-ink dark:text-white">{branding.name}</p>
        </div>
      )}
      {passwordUpdated && mode === 'signin' && (
        <div className="mb-6 flex gap-3 rounded-2xl bg-green-500/10 px-4 py-3.5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Your password was updated. Please sign in again with your new password.
          </p>
        </div>
      )}

      {mode === 'forgot' ? (
        <div>
          {resetSent ? (
            <>
              <div className="flex gap-3 rounded-2xl bg-green-500/10 px-4 py-3.5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  If that address has an account, a reset link is on its way. The link works once and expires.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setResetSent(false)
                  setError('')
                }}
                className="mt-6 text-sm font-medium text-accent"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <form onSubmit={requestPasswordReset} className="space-y-5" noValidate>
              <p className="text-sm text-graphite">
                Enter the email address you sign in with and we will send you a link to set a new password.
              </p>
              <Input
                label={t('auth.login.email')}
                type="email"
                required
                icon={<Mail className="h-4 w-4" />}
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@school.nclass.ac"
              />
              {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</p>}
              <Button type="submit" size="lg" loading={resetSending} className="w-full">
                Send reset link <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setError('')
                }}
                className="text-sm font-medium text-graphite hover:text-ink dark:hover:text-white"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          label={t('auth.login.email')}
          type="email"
          required
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.nclass.ac"
        />
        <div>
          <Input
            label={t('auth.login.password')}
            type={showPassword ? 'text' : 'password'}
            required
            icon={<Lock className="h-4 w-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-graphite hover:text-ink dark:hover:text-white"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPassword ? t('auth.login.hide') : t('auth.login.show')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('forgot')
                setResetEmail(email.trim())
                setError('')
              }}
              className="text-xs font-medium text-accent"
            >
              Forgot password?
            </button>
          </div>
        </div>
        {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</p>}
        {confirmationRequired && (
          <button
            type="button"
            onClick={resendConfirmation}
            disabled={resendingConfirmation}
            className="text-left text-sm font-medium text-accent disabled:opacity-60"
          >
            {resendingConfirmation ? 'Sending confirmation email…' : 'Resend confirmation email'}
          </button>
        )}
        {confirmationSent && <p className="text-sm font-medium text-green-600">Confirmation email sent. Check your inbox.</p>}
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {t('auth.login.submit')} <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
      )}

      <p className="mt-8 text-center text-sm text-graphite">
        {t('auth.login.noAccount')}{' '}
        <Link to="/signup" className="link-underline font-medium text-accent">
          {t('auth.login.signup')}
        </Link>
      </p>
    </AuthLayout>
  )
}
