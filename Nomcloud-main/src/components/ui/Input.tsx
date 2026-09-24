import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, hint, icon, className, id, ...props }, ref) => {
  const inputId = id || props.name
  const hasIcon = Boolean(icon)

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
          {props.required && <span className="text-brand"> *</span>}
        </label>
      )}
      <div className="relative">
        {hasIcon && <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-graphite">{icon}</div>}
        <input
          ref={ref}
          id={inputId}
          className={cn('input', hasIcon && 'pl-11', error && 'border-red-400 focus:ring-red-300 focus:border-red-400', className)}
          {...props}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-graphite">{hint}</p>
      ) : null}
    </div>
  )
})
Input.displayName = 'Input'

export default Input
