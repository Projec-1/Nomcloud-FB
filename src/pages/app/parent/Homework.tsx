import { useMemo } from 'react'
import { ClipboardCheck, Calendar, Paperclip, Check } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useToast } from '@/context/ToastContext'
import { useSelectedChild } from '@/hooks/useSelectedChild'
import PageHeader from '@/components/ui/PageHeader'
import ChildSwitcher from '@/components/dashboard/ChildSwitcher'
import EmptyState from '@/components/ui/EmptyState'
import ResourceGate from '@/components/ui/ResourceGate'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { formatDate } from '@/utils/format'

const statusTone = { pending: 'warning', submitted: 'info', late: 'danger', graded: 'success' } as const

export default function ParentHomework() {
  const { homework, updateSubmission } = useData()
  const { showToast } = useToast()
  const { children, selectedChild, selectChild, state } = useSelectedChild()

  const childHomework = useMemo(
    () => (selectedChild ? homework.filter((h) => h.classId === selectedChild.classId).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)) : []),
    [homework, selectedChild],
  )

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title="Homework" description="Your child's homework and deadlines." />
        <ResourceGate
          state={state}
          empty={{ icon: ClipboardCheck, title: "No children linked yet", description: "Contact your school administrator to link your child's record." }}
          deniedHint="Child records are available to a linked parent or guardian."
        >
          {() => null}
        </ResourceGate>
      </div>
    )
  }


  return (
    <div>
      <PageHeader
        title="Homework"
        description={`${selectedChild.name} · ${selectedChild.className ?? ''}`}
        actions={<ChildSwitcher children={children} selectedId={selectedChild.id} onSelect={selectChild} classLabel={(c) => c.className ?? ''} />}
      />

      {childHomework.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No homework assigned" description="Homework assigned to your child's class will appear here." />
      ) : (
        <div className="space-y-4">
          {childHomework.map((hw) => {
            const submission = hw.submissions.find((s) => s.studentId === selectedChild.id)
            return (
              <div key={hw.id} className="card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone="info">{hw.subject}</Badge>
                      {submission && <Badge tone={statusTone[submission.status]}>{submission.status}</Badge>}
                    </div>
                    <p className="font-medium text-ink dark:text-white">{hw.title}</p>
                    <p className="mt-1.5 text-sm text-graphite">{hw.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-graphite">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due {formatDate(hw.dueDate)}
                      </span>
                      {hw.attachments > 0 && (
                        <span className="flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> {hw.attachments} attachment{hw.attachments === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>
                  {submission?.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Check className="h-3.5 w-3.5" />}
                      onClick={() => {
                        updateSubmission(hw.id, selectedChild.id, { status: 'submitted', submittedDate: new Date().toISOString().slice(0, 10) })
                        showToast({ type: 'success', title: 'Marked as submitted', description: `${hw.title} was marked as submitted.` })
                      }}
                    >
                      Mark as Submitted
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
