import type { ReactNode } from 'react'
import { useState } from 'react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/context/AuthContext'

interface SignOutButtonProps {
  children: ReactNode
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

export default function SignOutButton({ children, className, type = 'button' }: SignOutButtonProps) {
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)

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
        onCancel={() => setOpen(false)}
        onConfirm={logout}
      />
    </>
  )
}
