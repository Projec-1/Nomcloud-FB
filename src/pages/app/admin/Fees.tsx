import { useMemo, useState } from 'react'
import { Wallet, CreditCard, Search, Send, FileText, TrendingUp, AlertTriangle } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import PageHeader from '@/components/ui/PageHeader'
import SearchInput from '@/components/ui/SearchInput'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Badge from '@/components/ui/Badge'
import StatCard from '@/components/ui/StatCard'
import EmptyState from '@/components/ui/EmptyState'
import Avatar from '@/components/ui/Avatar'
import type { FeeRecord, FeeStatus } from '@/types'
import { formatCurrency, formatCurrencyPrecise, formatDate } from '@/utils/format'

const statusTone: Record<FeeStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  paid: 'success',
  partial: 'warning',
  unpaid: 'neutral',
  overdue: 'danger',
}

const currentMonthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })

export default function AdminFees() {
  const { fees, students, classes, parents, recordPayment, createThread, currentTerm } = useData()
  const { profile, school } = useAuth()
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | FeeStatus>('all')
  const [payTarget, setPayTarget] = useState<FeeRecord | null>(null)
  const [statementTarget, setStatementTarget] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'card' | 'bank_transfer' | 'cash' | 'mobile_money'>('mobile_money')
  const [reference, setReference] = useState('')

  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderMonth, setReminderMonth] = useState(currentMonthName)
  const [reminderMessage, setReminderMessage] = useState('')

  const totalDue = fees.reduce((sum, f) => sum + f.amount, 0)
  const totalCollected = fees.reduce((sum, f) => sum + f.amountPaid, 0)
  const totalOutstanding = totalDue - totalCollected
  const overdueCount = fees.filter((f) => f.status === 'overdue').length

  // "This month" collected — payments recorded within the current calendar month.
  const collectedThisMonth = useMemo(() => {
    const now = new Date()
    return fees.reduce((sum, f) => {
      const monthPayments = f.payments.filter((p) => {
        const d = new Date(p.date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      return sum + monthPayments.reduce((s, p) => s + p.amount, 0)
    }, 0)
  }, [fees])

  const unpaidParentIds = useMemo(() => {
    const ids = new Set<string>()
    fees
      .filter((f) => f.status === 'unpaid' || f.status === 'overdue' || f.status === 'partial')
      .forEach((f) => {
        const student = students.find((s) => s.id === f.studentId)
        if (student) ids.add(student.parentId)
      })
    return Array.from(ids)
  }, [fees, students])

  const filtered = useMemo(() => {
    return fees.filter((f) => {
      const student = students.find((s) => s.id === f.studentId)
      const matchesSearch = student?.name.toLowerCase().includes(search.toLowerCase()) || f.category.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || f.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [fees, students, search, statusFilter])

  const openPay = (fee: FeeRecord) => {
    setPayTarget(fee)
    setAmount(String(fee.amount - fee.amountPaid))
    setReference('')
    setMethod('mobile_money')
  }

  const handleRecordPayment = () => {
    if (!payTarget) return
    const value = Number(amount)
    if (!value || value <= 0) {
      showToast({ type: 'error', title: 'Enter a valid amount' })
      return
    }
    recordPayment(payTarget.id, value, method, reference || `REF${Date.now().toString().slice(-6)}`)
    showToast({ type: 'success', title: 'Payment recorded', description: `${formatCurrency(value)} recorded for ${payTarget.category}.` })
    setPayTarget(null)
  }

  const openReminder = () => {
    setReminderMonth(currentMonthName)
    setReminderMessage(
      `Dear parent, this is a reminder that your child's school fees for ${currentMonthName} are outstanding at ${school?.name ?? ''}. Kindly settle the balance at your earliest convenience via the parent app. Thank you.`,
    )
    setReminderOpen(true)
  }

  const sendReminders = () => {
    if (unpaidParentIds.length === 0) {
      showToast({ type: 'error', title: 'No unpaid parents to remind' })
      return
    }
    unpaidParentIds.forEach((parentId) => {
      const parent = parents.find((p) => p.id === parentId)
      if (!parent) return
      createThread({
        participantIds: ['admin', parentId],
        participantNames: [profile?.full_name ?? 'School Administration', parent.name],
        subject: `Fee Reminder — ${reminderMonth}`,
        firstMessage: {
          senderId: 'admin',
          senderName: profile?.full_name ?? 'School Administration',
          body: reminderMessage,
        },
      })
    })
    showToast({
      type: 'success',
      title: 'Reminders sent',
      description: `${unpaidParentIds.length} parent${unpaidParentIds.length === 1 ? '' : 's'} notified for ${reminderMonth}.`,
    })
    setReminderOpen(false)
  }

  const statementStudent = students.find((s) => s.id === statementTarget)
  const statementFees = statementStudent ? fees.filter((f) => f.studentId === statementStudent.id && f.term === currentTerm) : []
  const payable = statementFees.reduce((sum, f) => sum + f.amount, 0)
  const paidSoFar = statementFees.reduce((sum, f) => sum + f.amountPaid, 0)
  const debitBalance = Math.max(0, payable - paidSoFar)
  const creditBalance = Math.max(0, paidSoFar - payable)
  const percentPaid = payable > 0 ? Math.min(100, Math.round((paidSoFar / payable) * 100)) : 0

  return (
    <div>
      <PageHeader
        title="Fees & Payments"
        description="Track balances, collections and outstanding fees across the school."
        actions={
          <Button variant="outline" onClick={openReminder} icon={<Send className="h-4 w-4" />}>
            Send Payment Reminder
          </Button>
        }
      />

      <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={`Collected — ${currentMonthName}`} value={formatCurrency(collectedThisMonth)} icon={TrendingUp} tint="#34A853" />
        <StatCard label="Total Collected (Term)" value={formatCurrency(totalCollected)} icon={Wallet} tint="#0071E3" />
        <StatCard label="Outstanding Balance" value={formatCurrency(totalOutstanding)} icon={Search} tint="#F59E0B" />
        <StatCard label="Overdue Invoices" value={overdueCount} icon={AlertTriangle} tint="#EF4444" />
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by student or fee category…" className="sm:w-80" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="sm:w-48">
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
          <option value="overdue">Overdue</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Wallet} title="No fee records found" description="Try adjusting your search or filters." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-ink/5 text-left text-xs text-graphite dark:border-white/10">
                <th className="px-5 py-3.5 font-medium">Student</th>
                <th className="px-5 py-3.5 font-medium">Category</th>
                <th className="px-5 py-3.5 font-medium">Amount</th>
                <th className="px-5 py-3.5 font-medium">Paid</th>
                <th className="px-5 py-3.5 font-medium">Due Date</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const student = students.find((s) => s.id === f.studentId)
                const cls = classes.find((c) => c.id === student?.classId)
                if (!student) return null
                return (
                  <tr key={f.id} className="border-b border-ink/5 last:border-b-0 dark:border-white/5">
                    <td className="px-5 py-3.5">
                      <button onClick={() => setStatementTarget(student.id)} className="flex items-center gap-3 text-left hover:opacity-80">
                        <Avatar name={student.name} color={student.avatarColor} size="sm" />
                        <div>
                          <p className="font-medium text-ink dark:text-white">{student.name}</p>
                          <p className="text-xs text-graphite">{cls?.name}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-graphite">{f.category}</td>
                    <td className="px-5 py-3.5 text-ink dark:text-white">{formatCurrency(f.amount)}</td>
                    <td className="px-5 py-3.5 text-graphite">{formatCurrency(f.amountPaid)}</td>
                    <td className="px-5 py-3.5 text-graphite">{formatDate(f.dueDate)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={statusTone[f.status]}>{f.status}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setStatementTarget(student.id)}
                          className="rounded-lg p-2 text-graphite hover:bg-ink/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
                          aria-label="View statement"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        {f.status !== 'paid' && (
                          <Button size="sm" variant="outline" onClick={() => openPay(f)}>
                            Record Payment
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title="Record Payment"
        description={payTarget ? `${payTarget.category} — balance ${formatCurrency(payTarget.amount - payTarget.amountPaid)}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment}>Record Payment</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Amount (USD)" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select label="Payment method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="mobile_money">Mobile Money</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
          </Select>
          <Input label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction reference" />
        </div>
      </Modal>

      {/* Send reminder to all unpaid parents */}
      <Modal
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        title="Send Payment Reminder"
        description={`${unpaidParentIds.length} parent${unpaidParentIds.length === 1 ? '' : 's'} currently have an unpaid or overdue balance.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReminderOpen(false)}>Cancel</Button>
            <Button onClick={sendReminders} icon={<Send className="h-4 w-4" />}>Send to {unpaidParentIds.length} Parents</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Billing month" value={reminderMonth} onChange={(e) => setReminderMonth(e.target.value)} />
          <Textarea label="Reminder message" rows={5} value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} />
          <p className="text-xs text-graphite">This message will appear in the Messages inbox of every parent with an unpaid, partial or overdue balance.</p>
        </div>
      </Modal>

      {/* Per-student billing statement */}
      <Modal open={!!statementTarget} onClose={() => setStatementTarget(null)} title="Payments" size="sm">
        {statementStudent && (
          <div>
            <div className="mb-5 flex items-center gap-3">
              <Avatar name={statementStudent.name} color={statementStudent.avatarColor} />
              <div>
                <p className="font-semibold text-ink dark:text-white">{statementStudent.name}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-graphite">
                  Billing Term: {currentTerm.toUpperCase()} {new Date().getFullYear()}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-mist p-4 dark:bg-white/5">
                <p className="text-lg font-semibold text-ink dark:text-white">{formatCurrencyPrecise(payable)}</p>
                <p className="text-xs text-graphite">Total Fees Payable</p>
              </div>
              <div className="rounded-2xl bg-mist p-4 dark:bg-white/5">
                <p className="text-lg font-semibold text-ink dark:text-white">{formatCurrencyPrecise(paidSoFar)}</p>
                <p className="text-xs text-graphite">Paid So Far</p>
              </div>
              <div className="rounded-2xl bg-mist p-4 dark:bg-white/5">
                <p className={`text-lg font-semibold ${debitBalance > 0 ? 'text-red-500' : 'text-ink dark:text-white'}`}>{formatCurrencyPrecise(debitBalance)}</p>
                <p className="text-xs text-graphite">Debit Balance</p>
              </div>
              <div className="rounded-2xl bg-mist p-4 dark:bg-white/5">
                <p className={`text-lg font-semibold ${creditBalance > 0 ? 'text-emerald-600' : 'text-ink dark:text-white'}`}>{formatCurrencyPrecise(creditBalance)}</p>
                <p className="text-xs text-graphite">Credit Balance</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-ink/5 p-4 dark:border-white/10">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-ink dark:text-white">{percentPaid}%</span>
                <span className="text-graphite">Paid So Far</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink/5 dark:bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-all duration-700" style={{ width: `${percentPaid}%` }} />
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-5 w-full justify-center"
              icon={<CreditCard className="h-4 w-4" />}
              onClick={() => {
                const fee = statementFees.find((f) => f.status !== 'paid')
                setStatementTarget(null)
                if (fee) openPay(fee)
              }}
            >
              Record a Payment
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
