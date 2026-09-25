import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, KeyRound, Lock } from 'lucide-react'
import AuthLayout from '@/components/layout/AuthLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/Loader'
import { useAuth } from '@/context/AuthContext'
import { completeFirstLoginPasswordChange, mustChangePassword } from '@/services/accountService'
import { errorMessage } from '@/utils/errorMessage'
import { MIN_PASSWORD_LENGTH, isValidPassword } from '@/utils/validators'

// ---------------------------------------------------------------------------
// Choosing a real password, the first time.
//
// This screen is the only place a person provisioned with a temporary password
// can reach until they have replaced it. The guards in ProtectedRoute and
// PlatformRoute send them here; this page sends them away again once the
// requirement is gone, so the two cannot loop.
//
// The invited operator can reveal either field while choosing a new password.
// ---------------------------------------------------------------------------

export default function FirstLoginPassword() {
  const navigate = useNavigate()
  const { authState, authUser, displayName } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (authState === 'initialising' || authState === 'loading_profile') {
    return <PageLoader label="Loading your account…" />
  }
  if (authState === 'signed_out') return <Navigate to="/login" replace />
  // Nothing to do here: either they never had the requirement, or it is done.
  if (authState === 'ready' && !mustChangePassword(authUser)) return <Navigate to="/" replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')

    if (!isValidPassword(password)) {
      setError(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirmPassword) {
      setError('Both passwords must match.')
      return
    }

    setSaving(true)
    try {
      await completeFirstLoginPasswordChange(password)
      navigate('/login?password=updated', { replace: true })
    } catch (err: unknown) {
      setSaving(false)
      setError(errorMessage(err))
    }
  }

  return (
    <AuthLayout
      title="Choose your password"
      subtitle={displayName ? `Welcome, ${displayName}.` : 'Welcome to Nom Cloud.'}
    >
      <div className="mb-6 flex gap-3 rounded-2xl bg-brand/10 px-4 py-3.5">
        <KeyRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" />
        <p className="text-sm text-ink dark:text-white">
          You signed in with a temporary password. Choose your own password to finish setting up your account — you
          cannot use Nom Cloud until you do.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          label="New password"
          type={showPassword ? 'text' : 'password'}
          required
          icon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <button type="button" onClick={() => setShowPassword((value) => !value)} className="-mt-3 flex items-center gap-1.5 text-xs font-medium text-graphite hover:text-ink dark:hover:text-white">
          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {showPassword ? 'Hide password' : 'Show password'}
        </button>
        <Input
          label="Confirm new password"
          type={showConfirmPassword ? 'text' : 'password'}
          required
          icon={<Lock className="h-4 w-4" />}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="••••••••"
        />
        <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="-mt-3 flex items-center gap-1.5 text-xs font-medium text-graphite hover:text-ink dark:hover:text-white">
          {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {showConfirmPassword ? 'Hide password' : 'Show password'}
        </button>
        {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</p>}
        <Button type="submit" size="lg" loading={saving} className="w-full">
          Save password <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-graphite">
          You will be signed out and asked to sign in again with your new password.
        </p>
      </form>
    </AuthLayout>
  )
}
