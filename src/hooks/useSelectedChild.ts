import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'

const STORAGE_KEY = 'nomcloud_selected_child'

export function useSelectedChild() {
  const { activeMembership } = useAuth()
  const { parents, students } = useData()

  const parent = parents.find((p) => p.id === activeMembership?.guardian_id)
  const children = students.filter((s) => parent?.studentIds.includes(s.id))

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (typeof window === 'undefined') return children[0]?.id ?? ''
    return window.localStorage.getItem(STORAGE_KEY) ?? children[0]?.id ?? ''
  })

  useEffect(() => {
    if (children.length === 0) return
    if (!children.some((c) => c.id === selectedId)) {
      setSelectedId(children[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children.map((c) => c.id).join(',')])

  const selectChild = (id: string) => {
    setSelectedId(id)
    window.localStorage.setItem(STORAGE_KEY, id)
  }

  const selectedChild = children.find((c) => c.id === selectedId) ?? children[0] ?? null

  return { parent, children, selectedChild, selectChild }
}
