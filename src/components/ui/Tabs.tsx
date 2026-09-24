import { cn } from '@/utils/cn'

interface TabsProps {
  tabs: { id: string; label: string; count?: number }[]
  active: string
  onChange: (id: string) => void
}

export default function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-full bg-ink/5 dark:bg-white/5 p-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300',
            active === tab.id
              ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-soft'
              : 'text-graphite hover:text-ink dark:hover:text-white',
          )}
        >
          {tab.label}
          {typeof tab.count === 'number' && (
            <span className={cn('rounded-full px-1.5 py-0.5 text-xs', active === tab.id ? 'bg-ink/10 dark:bg-white/15' : 'bg-ink/5 dark:bg-white/10')}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
