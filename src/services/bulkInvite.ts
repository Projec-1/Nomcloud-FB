import { sendInvitation, type InviteOutcome } from '@/services/invitationService'

// ---------------------------------------------------------------------------
// Inviting many people at once.
//
// THIS IS A PACED LOOP OVER THE SINGLE INVITE, NOT A SECOND SENDING PATH. Every
// row goes through send-invitation exactly as the one-person button does, so it
// inherits, unchanged: the database deciding who may invite, the skip reasons,
// and — the part that matters most here — revoking an invitation whose email was
// not accepted. A bulk run therefore cannot leave a row falsely "Invited".
//
// WHY BATCHES, AND WHY THIS SIZE. Two real ceilings apply, and the smaller one
// binds at a different timescale than the other:
//
//   1. Supabase Auth, "Rate limit for sending emails" — currently 1800 per HOUR
//      on this project. That is 30 a minute, or one every two seconds. Exceed
//      it and Auth answers 429 over_email_send_rate_limit and sends nothing.
//   2. Gmail SMTP on a free gmail.com account — Google's published ceiling is
//      about 500 recipients per DAY for the whole account, shared with every
//      other message it sends. This is the ceiling that actually limits a
//      school, and no pacing can raise it.
//
// So the pacing below is sized against (1), which is what a burst can breach in
// seconds: five sends, then a twelve-second pause, is 25 a minute — 1500 an
// hour, comfortably inside 1800 with room for the password resets and
// activations happening alongside. (2) is a budget, not a rate, and is reported
// to the administrator rather than paced around.
//
// The pause only follows a batch that actually ASKED for an email to be sent.
// Skipped rows — no address, already active, already invited — cost nothing and
// are not paced, so a selection of mostly-skipped rows finishes at once.
// ---------------------------------------------------------------------------

/** Sends attempted together before pausing. */
export const BULK_BATCH_SIZE = 5

/** Pause after a batch that attempted at least one send. 5 per 12s = 25/min. */
export const BULK_BATCH_PAUSE_MS = 12_000

/** Google's published ceiling for a free gmail.com account, per day, account-wide. */
export const GMAIL_DAILY_RECIPIENTS = 500

/** The project's current Supabase Auth setting, per hour. */
export const SUPABASE_EMAILS_PER_HOUR = 1800

export interface BulkInviteTarget {
  id: string
  name: string
  email: string | null
}

export interface BulkInviteResult extends BulkInviteTarget {
  outcome: InviteOutcome
}

export interface BulkInviteProgress {
  /** Rows finished, including skipped ones. */
  done: number
  total: number
  /** Whoever is being invited right now, for the progress line. */
  current: string | null
  /** True while waiting out the pacing pause, so the screen can say why. */
  pausing: boolean
}

/** An attempt that asked the mail server for something, and so costs pacing. */
const consumedAnEmail = (outcome: InviteOutcome) =>
  outcome.status === 'sent' || (outcome.status === 'failed' && outcome.reason === 'email')

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Invites everybody in `targets`, in paced batches.
 *
 * One person's refusal never stops the rest: every call is caught, and a thrown
 * error becomes that row's own 'failed' outcome. The promise resolves with one
 * result per target, in the order given.
 */
export async function runBulkInvite(options: {
  schoolId: string
  role: 'teacher' | 'guardian'
  targets: BulkInviteTarget[]
  onProgress?: (progress: BulkInviteProgress) => void
  /** Polled between batches so the screen can offer a Stop. */
  shouldStop?: () => boolean
}): Promise<BulkInviteResult[]> {
  const { schoolId, role, targets, onProgress, shouldStop } = options
  const results: BulkInviteResult[] = []
  const total = targets.length

  for (let start = 0; start < total; start += BULK_BATCH_SIZE) {
    if (shouldStop?.()) break
    const batch = targets.slice(start, start + BULK_BATCH_SIZE)
    onProgress?.({ done: results.length, total, current: batch[0]?.name ?? null, pausing: false })

    const settled = await Promise.all(
      batch.map(async (target): Promise<BulkInviteResult> => {
        try {
          const outcome = await sendInvitation({ schoolId, role, personId: target.id })
          return { ...target, outcome }
        } catch (error: unknown) {
          // Never let one row reject the batch. The invitation, if one was
          // written, was already revoked by the function itself.
          return {
            ...target,
            outcome: {
              status: 'failed',
              reason: 'database',
              message: error instanceof Error ? error.message : 'The invitation could not be sent.',
            },
          }
        }
      }),
    )

    results.push(...settled)
    onProgress?.({ done: results.length, total, current: null, pausing: false })

    const more = start + BULK_BATCH_SIZE < total
    if (more && settled.some((result) => consumedAnEmail(result.outcome)) && !shouldStop?.()) {
      onProgress?.({ done: results.length, total, current: null, pausing: true })
      await wait(BULK_BATCH_PAUSE_MS)
    }
  }

  return results
}

export interface BulkInviteSummary {
  sent: BulkInviteResult[]
  skipped: BulkInviteResult[]
  failed: BulkInviteResult[]
}

export function summariseBulkInvite(results: BulkInviteResult[]): BulkInviteSummary {
  return {
    sent: results.filter((r) => r.outcome.status === 'sent'),
    skipped: results.filter((r) => r.outcome.status === 'skipped'),
    failed: results.filter((r) => r.outcome.status === 'failed'),
  }
}

/** The plain sentence for why somebody was not invited. */
export function reasonText(outcome: InviteOutcome): string {
  if (outcome.message) return outcome.message
  switch (outcome.reason) {
    case 'no_email':
      return 'No email address on record.'
    case 'already_active':
      return 'They already have access.'
    case 'already_invited':
      return 'A live invitation already exists.'
    case 'access_revoked':
      return 'Their access was revoked — restore it instead of inviting.'
    case 'not_allowed':
      return 'Only an owner, director or administrator of this school may invite.'
    case 'not_found':
      return 'That person is not in this school.'
    default:
      return 'The invitation could not be sent.'
  }
}

/**
 * How many invitations are realistically left today on the current Gmail setup.
 * An estimate for the administrator, not a guarantee: Google counts every
 * message the account sends, including ones Nom Cloud knows nothing about.
 */
export const gmailBudgetNote = (attempted: number) =>
  `Gmail allows about ${GMAIL_DAILY_RECIPIENTS} messages a day from this account in total, shared with password resets and every other email it sends. This run asked for ${attempted}.`
