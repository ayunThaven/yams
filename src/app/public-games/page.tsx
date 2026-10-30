'use client'



import { usePublicGames } from '@/hooks/usePublicGames'

import Link from 'next/link'
import Image from 'next/image'


import { useSupabase } from '@/components/Providers'

import { VARIANT_NAMES } from '@/lib/variantLogic'





export default function PublicGamesPage() {
  const { session, isLoading } = useSupabase()
  const { games, loading, error } = usePublicGames(!isLoading && session.kind !== 'NONE')

  return <section className="club-page club-public-page">
    <header className="club-page-header">
      <p className="club-eyebrow">Le salon · Casual</p><h1 className="club-page-title">Parties publiques</h1><p className="club-page-subtitle">Choisissez une table et rejoignez la partie.</p>
    </header>
    <Link className="club-inline-link" href={session.kind === 'USER' ? '/dashboard' : '/play'}>← Retour au salon</Link>
    {isLoading ? <div className="club-panel club-public-empty" role="status"><span className="loading loading-spinner"/><p>Chargement des tables…</p></div> : session.kind === 'NONE' ? <div className="club-panel club-public-empty"><p className="club-eyebrow">Bienvenue</p><h2>Un pseudo pour commencer</h2><p>Choisissez votre pseudo pour découvrir les tables ouvertes.</p><Link className="club-button club-button-primary" href="/play">Choisir mon pseudo</Link></div> : <>
      <div className="club-public-list-heading"><div><p className="club-eyebrow">Tables ouvertes</p><h2>À vous de jouer</h2></div><span>{!loading && !error ? `${games.length} ${games.length === 1 ? 'table disponible' : 'tables disponibles'}` : 'Mise à jour automatique'}</span></div>
      {loading && <div className="club-panel club-public-empty" role="status"><span className="loading loading-spinner"/><p>Recherche des tables…</p></div>}
      {error && <div className="club-panel club-public-empty" role="alert"><h2>Les tables sont indisponibles</h2><p>{error}</p><p>La connexion sera réessayée automatiquement.</p></div>}
      {!loading && !error && games.length === 0 && <div className="club-panel club-public-empty"><p className="club-eyebrow">Une table à vous ?</p><h2>Pas encore de table ouverte</h2><p>Créez une partie publique et invitez les autres joueurs à vous rejoindre.</p><Link className="club-button club-button-primary" href={session.kind === 'USER' ? '/dashboard' : '/play'}>Créer une partie</Link></div>}
      {!error && games.length > 0 && <div className="club-public-list">{games.map(game => <article className="club-panel club-public-table" key={game.id}>
        <div className="club-public-host"><span className="club-public-avatar" aria-hidden="true">{game.avatar ? <Image src={game.avatar} alt="" width={46} height={46} unoptimized/> : game.host.trim().charAt(0).toUpperCase()}</span><div><p className="club-eyebrow">Table de</p><h3>{game.host}</h3></div></div>
        <div className="club-public-detail"><span>Variante</span><strong>{VARIANT_NAMES[game.variant] || game.variant}</strong></div>
        <div className="club-public-detail club-public-seats"><span>Joueurs</span><strong>{game.players} <small>/ {game.maxPlayers}</small></strong><span className="club-public-seat-track" aria-hidden="true"><i style={{ width: `${Math.min(100, game.players / game.maxPlayers * 100)}%` }}/></span></div>
        <Link className="club-button club-button-primary" href={`/game/${game.id}`} aria-label={`Rejoindre la table de ${game.host}`}>Rejoindre <span aria-hidden="true">→</span></Link>
      </article>)}</div>}
    </>}
  </section>
}
