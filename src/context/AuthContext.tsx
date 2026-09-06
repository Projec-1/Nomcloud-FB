import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AuthUser, Role } from '@/types'
import { teachers as seedTeachers, parents as seedParents, schoolSettings } from '@/data/mockData'
import { AVATAR_COLORS } from '@/constants/avatarColors'
import { makeId } from '@/utils/id'
import { useData } from '@/context/DataContext'
import { supabase } from '@/lib/supabase'
import { fetchActiveMemberships, fetchProfileByAuthUserId, fetchSchoolById } from '@/services/identityService'
import type { AuthSessionUser, AuthState, MembershipRow, ProfileRow, SchoolRow } from '@/types/auth'

const USERS_KEY = 'nomcloud_auth_users'
const SESSION_KEY = 'nomcloud_auth_session'

interface StoredUser extends AuthUser {
  password: string
}

export interface DemoCredential {
  role: Role
  label: string
  email: string
  password: string
}

export const DEMO_CREDENTIALS: DemoCredential[] = import.meta.env.DEV
  ? [
      { role: 'admin', label: 'Administrator', email: 'admin@nomcloud.academy', password: 'demo1234' },
      { role: 'teacher', label: `Teacher — ${seedTeachers[0].name}`, email: seedTeachers[0].email, password: 'demo1234' },
      { role: 'parent', label: `Parent — ${seedParents[2].name}`, email: seedParents[2].email, password: 'demo1234' },
    ]
  : []

function seedUsers(): StoredUser[] {
  if (!import.meta.env.DEV) return []

  return [
    {
      id: 'demo-admin',
      name: 'School Administrator',
      email: DEMO_CREDENTIALS[0].email,
      password: DEMO_CREDENTIALS[0].password,
      role: 'admin',
      avatarColor: AVATAR_COLORS[0],
      schoolId: schoolSettings.id,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-teacher-t1',
      name: seedTeachers[0].name,
      email: seedTeachers[0].email,
      password: 'demo1234',
      role: 'teacher',
      avatarColor: seedTeachers[0].avatarColor,
      schoolId: schoolSettings.id,
      teacherId: seedTeachers[0].id,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-parent-p1',
      name: seedParents[2].name,
      email: seedParents[2].email,
      password: 'demo1234',
      role: 'parent',
      avatarColor: seedParents[2].avatarColor,
      schoolId: schoolSettings.id,
      parentId: seedParents[2].id,
      createdAt: new Date().toISOString(),
    },
  ]
}

function loadUsers(): StoredUser[] {
  if (!import.meta.env.DEV || typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(USERS_KEY)
    if (!raw) {
      const initial = seedUsers()
      window.localStorage.setItem(USERS_KEY, JSON.stringify(initial))
      return initial
    }
    return JSON.parse(raw) as StoredUser[]
  } catch {
    return seedUsers()
  }
}

function saveUsers(users: StoredUser[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function legacyUserFromIdentity(authUser: AuthSessionUser, profile: ProfileRow, memberships: MembershipRow[]): AuthUser | null {
  const membership = memberships[0]
  if (!membership || !profile.school_id) return null

  return {
    id: authUser.id,
    name: profile.full_name,
    email: profile.email,
    role: membership.role,
    avatarColor: AVATAR_COLORS[0],
    schoolId: profile.school_id,
    teacherId: membership.teacher_id ?? undefined,
    parentId: membership.guardian_id ?? undefined,
    createdAt: profile.created_at,
  }
}

interface SignupInput {
  name: string
  email: string
  password: string
  role: Role
  phone?: string
}

interface AuthContextValue {
  currentUser: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => { ok: boolean; error?: string; role?: Role }
  signup: (input: SignupInput) => { ok: boolean; error?: string; role?: Role }
  logout: () => void
  scope: string
  authUser: AuthSessionUser | null
  profile: ProfileRow | null
  memberships: MembershipRow[]
  school: SchoolRow | null
  authState: AuthState
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const data = useData()
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authUser, setAuthUser] = useState<AuthSessionUser | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [memberships, setMemberships] = useState<MembershipRow[]>([])
  const [school, setSchool] = useState<SchoolRow | null>(null)
  const [authState, setAuthState] = useState<AuthState>('initialising')
  const supabaseUserRef = useRef<AuthSessionUser | null>(null)

  useEffect(() => {
    let cancelled = false

    const clearIdentity = () => {
      if (cancelled) return
      supabaseUserRef.current = null
      setAuthUser(null)
      setProfile(null)
      setMemberships([])
      setSchool(null)
      setCurrentUser(null)
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
        setCurrentUser(legacyUserFromIdentity(sessionUser, nextProfile, nextMemberships))
        setAuthState('ready')
        setIsLoading(false)
      } catch {
        if (cancelled) return
        supabaseUserRef.current = null
        setAuthUser(null)
        setProfile(null)
        setMemberships([])
        setSchool(null)
        setCurrentUser(null)
        setAuthState('error')
        setIsLoading(false)
      }
    }

    const restoreDemoSession = () => {
      if (!import.meta.env.DEV || typeof window === 'undefined') return false
      const sessionId = window.localStorage.getItem(SESSION_KEY)
      if (!sessionId) return false
      const found = loadUsers().find((user) => user.id === sessionId)
      if (!found) return false

      const { password: _password, ...rest } = found
      setCurrentUser(rest)
      setAuthState('ready')
      setIsLoading(false)
      return true
    }

    const initialise = async () => {
      try {
        const { data: sessionData, error } = await supabase.auth.getSession()
        if (error) throw error
        if (cancelled) return

        if (sessionData.session?.user) {
          await loadIdentity(sessionData.session.user, true)
        } else if (!restoreDemoSession()) {
          clearIdentity()
        }
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

  const login: AuthContextValue['login'] = (email, password) => {
    if (!import.meta.env.DEV) {
      return { ok: false, error: 'Email and password login is not available through the prototype.' }
    }

    const users = loadUsers()
    const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!found) return { ok: false, error: 'No account found with that email address.' }
    if (found.password !== password) return { ok: false, error: 'Incorrect password. Please try again.' }
    const { password: _password, ...rest } = found
    setCurrentUser(rest)
    setAuthState('ready')
    setIsLoading(false)
    window.localStorage.setItem(SESSION_KEY, found.id)
    return { ok: true, role: found.role }
  }

  const signup: AuthContextValue['signup'] = ({ name, email, password, role, phone }) => {
    if (!import.meta.env.DEV) {
      return { ok: false, error: 'Public self-registration is not available.' }
    }

    const users = loadUsers()
    if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      return { ok: false, error: 'An account with that email already exists. Try logging in instead.' }
    }
    const id = makeId('u')
    let teacherId: string | undefined
    let parentId: string | undefined

    if (role === 'teacher') {
      const t = data.addTeacher({ name, email, phone: phone || '', subject: 'Not assigned yet' })
      teacherId = t.id
    } else if (role === 'parent') {
      const p = data.addParent({ name, email, phone: phone || '' })
      parentId = p.id
    }

    const newUser: StoredUser = {
      id,
      name,
      email,
      password,
      role,
      teacherId,
      parentId,
      avatarColor: AVATAR_COLORS[users.length % AVATAR_COLORS.length],
      schoolId: schoolSettings.id,
      createdAt: new Date().toISOString(),
    }
    saveUsers([...users, newUser])
    const { password: _password, ...rest } = newUser
    setCurrentUser(rest)
    setAuthState('ready')
    setIsLoading(false)
    window.localStorage.setItem(SESSION_KEY, id)
    return { ok: true, role }
  }

  const logout = () => {
    setCurrentUser(null)
    setAuthUser(null)
    setProfile(null)
    setMemberships([])
    setSchool(null)
    setAuthState('signed_out')
    setIsLoading(false)
    if (import.meta.env.DEV) window.localStorage.removeItem(SESSION_KEY)
    if (supabaseUserRef.current) void supabase.auth.signOut()
  }

  const scope = useMemo(() => {
    if (!currentUser) return ''
    return data.scopeKey(currentUser.role, currentUser.teacherId, currentUser.parentId)
  }, [currentUser, data])

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        login,
        signup,
        logout,
        scope,
        authUser,
        profile,
        memberships,
        school,
        authState,
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
