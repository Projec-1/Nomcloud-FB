import type { BrandedEmail } from './emailTemplate'

const STORAGE_KEY = 'nomcloud_email_outbox'

export function queueEmail(email: BrandedEmail) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const existing = raw ? (JSON.parse(raw) as Array<BrandedEmail & { queuedAt: string }>) : []
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...email, queuedAt: new Date().toISOString() }, ...existing]))
  } catch (error) {
    console.error('[NomCloud] Could not queue email for backend delivery.', error)
    throw new Error('The request was saved, but its email notification could not be queued.')
  }
}

export function getQueuedEmails() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (error) {
    console.error('[NomCloud] Could not read queued emails.', error)
    return []
  }
}
