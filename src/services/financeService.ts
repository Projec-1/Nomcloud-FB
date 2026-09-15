// ---------------------------------------------------------------------------
// Finance. Phase 8 batch 6 — fee_records and fee_payments.
//
// THE HIGHEST-SCRUTINY BATCH. A mistake here shows a family the wrong money, or
// shows one family another family's money. Every rule below is taken from RLS
// migration 13 (20260912000006_finance_rls) and Phase 3, not re-derived.
//
//   role                      fee_records              fee_payments
//   ------------------------  -----------------------  ----------------------
//   owner/director/admin      full read + write        full read + write
//   principal                 NONE                     NONE
//   teacher                   NONE                     NONE
//   guardian                  read own child only      read own child only
//
// Principal and teacher hold no policy on either table. That is the design's own
// conclusion, not an oversight: fees carry no campus dimension, so a principal's
// scoped authority is not expressible here and any grant would be school-wide,
// making them more powerful over money than over classes. A fee balance is also
// a direct proxy for family hardship, which is why it does not reach teaching
// staff. Nothing in this module offers either role a path.
//
// ---------------------------------------------------------------------------
// amount_paid IS NEVER WRITTEN FROM HERE. NOT ON INSERT, NOT ON UPDATE.
// ---------------------------------------------------------------------------
// It is maintained solely by the trigger `fee_payments_sync_amount_paid`, which
// fires AFTER INSERT OR UPDATE OR DELETE on fee_payments and recalculates the
// sum. The only way to change a balance is to write a payment row.
//
// Migration 13 made this structural rather than a convention, and this module
// must not undo it:
//
//   - table-level UPDATE on fee_records is REVOKED from anon and authenticated
//   - UPDATE is re-granted column by column, on seven columns, and amount_paid
//     is deliberately absent from that list
//   - sync_fee_record_amount_paid is SECURITY DEFINER, because as SECURITY
//     INVOKER its own write hit the column grant and legitimate payments failed
//     with 42501
//
// `updateFeeRecord` below therefore sends exactly the seven granted columns.
// Adding amount_paid to that object would not silently corrupt a balance; it
// would make every edit fail 42501. Either way, do not add it.
//
// ---------------------------------------------------------------------------
// STATUS IS DERIVED AT READ, NEVER STORED
// ---------------------------------------------------------------------------
// fee_records has no status column and must not gain one. SCHEMA_DESIGN §F
// lists it as derived because "stored copies drift and produce wrong money", and
// notes that `overdue` depends on today, so it cannot even be a generated
// column. `deriveFeeStatus` below is the single implementation.
//
// TENANT SCOPING. Every read pins school_id and, for a guardian, the specific
// student ids the caller already resolved through student_guardians. None asks
// broadly and lets RLS narrow it.
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase'
import { todayInTimeZone } from '@/utils/schoolCalendar'

/** The four states a fee can be in. Computed, never read from a column. */
export type FeeStatus = 'paid' | 'partial' | 'unpaid' | 'overdue'

/** The payment methods `fee_payments_method_check` allows. Keep in step with it. */
export type PaymentMethod = 'card' | 'bank_transfer' | 'cash' | 'mobile_money' | 'evc_plus' | 'edahab'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'evc_plus', label: 'EVC Plus' },
  { value: 'edahab', label: 'eDahab' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card' },
]

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method
}

/**
 * The status of one fee, derived exactly as Phase 3 specifies.
 *
 * Order matters and is not arbitrary:
 *
 *   paid      amount_paid >= amount. A settled fee is never overdue, however
 *             long ago it was due, so this is tested first.
 *   overdue   not settled and the due date has passed. This outranks partial
 *             and unpaid, because a half-paid fee two months late is overdue,
 *             not merely partial.
 *   partial   something paid, balance remaining, not yet due.
 *   unpaid    nothing paid, not yet due.
 *
 * `today` is the school's today, not the browser's. Batch 0 established this
 * after proving a UTC-based date reports the wrong day for Mogadishu after
 * 21:00 local, which here would mark a fee overdue a day early.
 */
export function deriveFeeStatus(amount: number, amountPaid: number, dueDate: string, today: string): FeeStatus {
  if (amountPaid >= amount) return 'paid'
  if (dueDate < today) return 'overdue'
  if (amountPaid > 0) return 'partial'
  return 'unpaid'
}

export interface FeePaymentView {
  id: string
  feeRecordId: string
  amount: number
  currency: string
  method: PaymentMethod
  reference: string
  paidOn: string
}

export interface FeeRecordView {
  id: string
  studentId: string
  studentName: string
  termId: string
  termName: string
  category: string
  amount: number
  /** Trigger-maintained. Read-only everywhere in the interface. */
  amountPaid: number
  currency: string
  dueDate: string
  /** Derived at read. Never stored, never sent in a write. */
  status: FeeStatus
  /** amount - amountPaid, floored at zero. */
  balance: number
  payments: FeePaymentView[]
}

/** The editable shape of a fee record. Note what is absent: amount_paid. */
export interface FeeRecordInput {
  studentId: string
  termId: string
  category: string
  amount: number
  currency: string
  dueDate: string
}

export interface PaymentInput {
  feeRecordId: string
  amount: number
  currency: string
  method: PaymentMethod
  reference: string
  paidOn: string
}

/** Raised when the UNIQUE (school_id, reference) constraint rejects a payment. */
export class DuplicateReferenceError extends Error {
  constructor(reference: string) {
    super(`Payment reference "${reference}" has already been used at this school. Enter a different reference.`)
    this.name = 'DuplicateReferenceError'
  }
}

/**
 * The signed-in auth user id, which is what auth.uid() returns inside a policy.
 *
 * fee_payments.recorded_by is a foreign key to profiles(id) and the INSERT
 * policy accepts only NULL or auth.uid(). Batch 5 found the prototype passing a
 * teachers.id and a person's name into columns of exactly this kind, so
 * attribution is resolved here and never accepted from a caller.
 */
async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

// ===========================================================================
// SHARED ASSEMBLY
// ===========================================================================

interface FeeRecordRow {
  id: string
  school_id: string
  student_id: string
  term_id: string
  category: string
  amount: number
  amount_paid: number
  currency: string
  due_date: string
}

/**
 * Turns fee rows into view models, resolving student and term names and
 * attaching payments.
 *
 * Separate scoped queries rather than embedded selects, for the reason batches 3
 * to 5 all gave: these tables reach one another through COMPOSITE foreign keys,
 * and a silent PostgREST embedding failure would look like "this family owes
 * nothing", which on a money screen is the worst possible failure mode.
 */
async function assembleFeeRecords(
  schoolId: string,
  rows: FeeRecordRow[],
  timeZone: string,
): Promise<FeeRecordView[]> {
  if (rows.length === 0) return []

  const today = todayInTimeZone(timeZone)
  const studentIds = Array.from(new Set(rows.map((r) => r.student_id)))
  const termIds = Array.from(new Set(rows.map((r) => r.term_id)))
  const feeIds = rows.map((r) => r.id)

  const [students, terms, payments] = await Promise.all([
    supabase.from('students').select('id, full_name').eq('school_id', schoolId).in('id', studentIds),
    supabase.from('terms').select('id, name').eq('school_id', schoolId).in('id', termIds),
    supabase
      .from('fee_payments')
      .select('id, fee_record_id, amount, currency, method, reference, paid_on')
      .eq('school_id', schoolId)
      .in('fee_record_id', feeIds)
      .order('paid_on', { ascending: false }),
  ])

  if (students.error) throw students.error
  if (terms.error) throw terms.error
  if (payments.error) throw payments.error

  const studentNames = new Map<string, string>()
  for (const s of (students.data ?? []) as { id: string; full_name: string }[]) studentNames.set(s.id, s.full_name)
  const termNames = new Map<string, string>()
  for (const t of (terms.data ?? []) as { id: string; name: string }[]) termNames.set(t.id, t.name)

  const paymentsByFee = new Map<string, FeePaymentView[]>()
  for (const p of (payments.data ?? []) as {
    id: string
    fee_record_id: string
    amount: number
    currency: string
    method: PaymentMethod
    reference: string
    paid_on: string
  }[]) {
    paymentsByFee.set(p.fee_record_id, [
      ...(paymentsByFee.get(p.fee_record_id) ?? []),
      {
        id: p.id,
        feeRecordId: p.fee_record_id,
        amount: Number(p.amount),
        currency: p.currency,
        method: p.method,
        reference: p.reference,
        paidOn: p.paid_on,
      },
    ])
  }

  return rows.map((r) => {
    const amount = Number(r.amount)
    const amountPaid = Number(r.amount_paid)
    return {
      id: r.id,
      studentId: r.student_id,
      studentName: studentNames.get(r.student_id) ?? '',
      termId: r.term_id,
      termName: termNames.get(r.term_id) ?? '',
      category: r.category,
      amount,
      amountPaid,
      currency: r.currency,
      dueDate: r.due_date,
      status: deriveFeeStatus(amount, amountPaid, r.due_date, today),
      balance: Math.max(0, amount - amountPaid),
      payments: paymentsByFee.get(r.id) ?? [],
    }
  })
}

// ===========================================================================
// MANAGEMENT READS AND WRITES
// ===========================================================================

/**
 * Every fee record in the school, with payments, newest due date first.
 *
 * Reachable only by owner, director and administrator. A principal or teacher
 * calling this gets an empty set, because they hold no SELECT policy — which is
 * why the calling hook decides `denied` from the caller's role and never from
 * the row count. An empty result here would otherwise be indistinguishable from
 * a school that has issued no invoices yet.
 */
export async function fetchFeeRecords(schoolId: string, timeZone: string): Promise<FeeRecordView[]> {
  const { data, error } = await supabase
    .from('fee_records')
    .select('id, school_id, student_id, term_id, category, amount, amount_paid, currency, due_date')
    .eq('school_id', schoolId)
    .order('due_date', { ascending: false })

  if (error) throw error
  return assembleFeeRecords(schoolId, (data ?? []) as FeeRecordRow[], timeZone)
}

/**
 * Creates a fee record.
 *
 * amount_paid is NOT sent. The column defaults to 0 and only the payment trigger
 * ever moves it. A new invoice always starts unpaid, which is the only correct
 * opening state: any other would assert money that no payment row supports.
 *
 * UNIQUE (school_id, student_id, term_id, category) means one invoice per
 * student per term per category, so a repeat submission surfaces as 23505
 * rather than quietly creating a second charge for the same thing.
 */
export async function createFeeRecord(schoolId: string, input: FeeRecordInput): Promise<void> {
  const { error } = await supabase.from('fee_records').insert({
    school_id: schoolId,
    student_id: input.studentId,
    term_id: input.termId,
    category: input.category,
    amount: input.amount,
    currency: input.currency,
    due_date: input.dueDate,
    // amount_paid deliberately omitted. See the header.
  })

  if (error) {
    if (error.code === '23505') {
      throw new Error('This student already has a fee of that category for that term. Edit the existing one instead.')
    }
    throw error
  }
}

/**
 * Edits a fee record.
 *
 * Sends exactly the columns migration 13 re-granted UPDATE on, minus school_id
 * which never changes. amount_paid is not among them and must not be added:
 * the column grant would reject the whole statement with 42501.
 *
 * Lowering `amount` below what has already been paid is refused by the Phase 3
 * CHECK `amount_paid <= amount` (23514), not by this code. That is deliberate.
 * The constraint is the guarantee; a client-side check would only produce a
 * friendlier message.
 */
export async function updateFeeRecord(schoolId: string, feeRecordId: string, input: FeeRecordInput): Promise<void> {
  const { error } = await supabase
    .from('fee_records')
    .update({
      student_id: input.studentId,
      term_id: input.termId,
      category: input.category,
      amount: input.amount,
      currency: input.currency,
      due_date: input.dueDate,
    })
    .eq('school_id', schoolId)
    .eq('id', feeRecordId)

  if (error) {
    if (error.code === '23514') {
      throw new Error('That amount is lower than what has already been paid against this fee.')
    }
    if (error.code === '23505') {
      throw new Error('This student already has a fee of that category for that term.')
    }
    // fee_records_prevent_paid_student_change (migration 20260915000006,
    // SYSTEM_ISSUES_LIST S6): a fee with any payment against it cannot be moved
    // to another student, so money recorded for one child never silently
    // becomes another's.
    if (error.code === 'PT409') {
      throw new Error('This fee already has payments recorded against it, so it cannot be moved to a different student.')
    }
    throw error
  }
}

/**
 * Deletes a fee record.
 *
 * A fee with payments against it cannot be deleted: the composite foreign key is
 * ON DELETE RESTRICT and raises 23503. That is the money-integrity guard, and it
 * is reported rather than worked around. Remove the payments first, deliberately.
 */
export async function deleteFeeRecord(schoolId: string, feeRecordId: string): Promise<void> {
  const { error } = await supabase.from('fee_records').delete().eq('school_id', schoolId).eq('id', feeRecordId)

  if (error) {
    if (error.code === '23503') {
      throw new Error('This fee has payments recorded against it and cannot be deleted. Remove the payments first.')
    }
    throw error
  }
}

/**
 * Records a payment against a fee record. THIS IS THE WRITE THAT MOVES MONEY.
 *
 * Inserting here is the ONLY way fee_records.amount_paid changes. The trigger
 * recalculates the fee's total from the full set of its payments, so this is a
 * sum rather than an increment and re-running it cannot double-count.
 *
 * Two database guards are surfaced rather than pre-empted:
 *
 *   23505  UNIQUE (school_id, reference). A reference is a real-world receipt
 *          number and reusing one is almost always a double entry of the same
 *          payment. Raised as DuplicateReferenceError so the form can say so
 *          plainly instead of failing silently.
 *   23514  amount_paid <= amount. An overpayment is rejected by the CHECK when
 *          the trigger writes the new total. Note the shape of this: the
 *          payment INSERT itself is what fails, because the trigger runs inside
 *          the same statement, so no orphan payment is left behind.
 */
export async function recordPayment(schoolId: string, input: PaymentInput): Promise<void> {
  const recordedBy = await currentUserId()

  const { error } = await supabase.from('fee_payments').insert({
    school_id: schoolId,
    fee_record_id: input.feeRecordId,
    amount: input.amount,
    currency: input.currency,
    method: input.method,
    reference: input.reference,
    paid_on: input.paidOn,
    // The policy accepts NULL or auth.uid() and nothing else.
    recorded_by: recordedBy,
  })

  if (error) {
    if (error.code === '23505') throw new DuplicateReferenceError(input.reference)
    if (error.code === '23514') {
      throw new Error('That payment would take the total above the fee amount. Check the balance and try again.')
    }
    throw error
  }
}

/**
 * Removes a payment, recalculating the fee balance downwards through the trigger.
 *
 * C.5 note 5 is explicit that this is the correction path today, granted to
 * owner, director and administrator, and that replacing it with a void workflow
 * remains open. Migration 13 measured the downward recalculation working.
 */
export async function deletePayment(schoolId: string, paymentId: string): Promise<void> {
  const { error } = await supabase.from('fee_payments').delete().eq('school_id', schoolId).eq('id', paymentId)

  if (error) throw error
}

// ===========================================================================
// GUARDIAN READS — READ ONLY, BY CONSTRUCTION
// ===========================================================================

/**
 * One child's fee records, with their payment history.
 *
 * There is no write counterpart and this module offers a guardian none. A
 * guardian holds SELECT on both tables and nothing else: `fee_records` has only
 * `fee_records_guardian_select`, and `fee_payments` only
 * `fee_payments_guardian_select`, which reaches the payment through
 * `is_guardian_of_fee_record` because a payment row carries no student_id.
 *
 * C.5 is explicit that a guardian-initiated payment belongs to a payment flow,
 * never to a direct INSERT. Open decision 4 is what would build that flow.
 *
 * Scoped to the one student explicitly. RLS would narrow a broader read, but a
 * broader read is not asked for.
 */
export async function fetchChildFeeRecords(
  schoolId: string,
  studentId: string,
  timeZone: string,
): Promise<FeeRecordView[]> {
  const { data, error } = await supabase
    .from('fee_records')
    .select('id, school_id, student_id, term_id, category, amount, amount_paid, currency, due_date')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .order('due_date', { ascending: false })

  if (error) throw error
  return assembleFeeRecords(schoolId, (data ?? []) as FeeRecordRow[], timeZone)
}
