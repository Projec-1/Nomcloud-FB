import type { ReactNode } from 'react'
import { useState } from 'react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/utils/errorMessage'

interface SignOutButtonProps {
  children: ReactNode
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

export default function SignOutButton({ children, className, type = 'button' }: SignOutButtonProps) {
  const { logout } = useAuth()
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      await logout()
      setOpen(false)
    } catch (error: unknown) {
      showToast({ type: 'error', title: 'Could not sign out', description: errorMessage(error) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type={type} onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title="Sign out?"
        description="Are you sure you want to sign out of Nom Cloud?"
        cancelLabel="Cancel"
        confirmLabel="Sign Out"
        danger
        loading={loading}
        onCancel={() => setOpen(false)}
        onConfirm={() => void handleLogout()}
      />
    </>
  )
}
