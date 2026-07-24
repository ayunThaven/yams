'use client'

import { useEffect } from 'react'
import { Socket } from 'socket.io-client'

import { useSupabase } from '@/components/Providers'
import { GameState } from '@/types/game'
import FinalLeaderboard from './FinalLeaderboard'
import GameOverActions from './GameOverActions'

interface GameOverProps {
  gameState: GameState
  mySocketId: string | undefined
  socket: Socket | null
  amIHost: boolean
}

export default function GameOver({ gameState, mySocketId, socket, amIHost }: GameOverProps) {
  const { userProfile, refreshUserProfile } = useSupabase()

  const sortedPlayers = [...gameState.players].sort((left, right) => {
    if (left.abandoned && !right.abandoned) return 1
    if (!left.abandoned && right.abandoned) return -1
    return right.totalScore - left.totalScore
  })
  const winner = sortedPlayers.find((player) => !player.abandoned) || sortedPlayers[0]
  const activePlayers = gameState.players.filter((player) => !player.abandoned)
  const topScore = activePlayers.length > 0
    ? Math.max(...activePlayers.map((player) => player.totalScore))
    : null
  const myPlayer = mySocketId
    ? gameState.players.find((player) => player.id === mySocketId)
    : null
  const isWinner = Boolean(
    myPlayer && !myPlayer.abandoned && topScore !== null && myPlayer.totalScore === topScore
  )

  useEffect(() => {
    void refreshUserProfile()
  }, [gameState.roomId, refreshUserProfile])

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Partie terminée</h1>
        <p className="text-sm text-base-content/70">Partie #{gameState.roomId.slice(0, 8)}</p>
      </div>

      <FinalLeaderboard
        gameState={gameState}
        mySocketId={mySocketId}
        winner={winner}
        isWinner={isWinner}
      />

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
