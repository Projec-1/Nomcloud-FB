export type MockGuardian = {
  id: string
  schoolId: string
  name: string
  phone: string
  email: string | null
  relationship: string | null
  children: { studentName: string; studentId: string }[]
}

const STORAGE_KEY = 'nomcloud_mock_guardians'

export function loadMockGuardians(schoolId: string): MockGuardian[] {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as (MockGuardian & { studentName?: string; studentId?: string })[]
    return all.filter((guardian) => guardian.schoolId === schoolId).map((guardian) => ({
      ...guardian,
      children: guardian.children ?? (guardian.studentId ? [{ studentId: guardian.studentId, studentName: guardian.studentName ?? 'Student' }] : []),
    }))
  } catch {
    return []
  }
}

export function saveMockGuardian(guardian: MockGuardian) {
  const all = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as MockGuardian[]
    } catch {
      return []
    }
  })()
  const identity = (guardian.phone || guardian.email || guardian.name).trim().toLowerCase()
  const existingIndex = all.findIndex((item) => item.schoolId === guardian.schoolId && (item.phone || item.email || item.name).trim().toLowerCase() === identity)
  if (existingIndex < 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...all, guardian]))
    return
  }
  const existing = all[existingIndex]
  const children = [...(existing.children ?? []), ...guardian.children].filter((child, index, list) => list.findIndex((item) => item.studentId === child.studentId) === index)
  all[existingIndex] = { ...existing, ...guardian, children }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export function saveMockGuardians(guardians: MockGuardian[]) {
  guardians.forEach(saveMockGuardian)
}
