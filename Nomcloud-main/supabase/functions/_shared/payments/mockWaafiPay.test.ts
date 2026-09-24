// Offline tests for the mock WaafiPay adapter. Layer (a) of the three-layer
// proof in docs/PAYMENT_EDGE_FUNCTION_PLAN.md.
//
// Run:  npx deno test supabase/functions/_shared/payments/mockWaafiPay.test.ts
//
// No network and no remote imports: assertions are local so the suite runs
// fully offline.

import { MockWaafiPay, scenarioForAccount, scenarioFromTransactionId } from './mockWaafiPay.ts'

function assertEquals<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`)
}

const base = { referenceId: '00000000-0000-4000-8000-000000000000', amount: 25.5, currency: 'USD', method: 'mobile_money' as const }

Deno.test('scenario 1 APPROVE (...0001): pending, then commit approved', async () => {
  const p = new MockWaafiPay()
  const pre = await p.preAuthorize({ ...base, accountNo: '252615000001' })
  assertEquals(pre.eventType, 'pending', 'preAuthorize eventType')
  assertEquals(scenarioFromTransactionId(pre.transactionId), 'APPROVE', 'scenario in id')
  const done = await p.commit({ transactionId: pre.transactionId, amount: 25.5, currency: 'USD', method: 'mobile_money' })
  assertEquals(done.eventType, 'approved', 'commit eventType')
  assertEquals(done.transactionId, pre.transactionId, 'same transaction id')
  assertEquals(done.amount, 25.5, 'amount carried')
})

Deno.test('scenario 2 DECLINE (...0002): declined at preAuthorize', async () => {
  const pre = await new MockWaafiPay().preAuthorize({ ...base, accountNo: '252615000002' })
  assertEquals(pre.eventType, 'declined', 'preAuthorize eventType')
  assertEquals(scenarioFromTransactionId(pre.transactionId), 'DECLINE', 'scenario in id')
})

Deno.test('scenario 3 TIMEOUT (...0003): pending, then commit cancelled', async () => {
  const p = new MockWaafiPay()
  const pre = await p.preAuthorize({ ...base, accountNo: '252615000003' })
  assertEquals(pre.eventType, 'pending', 'preAuthorize eventType')
  const done = await p.commit({ transactionId: pre.transactionId, amount: 25.5, currency: 'USD', method: 'mobile_money' })
  assertEquals(done.eventType, 'cancelled', 'commit eventType')
})

Deno.test('scenario 4 DUPLICATE (...0004): the same approval on every commit', async () => {
  const p = new MockWaafiPay()
  const pre = await p.preAuthorize({ ...base, accountNo: '252615000004' })
  const first = await p.commit({ transactionId: pre.transactionId, amount: 25.5, currency: 'USD', method: 'mobile_money' })
  const second = await p.commit({ transactionId: pre.transactionId, amount: 25.5, currency: 'USD', method: 'mobile_money' })
  assertEquals(first.eventType, 'approved', 'first commit')
  assertEquals(second.eventType, 'approved', 'second commit')
  // Same provider, id and event type: exactly the idempotency key a replay collides on.
  assertEquals(`${second.transactionId}|${second.eventType}`, `${first.transactionId}|${first.eventType}`, 'identical key')
})

Deno.test('unknown test account never approves', async () => {
  assertEquals(scenarioForAccount('252615999999'), 'DECLINE', 'unknown suffix')
  const pre = await new MockWaafiPay().preAuthorize({ ...base, accountNo: '252615999999' })
  assertEquals(pre.eventType, 'declined', 'unknown account preAuthorize')
})

Deno.test('commit refuses a transaction id the mock did not issue', async () => {
  let threw = false
  try {
    await new MockWaafiPay().commit({ transactionId: 'REAL-12345', amount: 1, currency: 'USD', method: 'card' })
  } catch {
    threw = true
  }
  assertEquals(threw, true, 'commit on foreign id throws')
})

Deno.test('each preAuthorize issues a distinct transaction id', async () => {
  const p = new MockWaafiPay()
  const a = await p.preAuthorize({ ...base, accountNo: '252615000001' })
  const b = await p.preAuthorize({ ...base, accountNo: '252615000001' })
  assertEquals(a.transactionId !== b.transactionId, true, 'distinct ids')
})

Deno.test('all four payment methods pass through unchanged', async () => {
  for (const method of ['mobile_money', 'card', 'ussd', 'bank_agent'] as const) {
    const pre = await new MockWaafiPay().preAuthorize({ ...base, method, accountNo: '252615000001' })
    assertEquals(pre.method, method, `method ${method}`)
  }
})
