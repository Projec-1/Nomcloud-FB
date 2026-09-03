import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthUser, Role } from '@/types'
import { teachers as seedTeachers, parents as seedParents, schoolSettings } from '@/data/mockData'
import { AVATAR_COLORS } from '@/constants/avatarColors'
import { makeId } from '@/utils/id'
import { useData } from '@/context/DataContext'

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

export const DEMO_CREDENTIALS: DemoCredential[] = [
  { role: 'admin', label: 'Administrator', email: 'admin@nomcloud.academy', password: 'demo1234' },
  { role: 'teacher', label: `Teacher — ${seedTeachers[0].name}`, email: seedTeachers[0].email, password: 'demo1234' },
  { role: 'parent', label: `Parent — ${seedParents[2].name}`, email: seedParents[2].email, password: 'demo1234' },
]

function seedUsers(): StoredUser[] {
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
      teacherId: seedTeachers[0].id,
      avatarColor: seedTeachers[0].avatarColor,
      schoolId: schoolSettings.id,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'demo-parent-p1',
      name: seedParents[2].name,
      email: seedParents[2].email,
      password: 'demo1234',
      role: 'parent',
      parentId: seedParents[2].id,
      avatarColor: seedParents[2].avatarColor,
      schoolId: schoolSettings.id,
      createdAt: new Date().toISOString(),
    },
  ]
}

function loadUsers(): StoredUser[] {
  if (typeof window === 'undefined') return seedUsers()
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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const data = useData()
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const users = loadUsers()
    const sessionId = window.localStorage.getItem(SESSION_KEY)
    if (sessionId) {
      const found = users.find((u) => u.id === sessionId)
      if (found) {
        const { password: _password, ...rest } = found
        setCurrentUser(rest)
      }
    }
    setIsLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login: AuthContextValue['login'] = (email, password) => {
    const users = loadUsers()
    const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!found) return { ok: false, error: 'No account found with that email address.' }
    if (found.password !== password) return { ok: false, error: 'Incorrect password. Please try again.' }
    const { password: _password, ...rest } = found
    setCurrentUser(rest)
    window.localStorage.setItem(SESSION_KEY, found.id)
    return { ok: true, role: found.role }
  }

  const signup: AuthContextValue['signup'] = ({ name, email, password, role, phone }) => {
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
    window.localStorage.setItem(SESSION_KEY, id)
    return { ok: true, role }
  }

  const logout = () => {
    setCurrentUser(null)
    window.localStorage.removeItem(SESSION_KEY)
  }

  const scope = useMemo(() => {
    if (!currentUser) return ''
    return data.scopeKey(currentUser.role, currentUser.teacherId, currentUser.parentId)
  }, [currentUser, data])

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, signup, logout, scope }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
