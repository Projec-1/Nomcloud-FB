import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Building2, ClipboardList, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/utils/cn'

const links = [
  { to: '/platform/applications', label: 'Applications', icon: ClipboardList },
  { to: '/platform/schools', label: 'Schools', icon: Building2 },
]

export default function PlatformLayout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#111827] text-white">
      <header className="border-b border-white/10 bg-[#0B1220]">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <button onClick={() => navigate('/platform')} className="flex items-center gap-3 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white"><ShieldCheck className="h-5 w-5" /></span>
            <span><span className="block text-sm font-semibold">Nom Cloud Platform</span><span className="block text-xs text-slate-400">Operator workspace</span></span>
          </button>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-300 sm:block">{profile?.full_name}</span>
            <button onClick={logout} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-8 lg:flex-row">
        <nav className="flex gap-2 lg:w-56 lg:flex-col">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cn('flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors', isActive ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-white/10 hover:text-white')}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </div>
  )
}
