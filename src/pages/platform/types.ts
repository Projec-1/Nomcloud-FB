export type SchoolStatus = 'Active' | 'Pending' | 'Under review' | 'Suspended' | 'Rejected' | 'Closed'
export type RequestStatus = 'Open' | 'In review' | 'Resolved'

export interface School {
  id: string
  code?: string
  name: string
  location: string
  admin: string
  email: string
  phone: string
  status: SchoolStatus
  plan: string
  students: number
  teachers: number
  registered: string
  activity: string
}

export interface Request {
  id: string
  type: string
  school: string
  submittedBy: string
  submitted: string
  status: RequestStatus
  summary: string
  details?: Array<{ label: string; value: string }>
  previousActions?: Array<{ date: string; operator: string; action: string }>
  source?: 'contact-message'
}
