import type { ReactNode } from 'react'
import Logo from '@/components/layout/Logo'

export default function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="min-h-screen bg-[#f7f8fa] dark:bg-[#0a0e14] lg:grid lg:grid-cols-[minmax(440px,0.9fr)_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <Logo className="mb-12" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-white">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-graphite">{subtitle}</p>
          <div className="mt-9 rounded-[2rem] border border-ink/[0.07] bg-white p-6 shadow-card dark:border-white/[0.08] dark:bg-white/[0.04] sm:p-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-[#222321] lg:block">
        <div className="relative flex h-full flex-col justify-between p-16">
          <div className="flex items-center gap-3 text-sm font-semibold text-white/70"><span className="h-2 w-2 rounded-full bg-brand" /> Nom Cloud platform</div>
          <div>
            <img src="/logo-512.png" alt="Nom Cloud" className="mb-8 h-16 w-16 object-contain" />
            <h2 className="max-w-lg font-display text-5xl font-semibold leading-[1.05] tracking-tight text-white">Calm systems for ambitious schools.</h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/55">One private system for administration, teaching, and family life — connected, clear, and always in sync.</p>
          </div>
          <p className="text-xs text-white/35">Private by design · Built for school communities</p>
        </div>
      </div>
    </div>
  )
}
