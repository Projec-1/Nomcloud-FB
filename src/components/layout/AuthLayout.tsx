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
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10" />
          <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-white">{title}</h1>
          <p className="mt-2 text-sm text-graphite">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 bg-mesh-orange opacity-80" />
        <div className="absolute inset-0 flex flex-col items-center justify-center p-16 text-center">
          <img src="/logo-512.png" alt="Nom Cloud" className="mb-8 h-20 w-20 animate-float object-contain" />
          <h2 className="max-w-sm text-3xl font-semibold tracking-tight text-white">
            One private system for your entire school.
          </h2>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            Administration, teaching and family life — connected, calm, and always in sync.
          </p>
        </div>
      </div>
    </div>
  )
}
