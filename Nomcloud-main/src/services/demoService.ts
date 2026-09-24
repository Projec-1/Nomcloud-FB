// ---------------------------------------------------------------------------
// Demo request submission service.
//
// This is intentionally isolated behind a single async function so the rest
// of the app never needs to know whether requests are handled locally or by
// a real API. To connect a real backend/email service later, replace the
// body of `submitDemoRequest` with a `fetch()` call to your endpoint (e.g.
// POST /api/demo-requests) and keep the same signature — no caller changes
// required.
// ---------------------------------------------------------------------------

export interface DemoRequestPayload {
  schoolName: string
  administratorName: string
  email: string
  phone: string
  schoolSize: string
  message: string
}

export interface DemoRequestRecord extends DemoRequestPayload {
  id: string
  submittedAt: string
}

const STORAGE_KEY = 'nomcloud_demo_requests'

function readAll(): DemoRequestRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DemoRequestRecord[]) : []
  } catch {
    return []
  }
}

export async function submitDemoRequest(payload: DemoRequestPayload): Promise<DemoRequestRecord> {
  // Simulate network latency so the UI's loading state is exercised.
  await new Promise((resolve) => setTimeout(resolve, 900))

  const record: DemoRequestRecord = {
    ...payload,
    id: `demo-${Date.now()}`,
    submittedAt: new Date().toISOString(),
  }

  const all = readAll()
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...all]))

  // eslint-disable-next-line no-console
  console.info('[NomCloud] Demo request captured (mock). Wire this up to a real backend/email service:', record)

  return record
}

export function getDemoRequests(): DemoRequestRecord[] {
  return readAll()
}
