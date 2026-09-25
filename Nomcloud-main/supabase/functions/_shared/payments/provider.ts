// ---------------------------------------------------------------------------
// The payment provider adapter: the one swappable piece.
//
// Both Edge Functions (start-fee-payment, settle-fee-payment) talk to WaafiPay
// only through the PaymentProvider interface below. Nothing outside the adapter
// ever sees a WaafiPay-shaped request or response: every implementation
// normalises the provider's answer into a ProviderResult.
//
// ===========================================================================
// WHAT CHANGES WHEN A REAL WAAFIPAY ACCOUNT EXISTS
// ===========================================================================
// Exactly this, and nothing else:
//
//   FILE      supabase/functions/_shared/payments/waafiPayHttp.ts
//   FUNCTIONS WaafiPayHttp.preAuthorize, WaafiPayHttp.commit, WaafiPayHttp.cancel
//             — replace the "not implemented" bodies with the real HTTP calls,
//               verified against WaafiPay's sandbox.
//
//   SECRETS   set with `supabase secrets set`, read here with Deno.env.get:
//               WAAFIPAY_MODE=live
//               WAAFIPAY_MERCHANT_UID, WAAFIPAY_API_USER_ID,
//               WAAFIPAY_API_KEY, WAAFIPAY_BASE_URL
//             Use the exact credential names WaafiPay issues; rename the four
//             constants below if theirs differ. Never VITE_-prefixed, never in
//             .env, never in the frontend.
//
// Not changed: start-fee-payment, settle-fee-payment, access.ts,
// apply_payment_event, payment_events, its RLS, and the finance tables.
//
// Only if WaafiPay's documentation requires it:
//   - status or method names outside the payment_events CHECK lists need a
//     small additive migration (mapping itself lives in waafiPayHttp.ts);
//   - if WaafiPay sends callbacks, settle-fee-payment also verifies their
//     signature before acting.
// ===========================================================================

import { MockWaafiPay } from './mockWaafiPay.ts'
import { WaafiPayHttp } from './waafiPayHttp.ts'

/** The four channels decision 4 fixed; matches payment_events_payment_method_check. */
export type PaymentMethod = 'mobile_money' | 'card' | 'ussd' | 'bank_agent'

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['mobile_money', 'card', 'ussd', 'bank_agent']

/** What the provider said. Matches payment_events_event_type_check. */
export type ProviderEventType = 'pending' | 'approved' | 'declined' | 'cancelled'

export interface PreAuthorizeRequest {
  /** Our own reference for this attempt, echoed back by the provider. */
  referenceId: string
  amount: number
  currency: string
  method: PaymentMethod
  /** The payer's wallet or account number, e.g. a mobile money number. */
  accountNo: string
}

export interface ProviderResult {
  /** The provider's transaction id. Becomes payment_events.provider_event_id. */
  transactionId: string
  eventType: ProviderEventType
  amount: number
  currency: string
  method: PaymentMethod
  /** Stored verbatim as payment_events.raw_payload. */
  raw: unknown
}

export interface PaymentProvider {
  /** The value written to payment_events.provider. */
  readonly name: 'waafipay'
  /** True for the mock. Passed to apply_payment_event, which then refuses non-demo schools. */
  readonly isMock: boolean
  preAuthorize(req: PreAuthorizeRequest): Promise<ProviderResult>
  /** Ask for the final outcome and capture the money if approved. */
  commit(req: { transactionId: string; amount: number; currency: string; method: PaymentMethod }): Promise<ProviderResult>
  cancel(req: { transactionId: string; amount: number; currency: string; method: PaymentMethod }): Promise<ProviderResult>
}

export type ProviderMode = 'mock' | 'live'

/**
 * The mode. MOCK UNLESS EXPLICITLY SET TO live.
 *
 * No secret is needed for mock mode, so a project with no WaafiPay credentials
 * can only ever run the mock, and the mock can only ever touch the demo school.
 */
export function providerMode(): ProviderMode {
  return Deno.env.get('WAAFIPAY_MODE') === 'live' ? 'live' : 'mock'
}

export function getPaymentProvider(): PaymentProvider {
  if (providerMode() === 'mock') return new MockWaafiPay()

  const merchantUid = Deno.env.get('WAAFIPAY_MERCHANT_UID')
  const apiUserId = Deno.env.get('WAAFIPAY_API_USER_ID')
  const apiKey = Deno.env.get('WAAFIPAY_API_KEY')
  const baseUrl = Deno.env.get('WAAFIPAY_BASE_URL')
  if (!merchantUid || !apiUserId || !apiKey || !baseUrl) {
    // Live mode without credentials must fail closed, never fall back to mock.
    throw new Error('WAAFIPAY_MODE is live but WaafiPay credentials are not configured')
  }
  return new WaafiPayHttp({ merchantUid, apiUserId, apiKey, baseUrl })
}
