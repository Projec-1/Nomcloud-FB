import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import SignOutButton from '@/components/ui/SignOutButton'

export default function PlatformLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!location.pathname.startsWith('/platform/applications')) {
    return <Outlet />
  }

  return (
    <div className="min-h-screen bg-[#202328] text-white">
      <header className="border-b border-[#343A41] bg-[#17191C]">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <button onClick={() => navigate('/platform')} className="flex items-center gap-3 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white"><ShieldCheck className="h-5 w-5" /></span>
            <span><span className="block text-sm font-semibold">Nom Cloud Platform</span><span className="block text-xs text-slate-400">Operator workspace</span></span>
          </button>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-300 sm:block">{profile?.full_name}</span>
            <SignOutButton className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</SignOutButton>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  )
}
