'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useSupabase } from '@/components/Providers'
import { useFlashMessage } from '@/contexts/FlashMessageContext'
import type { Achievement } from '@/types/achievement'
import CreateGame from '@/components/CreateGame'
import JoinGame from '@/components/JoinGame'
import RecentAchievements from '@/components/RecentAchievements'
import { ChevronRightIcon } from '@/components/icons/ClubIcons'

export default function DashboardPage() {
  const { userProfile, isLoading } = useSupabase()
  const { showAchievement } = useFlashMessage()

  useEffect(() => {
    if (isLoading) return
    try {
      const pending = sessionStorage.getItem('pending_achievements')
      if (!pending) return
      ;(JSON.parse(pending) as Achievement[]).forEach((achievement, index) => setTimeout(() => showAchievement(achievement), index * 500))
      sessionStorage.removeItem('pending_achievements')
    } catch { sessionStorage.removeItem('pending_achievements') }
  }, [isLoading, showAchievement])

  if (isLoading) return <div className="club-page club-loading-state"><span className="loading loading-spinner loading-lg"/><p>Ouverture du Hall…</p></div>

  const played = userProfile?.parties_jouees || 0
  const winRate = played ? Math.round(((userProfile?.parties_gagnees || 0) / played) * 100) : 0

  return <div className="club-page">
    <header className="club-page-header"><p className="club-eyebrow">Votre table vous attend</p><h1 className="club-page-title">Bonsoir, {userProfile?.username || 'joueur'}.</h1><p className="club-page-subtitle">Invitez vos proches, choisissez vos règles et laissez les dés décider du reste.</p></header>

    <section className="club-hall-grid" aria-label="Commencer une partie">
      <article className="club-panel club-start-card club-create-card"><span className="club-card-index">01</span><div><p className="club-eyebrow">Nouvelle table</p><h2>Ouvrir une partie</h2><p>Classique, montante ou descendante. Vous choisissez le rythme.</p></div><CreateGame/></article>
      <article className="club-panel club-start-card club-join-card"><span className="club-card-index">02</span><div><p className="club-eyebrow">Trouver une table</p><h2>Rejoindre une table</h2><p>Entrez le code transmis par l’hôte pour prendre place.</p></div><JoinGame/></article>
    </section>

    <section className="club-hall-secondary">
      <article className="club-panel club-player-summary">
        <div><p className="club-eyebrow">Carnet de joueur</p><h2>{userProfile?.username}</h2></div>
        <dl><div><dt>Niveau</dt><dd>{userProfile?.level || 1}</dd></div><div><dt>Parties</dt><dd>{played}</dd></div><div><dt>Victoires</dt><dd>{winRate}%</dd></div><div><dt>Record</dt><dd>{userProfile?.meilleur_score || '—'}</dd></div></dl>
        <Link href="/profile" className="club-inline-link">Ouvrir le carnet<ChevronRightIcon/></Link>
      </article>
      <div className="club-achievement-summary"><RecentAchievements/></div>
    </section>
  </div>
}
