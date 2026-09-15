/**
 * Composant pour les actions disponibles après la fin de partie
 * Boutons rematch et retour au dashboard
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Socket } from 'socket.io-client'
import { generateGameId } from '@/lib/gameIdGenerator'
import { GameState } from '@/types/game'

interface MinimalUser {
  id: string
}

interface GameOverActionsProps {
  gameState: GameState
  mySocketId: string | undefined
  socket: Socket | null
  user: MinimalUser | null
  amIHost: boolean
}

/**
 * Composant des actions après game over
 */
export default function GameOverActions({
  gameState,
  mySocketId,
  socket,
  user,
  amIHost,
}: GameOverActionsProps) {
  const router = useRouter()
  const [creatingRematch, setCreatingRematch] = useState(false)
  const [rematchAvailable, setRematchAvailable] = useState<string | null>(null)
  const isCreatingRematch = useRef(false)

  // Écouter les notifications de rematch
  useEffect(() => {
    if (!socket) return

    socket.on('rematch_available', ({ newRoomId }: { newRoomId: string; hostName: string }) => {
      setRematchAvailable(newRoomId)
    })

    return () => {
      socket.off('rematch_available')
    }
  }, [socket])

  /**
   * Crée une nouvelle partie (rematch)
   */
  const createRematch = async () => {
    if (!user) return
    
    // Empêcher les appels multiples
    if (isCreatingRematch.current) {
      return
    }

    isCreatingRematch.current = true
    setCreatingRematch(true)
    
    // Petit délai pour garantir que React affiche le loading
    await new Promise(resolve => setTimeout(resolve, 50))

    try {
      // Créer une nouvelle partie via l'API interne
      const newGameId = generateGameId()
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: newGameId, variant: gameState.variant }),
      })
      const data = await res.json()

      if (!res.ok) {
        console.error('[REMATCH] Erreur lors de la création:', data)
        alert('Erreur lors de la création de la nouvelle partie')
        isCreatingRematch.current = false
        setCreatingRematch(false)
        return
      }

      // Notifier les autres joueurs via Socket.IO
      const myPlayer = gameState.players.find((p) => p.id === mySocketId)
      if (socket && myPlayer) {
        socket.emit('rematch_created', {
          oldRoomId: gameState.roomId,
          newRoomId: newGameId,
          hostName: myPlayer.name,
        })
      }

      // Rediriger vers la nouvelle partie
      router.push(`/game/${newGameId}`)
    } catch (error) {
      console.error('[REMATCH] Erreur:', error)
      alert('Erreur lors de la création de la nouvelle partie')
      isCreatingRematch.current = false
      setCreatingRematch(false)
    }
  }

  /**
   * Rejoindre une partie rematch créée par l'hôte
   */
  const joinRematch = () => {
    if (rematchAvailable) {
      router.push(`/game/${rematchAvailable}`)
    }
  }

  /**
   * Retourner au dashboard
   */
  const goToDashboard = () => {
    // Si je suis l'hôte, notifier les autres joueurs
    if (amIHost && socket) {
      socket.emit('host_leaving_finished_game', gameState.roomId)
    }
    
    // Déconnecter et rediriger
    if (socket) {
      socket.disconnect()
    }
    router.push('/dashboard')
  }

  return (
    <div className="card-border-hover">
      <div className="card-body">
        <h3 className="card-title">Actions</h3>

        <div className="flex flex-col gap-3 mt-4">
          {/* Notification de rematch disponible */}
          {rematchAvailable && !amIHost && (
            <div className="alert alert-info">
              <span>L&apos;hôte a ouvert une nouvelle table.</span>
            </div>
          )}

          {/* Boutons */}
          {rematchAvailable ? (
            <>
              <button onClick={joinRematch} className="btn btn-success btn-lg">
                Rejoindre la nouvelle partie
              </button>
              <button onClick={goToDashboard} className="btn btn-outline">
                Retour au Hall
              </button>
            </>
          ) : amIHost ? (
            <>
              <button
                onClick={createRematch}
                className="btn btn-success btn-lg"
                disabled={creatingRematch}
              >
                {creatingRematch ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Création...
                  </>
                ) : (
                  <>Créer une revanche</>
                )}
              </button>
              <button onClick={goToDashboard} className="btn btn-outline">
                Retour au Hall
              </button>
            </>
          ) : (
            <>
              <div className="text-sm text-base-content/70 text-center">
                En attente que l&apos;hôte crée une nouvelle partie...
              </div>
              <button onClick={goToDashboard} className="btn btn-outline">
                Retour au Hall
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

