/**
 * Historique des dernières parties terminées du joueur.
 */

'use client'

import { useEffect, useRef, useState } from 'react'
import { useSupabase } from '@/components/Providers'
import { ClockIcon, TrophyIcon } from '@/components/icons/ClubIcons'
import { VARIANT_NAMES } from '@/lib/variantLogic'
import { GameVariant } from '@/types/game'

interface PlayerScore {
  id: string
  name: string
  user_id?: string
  score: number
  abandoned: boolean
}

interface Game {
  id: string
  owner: string
  status: string
  created_at: string
  winner: string | null
  players_scores: PlayerScore[] | null
  variant: GameVariant
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

function matchOutcome(game: Game, userId?: string, email?: string) {
  const player = game.players_scores?.find((item) => item.user_id === userId)
  const abandoned = player?.abandoned ?? false
  const activePlayers = game.players_scores?.filter((item) => !item.abandoned) ?? []
  const winningScore = activePlayers.length > 0 ? Math.max(...activePlayers.map((item) => item.score)) : null
  const wonFromFinalScores = !!player && !abandoned && winningScore !== null && player.score === winningScore
  const wonFromWinnerName = activePlayers.length === 0 && (game.winner === email || game.winner === player?.name)
  const won = wonFromFinalScores || wonFromWinnerName

  if (abandoned) return { label: 'Abandonnée', tone: 'abandoned', player }
  if (won) return { label: 'Victoire', tone: 'won', player }
  return { label: 'Partie jouée', tone: 'played', player }
}

export default function GameHistory() {
  const { user } = useSupabase()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const lastFetchedUserId = useRef<string | null>(null)
  const userId = user?.id

  useEffect(() => {
    const fetchGames = async () => {
      if (!userId) {
        setLoading(false)
        return
      }

      if (lastFetchedUserId.current === userId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(false)
      lastFetchedUserId.current = userId

      try {
        const response = await fetch('/api/history', { credentials: 'include' })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Impossible de charger l’historique')
        setGames((json.data || []) as Game[])
      } catch (fetchError) {
        console.error("Erreur lors du chargement de l'historique:", fetchError)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchGames()
  }, [userId, reloadKey])

  return (
    <section className="club-history-panel club-panel" aria-labelledby="history-title">
      <header className="club-history-heading">
        <div>
          <p className="club-eyebrow">Historique</p>
          <h2 id="history-title" className="club-section-title">Dernières parties</h2>
        </div>
        {!loading && games.length > 0 && <span className="club-history-count">{games.length} parties</span>}
      </header>

      {loading ? (
        <div className="club-history-state" role="status">
          <span className="club-history-spinner" aria-hidden="true" />
          <span>Chargement de l’historique…</span>
        </div>
      ) : error ? (
        <div className="club-history-state club-history-error" role="alert">
          <span>L’historique est indisponible pour le moment.</span>
          <button className="club-text-button" type="button" onClick={() => { lastFetchedUserId.current = null; setReloadKey((key) => key + 1) }}>
            Réessayer
          </button>
        </div>
      ) : games.length === 0 ? (
        <div className="club-history-state club-history-empty">
          <span className="club-history-empty-mark" aria-hidden="true">—</span>
          <p>Vous n’avez pas encore terminé de partie.</p>
          <span>Vos dix dernières parties apparaîtront ici.</span>
        </div>
      ) : (
        <div className="club-history-ledger">
          <div className="club-history-columns" aria-hidden="true">
            <span>Table</span><span>Variante</span><span>Votre score</span><span>Issue</span>
          </div>
          <ol className="club-history-list">
            {games.map((game) => {
              const outcome = matchOutcome(game, userId, user?.email)
              const score = outcome.player?.score
              const variant = game.variant || 'classic'

              return (
                <li className={`club-history-row is-${outcome.tone}`} key={game.id}>
                  <div className="club-history-date">
                    <ClockIcon width={15} height={15} />
                    <time dateTime={game.created_at}>{formatDate(game.created_at)}</time>
                  </div>
                  <span className="club-history-variant">{VARIANT_NAMES[variant]}</span>
                  <strong className="club-history-score">{score ?? '—'}<small>{score !== undefined ? ' pts' : ''}</small></strong>
                  <div className="club-history-result">
                    {outcome.tone === 'won' && <TrophyIcon width={15} height={15} aria-label="Victoire" />}
                    <span>{outcome.label}</span>
                    {outcome.tone === 'played' && game.winner && <small>· {game.winner}</small>}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {!loading && !error && games.length > 0 && (
        <p className="club-history-note">Les dix dernières parties sont affichées ici.</p>
      )}
    </section>
  )
}
