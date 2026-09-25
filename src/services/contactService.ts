// Same pattern as demoService.ts — swap the body for a real fetch() call
// to your backend/email service when one is available.
import { queueEmail } from './emailOutbox'
import { buildClientRequestEmail } from './emailTemplate'

export interface ContactPayload {
  name: string
  email: string
  topic: string
  message: string
}

const STORAGE_KEY = 'nomcloud_contact_messages'

export async function submitContactMessage(payload: ContactPayload): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 700))
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const all = raw ? JSON.parse(raw) : []
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...payload, id: `contact-${Date.now()}`, date: new Date().toISOString() }, ...all]))
    queueEmail(buildClientRequestEmail({
      schoolName: 'Contact request',
      contactName: payload.name,
      email: payload.email,
      message: `[${payload.topic}] ${payload.message}`,
    }))
  } catch {
    // ignore storage errors in this mock implementation
  }
  // eslint-disable-next-line no-console
  console.info('[NomCloud] Contact message captured (mock):', payload)
}
