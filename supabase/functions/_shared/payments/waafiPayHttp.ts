// ---------------------------------------------------------------------------
// WaafiPayHttp — the real WaafiPay adapter. DELIBERATELY NOT IMPLEMENTED.
//
// ===========================================================================
// THIS IS THE ONLY FILE THAT CHANGES WHEN A REAL WAAFIPAY ACCOUNT EXISTS.
// ===========================================================================
// Implement preAuthorize, commit and cancel below as HTTP calls to
// this.config.baseUrl, authenticated with the credentials in this.config, and
// normalise each response into a ProviderResult:
//
//   - transactionId  WaafiPay's transaction id
//   - eventType      map their states onto pending / approved / declined / cancelled
//   - method         map their payment type codes (MWALLET_ACCOUNT, DEBIT_CARD,
//                    and so on) onto mobile_money / card / ussd / bank_agent
//   - raw            the response body, unmodified
//
// Verify every mapping against WaafiPay's sandbox before setting
// WAAFIPAY_MODE=live. Nothing in start-fee-payment, settle-fee-payment,
// access.ts or the database needs to change.
//
// Until then every method throws, and getPaymentProvider() only constructs this
// class when WAAFIPAY_MODE=live and all four credentials are present, so no
// request to any external URL can be made by this codebase today.
// ---------------------------------------------------------------------------

import type { PaymentMethod, PaymentProvider, PreAuthorizeRequest, ProviderResult } from './provider.ts'

export interface WaafiPayConfig {
  merchantUid: string
  apiUserId: string
  apiKey: string
  baseUrl: string
}

const NOT_IMPLEMENTED = 'WaafiPay live integration is not implemented yet. Run with WAAFIPAY_MODE unset (mock).'

export class WaafiPayHttp implements PaymentProvider {
  readonly name = 'waafipay' as const
  readonly isMock = false

  constructor(private readonly config: WaafiPayConfig) {}

  preAuthorize(_req: PreAuthorizeRequest): Promise<ProviderResult> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }

  commit(_req: { transactionId: string; amount: number; currency: string; method: PaymentMethod }): Promise<ProviderResult> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }

  cancel(_req: { transactionId: string; amount: number; currency: string; method: PaymentMethod }): Promise<ProviderResult> {
    return Promise.reject(new Error(NOT_IMPLEMENTED))
  }
}
