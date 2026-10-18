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

  if (isLoading) return <div className="club-page club-loading-state"><span className="loading loading-spinner loading-lg"/><p>Chargement…</p></div>

  const played = userProfile?.parties_jouees || 0
  const winRate = played ? Math.round(((userProfile?.parties_gagnees || 0) / played) * 100) : 0

  return <div className="club-page">
    <header className="club-page-header"><p className="club-eyebrow">Accueil</p><h1 className="club-page-title">Bonjour, {userProfile?.username || 'joueur'}.</h1><p className="club-page-subtitle">Créez une partie ou rejoignez-en une avec un code.</p></header>

    <section className="club-hall-grid" aria-label="Commencer une partie">
      <article className="club-panel club-start-card club-create-card"><span className="club-card-index">01</span><div><p className="club-eyebrow">Nouvelle partie</p><h2>Créer une partie</h2><p>Choisissez le mode de jeu qui vous convient.</p></div><CreateGame/></article>
      <article className="club-panel club-start-card club-join-card"><span className="club-card-index">02</span><div><p className="club-eyebrow">Rejoindre</p><h2>Rejoindre une partie</h2><p>Saisissez le code reçu pour rejoindre les autres joueurs.</p></div><JoinGame/></article>
    </section>

    <section className="club-hall-secondary">
      <article className="club-panel club-player-summary">
        <div><p className="club-eyebrow">Profil</p><h2>{userProfile?.username}</h2></div>
        <dl><div><dt>Niveau</dt><dd>{userProfile?.level || 1}</dd></div><div><dt>Parties</dt><dd>{played}</dd></div><div><dt>Victoires</dt><dd>{winRate}%</dd></div><div><dt>Record</dt><dd>{userProfile?.meilleur_score || '—'}</dd></div></dl>
        <Link href="/profile" className="club-inline-link">Voir le profil<ChevronRightIcon/></Link>
      </article>
      <div className="club-achievement-summary"><RecentAchievements/></div>
    </section>
  </div>
}
