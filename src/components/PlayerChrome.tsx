'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSupabase } from './Providers'
import BrandMark from './BrandMark'
import { BugIcon, HomeIcon, LogoutIcon, MenuIcon, TrophyIcon, UserIcon } from './icons/ClubIcons'

const navigation = [
  { href: '/dashboard', label: 'Hall', icon: HomeIcon },
  { href: '/leaderboard', label: 'Classement', icon: TrophyIcon },
  { href: '/profile', label: 'Profil', icon: UserIcon },
]

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname()
  return <>{navigation.map(({ href, label, icon: Icon }) => {
    const active = pathname === href
    return <Link key={href} href={href} className={mobile ? `club-bottom-link ${active ? 'is-active' : ''}` : `club-rail-link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
      <Icon className="h-5 w-5"/><span>{label}</span>
    </Link>
  })}</>
}

export function PublicHeader() {
  const { user } = useSupabase()
  return <header className="club-public-header"><BrandMark/><nav aria-label="Navigation publique">{user ? <Link href="/dashboard" className="club-button club-button-primary">Entrer dans le Hall</Link> : <><Link href="/login" className="club-link-button">Connexion</Link><Link href="/register" className="club-button club-button-primary">S&apos;inscrire</Link></>}</nav></header>
}

export default function PlayerChrome({ children }: { children: React.ReactNode }) {
  const { userProfile, refreshUserProfile } = useSupabase()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    await refreshUserProfile()
    router.push('/login')
  }

  return <div className="club-shell">
    <aside className="club-rail">
      <BrandMark href="/dashboard"/>
      <nav className="club-rail-nav" aria-label="Navigation principale"><NavLinks/></nav>
      <div className="club-rail-account">
        <button className="club-account-button" onClick={() => setMenuOpen(v => !v)} aria-expanded={menuOpen}>
          <span className="club-avatar">{userProfile?.avatar_url ? <Image src={userProfile.avatar_url} alt="" fill className="object-cover" unoptimized/> : userProfile?.username?.charAt(0).toUpperCase() || 'Y'}</span>
          <span className="min-w-0"><strong>{userProfile?.username || 'Joueur'}</strong><small>Niveau {userProfile?.level || 1}</small></span>
          <MenuIcon className="h-5 w-5"/>
        </button>
        {menuOpen && <div className="club-account-menu"><Link href="/tickets"><BugIcon/>Signaler un problème</Link><button onClick={logout}><LogoutIcon/>Déconnexion</button></div>}
      </div>
    </aside>
    <header className="club-mobile-header"><BrandMark compact href="/dashboard"/><span className="club-mobile-wordmark">Yams</span><button onClick={() => setMenuOpen(v => !v)} className="club-icon-button" aria-label="Menu du compte"><MenuIcon/></button>{menuOpen && <div className="club-mobile-menu"><Link href="/tickets" onClick={() => setMenuOpen(false)}><BugIcon/>Signaler un problème</Link><button onClick={logout}><LogoutIcon/>Déconnexion</button></div>}</header>
    <main className="club-main">{children}</main>
    <nav className="club-bottom-nav" aria-label="Navigation principale"><NavLinks mobile/></nav>
  </div>
}
