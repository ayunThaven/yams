/**
 * Composant affichant le classement final de la partie
 * Montre tous les joueurs triés par score
 */

import { GameState } from '@/types/game'

interface FinalLeaderboardProps {
  gameState: GameState
  mySocketId: string | undefined
  winner: GameState['players'][0]
  isWinner: boolean
}

/**
 * Composant du classement final
 */
export default function FinalLeaderboard({
  gameState,
  mySocketId,
  winner,
  isWinner,
}: FinalLeaderboardProps) {
  // Trier les joueurs : actifs par score décroissant, puis abandonnés à la fin
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (a.abandoned && !b.abandoned) return 1
    if (!a.abandoned && b.abandoned) return -1
    return b.totalScore - a.totalScore
  })

  return (
    <div className="space-y-6">
      {/* Bannière du gagnant */}
      <div
        className={`card border-2 ${isWinner ? 'border-success' : 'border-primary'} shadow-xl`}
      >
        <div className="card-body items-center text-center">
          <div className="flex items-center gap-3 mb-2">
            <span className="club-winner-seal">I</span>
            <h2 className="card-title text-3xl">
              {isWinner ? 'Vous avez gagné !' : `${winner.name} a gagné !`}
            </h2>
          </div>
          
          <p className="text-xl font-bold">Score final : {winner.totalScore} points</p>
        </div>
      </div>

      {/* Classement complet */}
      <div className="card-border-hover">
        <div className="card-body">
          <h3 className="card-title">Classement final</h3>

          <div className="space-y-2 mt-4">
            {sortedPlayers.map((player, index) => {
              const isMe = player.id === mySocketId
              const position = !player.abandoned ? index + 1 : null

              return (
                <div
                  key={player.id}
                  className={`
                    flex items-center justify-between p-4 glass rounded-lg 
                    ${isMe ? 'bg-primary/20 border-2 border-primary' : 'bg-base-300'}
                    ${player.abandoned ? 'opacity-60' : ''}
                  `}
                >
                  <div className="flex items-center gap-4">
                    {/* Position */}
                    <div className="text-2xl font-bold w-8">
                      {position !== null ? (
                        position === 1 ? (
                          'I'
                        ) : position === 2 ? (
                          'II'
                        ) : position === 3 ? (
                          'III'
                        ) : (
                          `${position}.`
                        )
                      ) : (
                        <span className="text-sm">-</span>
                      )}
                    </div>

                    {/* Nom du joueur */}
                    <div>
                      <span className="font-bold">{player.name}</span>
                      {isMe && <span className="ml-2 badge badge-primary badge-sm">Vous</span>}
                      {player.abandoned && (
                        <span className="ml-2 text-sm text-error">(Abandonné)</span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <div className="text-2xl font-bold">{player.totalScore}</div>
                    <div className="text-xs text-base-content/60">points</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

