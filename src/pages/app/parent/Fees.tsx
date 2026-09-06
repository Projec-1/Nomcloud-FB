import { useState } from 'react'
import { Wallet, CreditCard, CheckCircle2, Download, Smartphone, Landmark } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useSelectedChild } from '@/hooks/useSelectedChild'
import PageHeader from '@/components/ui/PageHeader'
import ChildSwitcher from '@/components/dashboard/ChildSwitcher'
import EmptyState from '@/components/ui/EmptyState'
import StatCard from '@/components/ui/StatCard'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import type { FeeRecord, FeeStatus } from '@/types'
import { formatCurrency, formatDate } from '@/utils/format'
import { downloadReceiptImage } from '@/utils/receipt'

const statusTone: Record<FeeStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  paid: 'success',
  partial: 'warning',
  unpaid: 'neutral',
  overdue: 'danger',
}

type PaymentMethod = 'card' | 'mobile_money' | 'bank_transfer' | 'edahab' | 'evc_plus'

const paymentOptions: { value: PaymentMethod; label: string; description: string; icon: typeof CreditCard }[] = [
  { value: 'card', label: 'Credit / Debit Card', description: 'Visa, Mastercard', icon: CreditCard },
  { value: 'mobile_money', label: 'Mobile Money', description: 'M-Pesa & partners', icon: Smartphone },
  { value: 'evc_plus', label: 'EVC Plus', description: 'Hormuud Telecom', icon: Smartphone },
  { value: 'edahab', label: 'eDahab', description: 'Telesom mobile wallet', icon: Smartphone },
  { value: 'bank_transfer', label: 'Bank Transfer', description: 'Direct to school account', icon: Landmark },
]

export default function ParentFees() {
  const { classes, fees, recordPayment, settings } = useData()
  const { profile } = useAuth()
  const { showToast } = useToast()
  const { children, selectedChild, selectChild } = useSelectedChild()

  const [payTarget, setPayTarget] = useState<FeeRecord | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<{ reference: string; amount: number; method: PaymentMethod; category: string; date: string } | null>(null)

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title="Fees" description="Your child's fee balance and payment history." />
        <EmptyState icon={Wallet} title="No children linked yet" description="Contact your school administrator to link your child's record." />
      </div>
    )
  }

  const childFees = fees.filter((f) => f.studentId === selectedChild.id)
  const totalDue = childFees.reduce((sum, f) => sum + f.amount, 0)
  const totalPaid = childFees.reduce((sum, f) => sum + f.amountPaid, 0)
  const balance = totalDue - totalPaid
  const cls = classes.find((c) => c.id === selectedChild.classId)

  const openPay = (fee: FeeRecord) => {
    setPayTarget(fee)
    setAmount(String(fee.amount - fee.amountPaid))
    setMethod('card')
    setSuccess(false)
  }

  const handlePay = async () => {
    if (!payTarget) return
    const value = Number(amount)
    if (!value || value <= 0) {
      showToast({ type: 'error', title: 'Enter a valid amount' })
      return
    }
    setProcessing(true)
    await new Promise((r) => setTimeout(r, 1100))
    const reference = `PAY${Date.now().toString().slice(-6)}`
    recordPayment(payTarget.id, value, method === 'evc_plus' || method === 'edahab' ? 'mobile_money' : method, reference)
    setLastReceipt({ reference, amount: value, method, category: payTarget.category, date: new Date().toISOString() })
    setProcessing(false)
    setSuccess(true)
  }

  const handleDownloadReceipt = () => {
    if (!lastReceipt || !selectedChild) return
    downloadReceiptImage({
      reference: lastReceipt.reference,
      schoolName: settings.name,
      studentName: selectedChild.name,
      category: lastReceipt.category,
      amount: lastReceipt.amount,
      method: lastReceipt.method,
      payerName: profile?.full_name ?? 'Parent',
      date: lastReceipt.date,
    })
  }

  return (
    <div>
      <PageHeader
        title="Fees"
        description={`${selectedChild.name} · ${cls?.name ?? ''}`}
        actions={<ChildSwitcher children={children} selectedId={selectedChild.id} onSelect={selectChild} classLabel={(c) => classes.find((cl) => cl.id === c.classId)?.name ?? ''} />}
      />

      <div className="mb-6 grid gap-5 sm:grid-cols-3">
        <StatCard label="Total Fees" value={formatCurrency(totalDue)} icon={Wallet} tint="#0071E3" />
        <StatCard label="Amount Paid" value={formatCurrency(totalPaid)} icon={CheckCircle2} tint="#34A853" />
        <StatCard label="Balance Due" value={formatCurrency(balance)} icon={CreditCard} tint={balance > 0 ? '#F59E0B' : '#34A853'} />
      </div>

      {childFees.length === 0 ? (
        <EmptyState icon={Wallet} title="No fee records found" description="Fee records for your child will appear here." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-ink/5 text-left text-xs text-graphite dark:border-white/10">
                <th className="px-5 py-3.5 font-medium">Category</th>
                <th className="px-5 py-3.5 font-medium">Amount</th>
                <th className="px-5 py-3.5 font-medium">Paid</th>
                <th className="px-5 py-3.5 font-medium">Due Date</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {childFees.map((f) => (
                <tr key={f.id} className="border-b border-ink/5 last:border-b-0 dark:border-white/5">
                  <td className="px-5 py-3.5 text-ink dark:text-white">{f.category}</td>
                  <td className="px-5 py-3.5 text-graphite">{formatCurrency(f.amount)}</td>
                  <td className="px-5 py-3.5 text-graphite">{formatCurrency(f.amountPaid)}</td>
                  <td className="px-5 py-3.5 text-graphite">{formatDate(f.dueDate)}</td>
                  <td className="px-5 py-3.5">
                    <Badge tone={statusTone[f.status]}>{f.status}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {f.status !== 'paid' && (
                      <Button size="sm" onClick={() => openPay(f)}>
                        Pay Now
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!payTarget} onClose={() => setPayTarget(null)} title={success ? undefined : 'Pay Fee'} size="sm">
        {success ? (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-ink dark:text-white">Payment successful</h3>
            <p className="mt-2 text-sm text-graphite">
              {formatCurrency(Number(amount))} was paid towards {payTarget?.category}.
            </p>
            <Button variant="outline" className="mt-6 w-full" icon={<Download className="h-4 w-4" />} onClick={handleDownloadReceipt}>
              Download Receipt
            </Button>
            <Button className="mt-3 w-full" onClick={() => setPayTarget(null)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-graphite">
              Balance for <span className="font-medium text-ink dark:text-white">{payTarget?.category}</span>:{' '}
              {payTarget && formatCurrency(payTarget.amount - payTarget.amountPaid)}
            </p>
            <Input label="Amount (USD)" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div>
              <p className="label mb-2">Payment method</p>
              <div className="grid grid-cols-2 gap-2.5">
                {paymentOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMethod(opt.value)}
                    className={cn(
                      'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
                      method === opt.value
                        ? 'border-accent bg-accent/5 dark:bg-accent/10'
                        : 'border-ink/10 hover:border-ink/20 dark:border-white/10',
                    )}
                  >
                    <opt.icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', method === opt.value ? 'text-accent' : 'text-graphite')} />
                    <span>
                      <span className="block text-xs font-semibold text-ink dark:text-white">{opt.label}</span>
                      <span className="block text-[11px] text-graphite">{opt.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full" size="lg" loading={processing} onClick={handlePay}>
              Pay {amount ? formatCurrency(Number(amount)) : ''}
            </Button>
            <p className="text-center text-[11px] text-graphite">
              This is a demo payment flow — no real money moves. A downloadable receipt is generated after payment.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
