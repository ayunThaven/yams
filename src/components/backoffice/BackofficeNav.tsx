'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { BackofficeRole } from '@/types/backoffice'

export default function BackofficeNav() {
  const path = usePathname(); const router = useRouter(); const [user, setUser] = useState<{ email: string; role: BackofficeRole } | null>(null)
  useEffect(() => { if (path === '/backoffice/login' || path === '/backoffice/activate') return; fetch('/api/backoffice/auth/me').then(async (response) => { if (response.ok) setUser((await response.json()).user); else if (response.status === 401) router.replace('/backoffice/login') }) }, [path, router])
  if (!user) return null
  async function logout() { await fetch('/api/backoffice/auth/logout', { method: 'POST' }); router.replace('/backoffice/login') }
  const links = [{ href: '/backoffice', label: 'Vue d’ensemble', icon: '◈' }, { href: '/backoffice/players', label: 'Joueurs', icon: '◎' }, { href: '/backoffice/tickets', label: 'Tickets', icon: '◇' }, ...(user.role === 'admin' ? [{ href: '/backoffice/team', label: 'Équipe', icon: '◌' }] : [])]
  return <nav className="bo-panel mb-8 flex flex-wrap items-center gap-2 p-2.5" aria-label="Navigation back-office"><Link href="/backoffice" className="mr-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-emerald-300"><span className="grid size-7 place-items-center rounded-lg bg-emerald-400 text-base text-slate-950">Y</span><span>Yams Ops</span></Link><div className="flex flex-1 flex-wrap gap-1">{links.map((link) => <Link key={link.href} href={link.href} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${path === link.href ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}><span className="mr-1.5 text-emerald-400">{link.icon}</span>{link.label}</Link>)}</div><div className="ml-auto flex items-center gap-3 border-l border-slate-800 pl-3"><span className="hidden text-right text-xs text-slate-400 md:block"><strong className="block max-w-44 truncate font-medium text-slate-200">{user.email}</strong>{user.role === 'admin' ? 'Administrateur' : 'Opérateur'}</span><button onClick={logout} className="bo-button-secondary px-3 py-2" title="Déconnexion">Sortir</button></div></nav>
}
