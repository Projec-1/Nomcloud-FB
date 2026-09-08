import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Role } from '@/types'
import { supabase } from '@/lib/supabase'
import { fetchActiveMemberships, fetchProfileByAuthUserId, fetchSchoolById } from '@/services/identityService'
import type { AuthSessionUser, AuthState, MembershipRow, ProfileRow, SchoolRow } from '@/types/auth'

const ACTIVE_ROLE_KEY = 'nomcloud_active_role'

interface AuthContextValue {
  isLoading: boolean
  logout: () => void
  authUser: AuthSessionUser | null
  profile: ProfileRow | null
  memberships: MembershipRow[]
  activeMembership: MembershipRow | null
  school: SchoolRow | null
  displayName: string
  authState: AuthState
  activeRole: Role | null
  setActiveRole: (role: Role) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [authUser, setAuthUser] = useState<AuthSessionUser | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [memberships, setMemberships] = useState<MembershipRow[]>([])
  const [school, setSchool] = useState<SchoolRow | null>(null)
  const [authState, setAuthState] = useState<AuthState>('initialising')
  const [activeRole, setActiveRoleState] = useState<Role | null>(null)
  const supabaseUserRef = useRef<AuthSessionUser | null>(null)

  useEffect(() => {
    window.localStorage.removeItem('nomcloud_auth_users')
    window.localStorage.removeItem('nomcloud_auth_session')
  }, [])

  useEffect(() => {
    let cancelled = false

    const clearIdentity = () => {
      if (cancelled) return
      supabaseUserRef.current = null
      setAuthUser(null)
      setProfile(null)
      setMemberships([])
      setSchool(null)
      setActiveRoleState(null)
      setAuthState('signed_out')
      setIsLoading(false)
    }

    const loadIdentity = async (sessionUser: AuthSessionUser, showLoading: boolean) => {
      if (cancelled) return
      if (showLoading) {
        setAuthState('loading_profile')
        setIsLoading(true)
      }
      supabaseUserRef.current = sessionUser

      try {
        const nextProfile = await fetchProfileByAuthUserId(sessionUser.id)
        if (!nextProfile) throw new Error('Authenticated user has no profile.')
        const nextMemberships = await fetchActiveMemberships(sessionUser.id)
        const nextSchool = nextProfile.school_id ? await fetchSchoolById(nextProfile.school_id) : null
        if (cancelled) return

        setAuthUser(sessionUser)
        setProfile(nextProfile)
        setMemberships(nextMemberships)
        setSchool(nextSchool)
        const storedRole = window.localStorage.getItem(ACTIVE_ROLE_KEY) as Role | null
        const activeRoles = nextMemberships.map((membership) => membership.role)
        const nextActiveRole = activeRoles.includes(storedRole as Role) ? storedRole : activeRoles[0] ?? null
        setActiveRoleState(nextActiveRole)
        setAuthState('ready')
        setIsLoading(false)
      } catch {
        if (cancelled) return
        supabaseUserRef.current = null
        setAuthUser(null)
        setProfile(null)
        setMemberships([])
        setSchool(null)
        setActiveRoleState(null)
        setAuthState('error')
        setIsLoading(false)
      }
    }

    const initialise = async () => {
      try {
        const { data: sessionData, error } = await supabase.auth.getSession()
        if (error) throw error
        if (cancelled) return

        if (sessionData.session?.user) {
          await loadIdentity(sessionData.session.user, true)
        } else clearIdentity()
        if (cancelled) return undefined

        const { data: authStateData } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT' || !session?.user) {
            clearIdentity()
            return
          }
          void loadIdentity(session.user, event !== 'TOKEN_REFRESHED')
        })

        return authStateData.subscription.unsubscribe
      } catch {
        if (!cancelled) {
          setAuthState('error')
          setIsLoading(false)
        }
        return undefined
      }
    }

    let unsubscribe: (() => void) | undefined
    void initialise().then((cleanup) => {
      if (cancelled) {
        cleanup?.()
      } else {
        unsubscribe = cleanup
      }
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const logout = () => {
    setAuthUser(null)
    setProfile(null)
    setMemberships([])
    setSchool(null)
    setActiveRoleState(null)
    setAuthState('signed_out')
    setIsLoading(false)
    if (supabaseUserRef.current) void supabase.auth.signOut()
  }

  const setActiveRole = (role: Role) => {
    const availableRoles = memberships.map((membership) => membership.role)
    if (!availableRoles.includes(role)) return
    setActiveRoleState(role)
    window.localStorage.setItem(ACTIVE_ROLE_KEY, role)
  }

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        logout,
        authUser,
        profile,
        memberships,
        activeMembership: memberships.find((membership) => membership.role === activeRole) ?? memberships[0] ?? null,
        school,
        displayName: profile?.full_name ?? '',
        authState,
        activeRole,
        setActiveRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
