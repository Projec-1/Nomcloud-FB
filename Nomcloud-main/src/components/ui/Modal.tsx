import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: ReactNode
}

const sizeClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({ open, onClose, title, description, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-3xl bg-white dark:bg-[#161618] shadow-floaty animate-fade-up max-h-[90vh] flex flex-col',
          sizeClass[size],
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-ink/5 dark:border-white/10 px-6 py-5 sm:px-8">
            <div>
              {title && <h3 className="text-lg font-semibold text-ink dark:text-white">{title}</h3>}
              {description && <p className="mt-1 text-sm text-graphite">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-graphite hover:bg-ink/5 dark:hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-6 sm:px-8">{children}</div>
        {footer && <div className="border-t border-ink/5 dark:border-white/10 px-6 py-4 sm:px-8 flex items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
