import { Outlet } from 'react-router-dom'
import PublicHeader from '@/components/layout/PublicHeader'
import PublicFooter from '@/components/layout/PublicFooter'

export default function PublicLayout() {
  return (
    <div className="public-site flex min-h-screen flex-col bg-mist dark:bg-[#17191C]">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
