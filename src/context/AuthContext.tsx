import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Role } from '@/types'
import { schoolSettings } from '@/data/mockData'
import { makeId } from '@/utils/id'
import { useData } from '@/context/DataContext'
import { supabase } from '@/lib/supabase'
import { fetchActiveMemberships, fetchPlatformAdminStatus, fetchProfileByAuthUserId, fetchSchoolById } from '@/services/identityService'
import type { AuthSessionUser, AuthState, MembershipRow, ProfileRow, SchoolRow } from '@/types/auth'

const ACTIVE_ROLE_KEY = 'nomcloud_active_role'

interface SignupInput {
  name: string
  email: string
  password: string
  role: Role
  phone?: string
}

interface AuthContextValue {
  isLoading: boolean
  signup: (input: SignupInput) => { ok: boolean; error?: string; role?: Role }
  logout: () => void
  authUser: AuthSessionUser | null
  platformAdmin: boolean
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
  const data = useData()
  const [isLoading, setIsLoading] = useState(true)
  const [authUser, setAuthUser] = useState<AuthSessionUser | null>(null)
  const [platformAdmin, setPlatformAdmin] = useState(false)
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
      setPlatformAdmin(false)
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
        const nextPlatformAdmin = await fetchPlatformAdminStatus(sessionUser.id)
        if (cancelled) return

        setAuthUser(sessionUser)
        setPlatformAdmin(nextPlatformAdmin)
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
        setPlatformAdmin(false)
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

  const signup: AuthContextValue['signup'] = ({ name, email, password, role, phone }) => {
    if (!import.meta.env.DEV) {
      return { ok: false, error: 'Public self-registration is not available.' }
    }

    void password
    const id = makeId('demo-user')

    if (role === 'teacher') {
      data.addTeacher({ name, email, phone: phone || '', subject: 'Not assigned yet' })
    } else if (role === 'parent') {
      data.addParent({ name, email, phone: phone || '' })
    }

    const now = new Date().toISOString()
    setProfile({
      id,
      school_id: schoolSettings.id,
      full_name: name,
      email,
      phone: phone || null,
      locale: 'en',
      avatar_url: null,
      last_seen_at: null,
      created_at: now,
      updated_at: now,
    })
    setMemberships([{
      id: `${id}-membership`,
      user_id: id,
      school_id: schoolSettings.id,
      role,
      status: 'active',
      teacher_id: null,
      guardian_id: null,
      invited_by: null,
      joined_at: now,
      created_at: now,
      updated_at: now,
    }])
    setActiveRoleState(role)
    setAuthState('ready')
    setIsLoading(false)
    return { ok: true, role }
  }

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
        signup,
        logout,
        authUser,
        platformAdmin,
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
