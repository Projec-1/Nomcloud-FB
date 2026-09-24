import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound, Lock, ShieldAlert } from 'lucide-react'
import AuthLayout from '@/components/layout/AuthLayout'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { recoveryLanding } from '@/lib/recoveryLanding'
import { useAuth } from '@/context/AuthContext'
import { claimPendingInvitation } from '@/services/invitationService'
import { workspacesForMembershipRoles } from '@/lib/roles'
import { errorMessage } from '@/utils/errorMessage'
import { MIN_PASSWORD_LENGTH, isValidPassword } from '@/utils/validators'

// ---------------------------------------------------------------------------
// Activating an account from the emailed link.
//
// WHAT THE LINK IS. Supabase Auth's own invite (or recovery) link. Following it
// opens a session for exactly the invited address and puts the result in the URL
// fragment, never a query string. Supabase owns the link's single use and its
// expiry, so no second token system exists: the school, role and memberships
// were already created by approval, and the only thing missing is a password
// that nobody but its owner has ever seen.
//
// WHY A FORM IS NOT SHOWN BY DEFAULT. The same rule the reset screen follows: a
// password field that cannot save is worse than an honest refusal. The form
// appears only when this page was opened by a real link AND a session exists.
// Expired, already used and tampered links each get their own sentence.
//
// AFTER ACTIVATION the person stays signed in and goes to their workspace: they
// have just proved they own the mailbox and chosen the password themselves, so
// asking them to type it again would be ceremony, not security.
// ---------------------------------------------------------------------------

type Status = 'checking' | 'ready' | 'saving' | 'invalid' | 'no_school'

/** How long to wait for supabase-js to turn the fragment into a session. */
const SESSION_WAIT_MS = 8000

export default function ActivateAccount() {
  const navigate = useNavigate()
  const { authState, school, memberships, displayName, refreshIdentity } = useAuth()
  const [status, setStatus] = useState<Status>('checking')
  const [invalidReason, setInvalidReason] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const settle = (next: Status, reason?: string) => {
      if (cancelled) return
      setStatus((current) => (current === 'checking' ? next : current))
      if (reason) setInvalidReason(reason)
    }

    // Supabase refused the link itself: expired, already used, or tampered with.
    if (recoveryLanding.errorDescription) {
      settle('invalid', recoveryLanding.errorDescription)
      return
    }
    // Opened directly, with no activation link behind it.
    if (!recoveryLanding.isActivation) {
      settle('invalid')
      return
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) settle('ready')
    })

    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return
        if (data.session) {
          window.clearInterval(timer)
          settle('ready')
        } else if (Date.now() - startedAt > SESSION_WAIT_MS) {
          window.clearInterval(timer)
          settle('invalid')
        }
      })
    }, 250)

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
      window.clearInterval(timer)
    }
  }, [])

  // A teacher or guardian arrives with no membership yet — and no profile
  // either, because accept_invitation is what creates one. AuthContext cannot
  // resolve an identity for them and reports 'error', which is correct and is
  // NOT a reason to wait: the claim below is exactly what turns this account
  // into a member. So it runs as soon as a session exists, whatever the
  // identity state, and the identity is then re-read.
  //
  // An administrator activating already has profile and memberships from
  // approval, so the call finds nothing pending and changes nothing.
  const [claimed, setClaimed] = useState(false)
  useEffect(() => {
    if (status !== 'ready' || claimed) return
    let cancelled = false
    void claimPendingInvitation()
      .then((outcome) => {
        if (outcome === 'accepted') refreshIdentity()
      })
      .catch(() => {
        // Not fatal: the screen below says "wrong account" rather than
        // pretending an invitation was found.
      })
      .finally(() => {
        if (!cancelled) setClaimed(true)
      })
    return () => {
      cancelled = true
    }
  }, [status, claimed, refreshIdentity])

  // A valid link whose account belongs to no school: the link worked, but this
  // is not the account the activation was for. 'error' counts too — it is what
  // an account with no profile looks like once the claim has found nothing.
  useEffect(() => {
    if (status !== 'ready' || !claimed) return
    if (authState === 'ready' && memberships.length === 0) setStatus('no_school')
    if (authState === 'error') setStatus('no_school')
  }, [status, authState, claimed, memberships.length])

  const roleLabel = (() => {
    const roles = memberships.map((membership) => membership.role)
    if (roles.includes('administrator')) return 'Administrator'
    if (roles.includes('owner')) return 'Owner'
    if (roles.includes('teacher')) return 'Teacher'
    if (roles.includes('guardian')) return 'Parent'
    return roles[0] ? `${roles[0][0].toUpperCase()}${roles[0].slice(1)}` : ''
  })()

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

    setStatus('saving')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setStatus('ready')
      setError(errorMessage(updateError))
      return
    }

    const workspace = workspacesForMembershipRoles(memberships.map((membership) => membership.role))[0]
    navigate(workspace ? `/app/${workspace}` : '/login', { replace: true })
  }

  if (status === 'checking') {
    return (
      <AuthLayout title="Checking your link" subtitle="One moment.">
        <p className="text-sm text-graphite">Verifying your activation link…</p>
      </AuthLayout>
    )
  }

  if (status === 'invalid' || status === 'no_school') {
    const isWrongAccount = status === 'no_school'
    return (
      <AuthLayout
        title={isWrongAccount ? 'Wrong account' : 'Activation link not valid'}
        subtitle="Nothing has been changed."
      >
        <div className="flex gap-3 rounded-2xl bg-red-500/10 px-4 py-3.5">
          <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-500">
              {isWrongAccount
                ? 'This link opened an account that is not connected to a school.'
                : 'This activation link is invalid or has expired.'}
            </p>
            {invalidReason && <p className="mt-1 text-xs text-red-500/80">{invalidReason}</p>}
          </div>
        </div>
        <p className="mt-5 text-sm text-graphite">
          {isWrongAccount
            ? 'Ask your school to send the activation email again, and open it while signed out of any other account.'
            : 'Each activation link works once and expires. Ask for a new one to be sent, then open the newest email.'}
        </p>
        <Link to="/login" className="mt-6 block">
          <Button size="lg" className="w-full">
            Back to sign in <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={school ? `Welcome to ${school.name}` : 'Welcome to Nom Cloud'}
      subtitle={roleLabel ? `${roleLabel}${displayName ? ` · ${displayName}` : ''}` : 'Create your password to finish.'}
    >
      <div className="mb-6 flex gap-3 rounded-2xl bg-brand/10 px-4 py-3.5">
        <KeyRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" />
        <p className="text-sm text-ink dark:text-white">
          Choose a password to activate your account. Nobody else has ever seen it — Nom Cloud never sends passwords by
          email.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          label="New password"
          type="password"
          required
          icon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <Input
          label="Confirm password"
          type="password"
          required
          icon={<Lock className="h-4 w-4" />}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="••••••••"
        />
        {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-500">{error}</p>}
        <Button type="submit" size="lg" loading={status === 'saving'} className="w-full">
          Activate account <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </AuthLayout>
  )
}
