/** Classement de clôture d'une partie. */

import Image from 'next/image'
import { GameState } from '@/types/game'

interface FinalLeaderboardProps {
  gameState: GameState
  mySocketId: string | undefined
  winner: GameState['players'][0]
  winners: GameState['players']
  isTie: boolean
  isWinner: boolean
}

export default function FinalLeaderboard({ gameState, mySocketId, winner, winners, isTie, isWinner }: FinalLeaderboardProps) {
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (a.abandoned && !b.abandoned) return 1
    if (!a.abandoned && b.abandoned) return -1
    return b.totalScore - a.totalScore
  })
  const podium = sortedPlayers.filter((player) => !player.abandoned).slice(0, 3)
  const winnerNames = winners.map((player) => player.id === mySocketId ? 'Vous' : player.name).join(' et ')
  const getRank = (player: GameState['players'][0]) => {
    if (player.abandoned) return null
    return 1 + sortedPlayers.filter((other) => !other.abandoned && other.totalScore > player.totalScore).length
  }

  return (
    <section className="club-finale-results" aria-labelledby="final-results-title">
      <div className={`club-finale-winner ${isWinner ? 'is-local-winner' : ''}`}>
        {isTie ? (
          <span className="club-winner-seal-group" aria-hidden="true">
            {winners.slice(0, 3).map((player) => (
              <span className="club-winner-seal" key={player.id}>{player.avatar ? <Image src={player.avatar} alt="" width={64} height={64} unoptimized /> : player.name.charAt(0).toUpperCase()}</span>
            ))}
          </span>
        ) : <span className="club-winner-seal" aria-hidden="true">{winner.avatar ? <Image src={winner.avatar} alt="" width={64} height={64} unoptimized /> : 'I'}</span>}
        <div>
          <p className="club-eyebrow">{isTie ? 'Égalité' : 'Gagnant'}</p>
          <h2>{isTie ? (isWinner ? 'Vous partagez la victoire.' : `${winnerNames} partagent la victoire.`) : (isWinner ? 'Vous avez gagné !' : `${winner.name} a gagné.`)}</h2>
          <p>{winner.totalScore} points{isTie ? ' chacun' : ''}</p>
        </div>
      </div>

      {!isTie && podium.length > 1 && (
        <div className="club-finale-podium" aria-label="Podium final">
          {podium.map((player, index) => {
            const rank = index + 1
            return <article className={`rank-${rank} ${player.id === mySocketId ? 'is-local' : ''}`} key={player.id}>
              <span>{rank === 1 ? 'I' : rank === 2 ? 'II' : 'III'}</span>
              <strong>{player.id === mySocketId ? 'Vous' : player.name}</strong>
              <b>{player.totalScore}</b><small>points</small>
            </article>
          })}
        </div>
      )}

      <div className="club-finale-ledger">
        <header><p className="club-eyebrow">Résultats</p><h2 id="final-results-title">Classement</h2></header>
        <ol>
          {sortedPlayers.map((player) => {
            const rank = getRank(player)
            const sharesRank = rank !== null && sortedPlayers.filter((other) => !other.abandoned && other.totalScore === player.totalScore).length > 1
            return <li className={`${player.id === mySocketId ? 'is-local' : ''} ${player.abandoned ? 'is-abandoned' : ''}`} key={player.id}>
              <span className="club-finale-rank">{rank ?? '—'}</span>
              <span className="club-finale-player-mark">{player.avatar ? <Image src={player.avatar} alt="" width={36} height={36} unoptimized /> : player.name.charAt(0).toUpperCase()}</span>
              <p><strong>{player.id === mySocketId ? 'Vous' : player.name}</strong><small>{player.abandoned ? 'A abandonné' : sharesRank ? `Égalité · ${rank}re place` : rank === 1 ? 'Vainqueur' : `${rank}e place`}</small></p>
              <b>{player.totalScore}<small> pts</small></b>
            </li>
          })}
        </ol>
      </div>
    </section>
  )
}
