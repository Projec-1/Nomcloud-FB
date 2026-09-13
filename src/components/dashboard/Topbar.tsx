import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Moon, Sun, ChevronDown, Settings, LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/types'
import { useTheme } from '@/context/ThemeContext'
import { roleLabelKey } from '@/components/dashboard/navConfig'
import { useLanguage } from '@/context/LanguageContext'
import LanguageSwitcher from '@/components/layout/LanguageSwitcher'
import Avatar from '@/components/ui/Avatar'
import NotificationsDropdown from '@/components/dashboard/NotificationsDropdown'

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, logout, workspaces, activeRole, activeMembership, setActiveRole, school } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!profile || !activeMembership) return null

  const availableRoles = workspaces
  const visibleRole = activeRole && availableRoles.includes(activeRole) ? activeRole : availableRoles[0]
  if (!visibleRole) return null
  // The switcher is a convenience and NEVER a permission; Phase 7 RLS independently verifies every operation.
  const switchRole = (role: Role) => {
    setActiveRole(role)
    setMenuOpen(false)
    navigate(`/app/${role}`)
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center justify-between border-b border-ink/5 bg-white/80 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0B0B0D]/80 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onMenuClick} className="rounded-full p-2 text-ink hover:bg-ink/5 dark:text-white dark:hover:bg-white/10 lg:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink dark:text-white">{school?.name ?? ''}</p>
          <p className="text-xs text-graphite">{t(roleLabelKey[visibleRole])} Workspace</p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5">
        <LanguageSwitcher className="hidden sm:block" />
        {availableRoles.length >= 2 && (
          <div className="relative">
            <select
              value={visibleRole}
              onChange={(event) => switchRole(event.target.value as Role)}
              className="input h-9 w-auto min-w-28 appearance-none py-1 pl-3 pr-2 text-xs font-medium"
              aria-label="Switch workspace role"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {t(roleLabelKey[role])}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-full text-graphite hover:bg-ink/5 dark:hover:bg-white/10"
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <NotificationsDropdown />
        <div className="relative" ref={ref}>
          <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-ink/5 dark:hover:bg-white/10">
            <Avatar name={profile.full_name} color="#0071E3" size="sm" />
            <ChevronDown className="hidden h-3.5 w-3.5 text-graphite sm:block" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-floaty animate-fade-up dark:border-white/10 dark:bg-[#161618]">
              <div className="border-b border-ink/5 px-4 py-3 dark:border-white/10">
                <p className="truncate text-sm font-medium text-ink dark:text-white">{profile.full_name}</p>
                <p className="truncate text-xs text-graphite">{profile.email}</p>
              </div>
              <div className="p-1.5">
                {visibleRole === 'admin' && (
                  <Link
                    to="/app/admin/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-ink/5 dark:text-white dark:hover:bg-white/10"
                  >
                    <Settings className="h-4 w-4" /> {t('dash.nav.settings')}
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" /> {t('dash.topbar.signOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
