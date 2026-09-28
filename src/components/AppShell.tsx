'use client'

import { usePathname } from 'next/navigation'
import PlayerChrome, { PublicHeader } from '@/components/PlayerChrome'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isGameRoute = pathname.startsWith('/game/')
  const isBackoffice = pathname.startsWith('/backoffice')
  const isPublicRoute = ['/', '/login', '/register', '/reset-password'].includes(pathname)

  if (isBackoffice) return <>{children}</>
  if (isGameRoute) return <main className="player-app club-game-root">{children}</main>
  if (!isPublicRoute) return <div className="player-app"><PlayerChrome>{children}</PlayerChrome></div>

  return (
    <div className="player-app club-public-shell">
      <PublicHeader />
      <main className="club-public-main">{children}</main>
    </div>
  )
}
