'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useSupabase } from './Providers'
import type { UserStats } from '@/types/user'

function Avatar({ player }: { player: UserStats }) {
  return <span className="club-ranking-avatar">{player.avatar_url ? <Image src={player.avatar_url} alt="" width={48} height={48} unoptimized/> : player.username.charAt(0).toUpperCase()}</span>
}

function RankMark({ rank }: { rank: number }) { return <span className={`club-rank-mark rank-${rank}`}>{rank < 4 ? ['I', 'II', 'III'][rank - 1] : String(rank).padStart(2, '0')}</span> }

function PlayerLine({ player, rank, current }: { player: UserStats; rank: number; current: boolean }) {
  return <article className={`club-ranking-line ${current ? 'is-current' : ''}`}>
    <RankMark rank={rank}/><Avatar player={player}/><div className="club-ranking-name"><strong>{player.username}</strong>{current && <small>Votre position</small>}</div>
    <dl><div><dt>Taux</dt><dd>{player.taux_victoire.toFixed(1)}%</dd></div><div><dt>Victoires</dt><dd>{player.parties_gagnees}</dd></div><div><dt>Record</dt><dd>{player.meilleur_score}</dd></div><div className="club-ranking-optional"><dt>Série</dt><dd>{player.serie_victoires_actuelle || '—'}</dd></div><div className="club-ranking-optional"><dt>Yams</dt><dd>{player.nombre_yams_realises || '—'}</dd></div></dl>
  </article>
}

export default function Leaderboard() {
  const { user, userProfile } = useSupabase()
  const [players, setPlayers] = useState<UserStats[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [myData, setMyData] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    fetch('/api/leaderboard')
      .then(async response => {
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || 'Le classement est indisponible.')
        setPlayers((json.data || []) as UserStats[])
        setMyRank(json.userRank || null)
        setMyData((json.userData || null) as UserStats | null)
      })
      .catch(error => setError(error instanceof Error ? error.message : 'Le classement est indisponible.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="club-ranking-state"><span className="loading loading-spinner loading-lg"/>Chargement du classement…</div>
  if (error) return <div className="club-ranking-state is-error">{error}</div>

  const podium = players.slice(0, 3)
  const canRank = !userProfile || userProfile.parties_jouees >= 5

  return <section className="club-ranking">
    {podium.length > 0 ? <div className="club-ranking-podium" aria-label="Podium">{podium.map((player, index) => {
      const rank = index + 1
      return <article key={player.id} className={`club-podium-player rank-${rank}`}><RankMark rank={rank}/><Avatar player={player}/><h2>{player.username}</h2><strong>{player.taux_victoire.toFixed(1)}%</strong><small>{player.parties_gagnees} victoires</small></article>
    })}</div> : <div className="club-ranking-empty">Terminez des parties pour apparaître dans le classement.</div>}

    {myData && myRank && <div className="club-my-rank"><span>Votre place</span><RankMark rank={myRank}/><Avatar player={myData}/><strong>{myData.username}</strong><p>{myData.taux_victoire.toFixed(1)}% de victoires</p></div>}
    {!canRank && userProfile && <p className="club-ranking-note">Encore {5 - userProfile.parties_jouees} partie{5 - userProfile.parties_jouees > 1 ? 's' : ''} avant d’apparaître dans le classement.</p>}

    {players.length > 0 && <div className="club-ranking-list"><header><span>Rang</span><span>Joueur</span><span>Performance</span></header>{players.map((player, index) => <PlayerLine key={player.id} player={player} rank={index + 1} current={player.id === user?.id}/>)}</div>}
    <p className="club-ranking-footnote">Le classement est établi par taux de victoire, puis par série, nombre de parties et Yams réalisés. Cinq parties sont nécessaires pour y apparaître.</p>
  </section>
}
