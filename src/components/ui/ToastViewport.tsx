import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import type { ToastMessage } from '@/types'
import { cn } from '@/utils/cn'

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const toneMap: Record<ToastMessage['type'], string> = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-accent',
  warning: 'text-amber-500',
}

export default function ToastViewport({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2.5 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type]
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-ink/5 dark:border-white/10 bg-white dark:bg-[#1c1c1e] p-4 shadow-floaty animate-fade-up',
            )}
          >
            <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', toneMap[toast.type])} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink dark:text-white">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-xs text-graphite">{toast.description}</p>}
            </div>
            <button onClick={() => onDismiss(toast.id)} className="text-graphite hover:text-ink dark:hover:text-white" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}
