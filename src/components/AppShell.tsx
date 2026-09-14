'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isGameRoute = pathname.startsWith('/game/')

  return (
    <>
      {!isGameRoute && <Navbar />}
      <main className={isGameRoute ? '' : 'mx-auto max-w-6xl p-4'}>{children}</main>
    </>
  )
}
