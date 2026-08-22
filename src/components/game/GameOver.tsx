/**
 * Composant d'écran de fin de partie
 * Affiche les résultats, le classement et les actions disponibles
 */

'use client'

import { GameState } from '@/types/game'
import { Socket } from 'socket.io-client'
import { useSupabase } from '@/components/Providers'
import FinalLeaderboard from './FinalLeaderboard'
import GameOverActions from './GameOverActions'

interface GameOverProps {
  gameState: GameState
  mySocketId: string | undefined
  socket: Socket | null
  amIHost: boolean
}

/**
 * Composant d'écran de fin de partie
 */
export default function GameOver({ gameState, mySocketId, socket, amIHost }: GameOverProps) {
  const { userProfile } = useSupabase()

  // Trier les joueurs pour trouver le gagnant
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (a.abandoned && !b.abandoned) return 1
    if (!a.abandoned && b.abandoned) return -1
    return b.totalScore - a.totalScore
  })

  const winner = sortedPlayers.find((p) => !p.abandoned) || sortedPlayers[0]

  // Tous les joueurs actifs ayant le meilleur score sont considérés comme vainqueurs
  const activePlayers = gameState.players.filter((p) => !p.abandoned)
  const topScore =
    activePlayers.length > 0
      ? Math.max(...activePlayers.map((p) => p.totalScore))
      : null

  const myPlayer = mySocketId
    ? gameState.players.find((p) => p.id === mySocketId)
    : null

  const isWinner =
    !!myPlayer &&
    !myPlayer.abandoned &&
    topScore !== null &&
      myPlayer.totalScore === topScore

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      {/* Titre */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">Partie terminée</h1>
        <p className="text-sm text-base-content/70">Partie #{gameState.roomId.slice(0, 8)}</p>
      </div>

      {/* Classement final */}
      <FinalLeaderboard
        gameState={gameState}
        mySocketId={mySocketId}
        winner={winner}
        isWinner={isWinner}
      />

      {/* Actions */}
      <GameOverActions
        gameState={gameState}
        mySocketId={mySocketId}
        socket={socket}
        user={userProfile ? { id: userProfile.id } : null}
        amIHost={amIHost}
      />
    </div>
  )
}
