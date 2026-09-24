import { cn } from '@/utils/cn'

interface SwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
  description?: string
}

export default function Switch({ checked, onChange, label, description }: SwitchProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-medium text-ink dark:text-white">{label}</span>}
          {description && <span className="block text-xs text-graphite">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-300',
          checked ? 'bg-brand' : 'bg-ink/15 dark:bg-white/20',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  )
}
