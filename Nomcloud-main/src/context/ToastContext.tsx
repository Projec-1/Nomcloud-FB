import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { ToastMessage } from '@/types'
import { makeId } from '@/utils/id'
import ToastViewport from '@/components/ui/ToastViewport'

interface ToastContextValue {
  toasts: ToastMessage[]
  showToast: (toast: Omit<ToastMessage, 'id'>) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = makeId('toast')
      setToasts((prev) => [...prev, { ...toast, id }])
      window.setTimeout(() => dismissToast(id), 4500)
    },
    [dismissToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
