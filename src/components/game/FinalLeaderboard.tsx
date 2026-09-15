/** Classement de clôture d'une partie. */

import { GameState } from '@/types/game'

interface FinalLeaderboardProps {
  gameState: GameState
  mySocketId: string | undefined
  winner: GameState['players'][0]
  isWinner: boolean
}

export default function FinalLeaderboard({ gameState, mySocketId, winner, isWinner }: FinalLeaderboardProps) {
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (a.abandoned && !b.abandoned) return 1
    if (!a.abandoned && b.abandoned) return -1
    return b.totalScore - a.totalScore
  })
  const podium = sortedPlayers.filter((player) => !player.abandoned).slice(0, 3)

  return (
    <section className="club-finale-results" aria-labelledby="final-results-title">
      <div className={`club-finale-winner ${isWinner ? 'is-local-winner' : ''}`}>
        <span className="club-winner-seal" aria-hidden="true">I</span>
        <div>
          <p className="club-eyebrow">Victoire</p>
          <h2>{isWinner ? 'Vous tenez la table.' : `${winner.name} tient la table.`}</h2>
          <p>{winner.totalScore} points au terme de la partie</p>
        </div>
      </div>

      {podium.length > 1 && (
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
        <header><p className="club-eyebrow">Résultat complet</p><h2 id="final-results-title">Classement final</h2></header>
        <ol>
          {sortedPlayers.map((player, index) => {
            const rank = player.abandoned ? null : index + 1
            return <li className={`${player.id === mySocketId ? 'is-local' : ''} ${player.abandoned ? 'is-abandoned' : ''}`} key={player.id}>
              <span className="club-finale-rank">{rank ?? '—'}</span>
              <span className="club-finale-player-mark">{player.name.charAt(0).toUpperCase()}</span>
              <p><strong>{player.id === mySocketId ? 'Vous' : player.name}</strong><small>{player.abandoned ? 'A quitté la table' : rank === 1 ? 'Vainqueur' : `${rank}${rank === 1 ? 'er' : 'e'} place`}</small></p>
              <b>{player.totalScore}<small> pts</small></b>
            </li>
          })}
        </ol>
      </div>
    </section>
  )
}
