import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowRight, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/layout/AuthLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { isValidEmail } from '@/utils/validators'
import { useToast } from '@/context/ToastContext'
import { useLanguage } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase'
import { fetchActiveMemberships } from '@/services/identityService'
import type { Role } from '@/types'

export default function Login() {
  const { t } = useLanguage()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationRequired, setConfirmationRequired] = useState(false)
  const [resendingConfirmation, setResendingConfirmation] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

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
      const memberships = await fetchActiveMemberships(data.user.id)
      const roles = memberships.map((membership) => membership.role)
      const destination = requestedPathForRoles(roles) || destinationForRoles(roles)

      if (!destination) {
        setError('Your account is not assigned an active workspace.')
        return
      }

      showToast({ type: 'success', title: 'Welcome back!' })
      navigate(destination)
    } catch {
      setError('We could not load your workspace. Please try again.')
    } finally {
      setLoading(false)
    }
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
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          label={t('auth.login.email')}
          type="email"
          required
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.ac.ke"
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
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-graphite hover:text-ink dark:hover:text-white"
          >
            {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showPassword ? t('auth.login.hide') : t('auth.login.show')}
          </button>
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

      <p className="mt-8 text-center text-sm text-graphite">
        {t('auth.login.noAccount')}{' '}
        <Link to="/signup" className="link-underline font-medium text-accent">
          {t('auth.login.signup')}
        </Link>
      </p>
    </AuthLayout>
  )
}
