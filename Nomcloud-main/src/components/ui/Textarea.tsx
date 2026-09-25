import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, error, className, id, ...props }, ref) => {
  const areaId = id || props.name
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={areaId} className="label">
          {label}
          {props.required && <span className="text-brand"> *</span>}
        </label>
      )}
      <textarea ref={ref} id={areaId} className={cn('input min-h-[120px] resize-y', error && 'border-red-400', className)} {...props} />
      {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
    </div>
  )
})
Textarea.displayName = 'Textarea'

export default Textarea
