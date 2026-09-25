export type MockGuardian = {
  id: string
  schoolId: string
  name: string
  phone: string
  email: string | null
  relationship: string | null
  studentName: string
  studentId: string
}

const STORAGE_KEY = 'nomcloud_mock_guardians'

export function loadMockGuardians(schoolId: string): MockGuardian[] {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as MockGuardian[]
    return all.filter((guardian) => guardian.schoolId === schoolId)
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
  const key = `${guardian.schoolId}:${guardian.studentId}:${guardian.phone.toLowerCase()}`
  const next = all.filter((item) => `${item.schoolId}:${item.studentId}:${item.phone.toLowerCase()}` !== key)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...next, guardian]))
}

export function saveMockGuardians(guardians: MockGuardian[]) {
  guardians.forEach(saveMockGuardian)
}
