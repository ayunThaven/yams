/**
 * Gestionnaires d'événements Socket.IO pour la déconnexion
 * Gère disconnect et la notification aux autres joueurs
 * Avec un délai de grâce de 60 secondes avant de considérer un abandon
 */

import { getIdentityKey, matchesIdentity } from '@/lib/playerIdentity'
import { getSocketPlayerIdentity } from './playerIdentity'
import type { PlayerIdentity } from '@/types/game'
import { Server, Socket } from 'socket.io'
import { SupabaseClient } from '@supabase/supabase-js'
import { removePlayer, getGameState } from './gameManager'
import { finalizeGame, recordPlayerAbandon } from './gameFinalizationService'
import { saveGameSnapshot } from './gameDbUtils'
import { startTurnTimerWithCallbacks } from './timerUtils'

// Délai de grâce en millisecondes (60 secondes)
const DISCONNECT_GRACE_PERIOD = 60000

// Map pour stocker les timers de déconnexion en attente
// Key: roomId-userId, Value: NodeJS.Timeout
const disconnectTimers = new Map<string, NodeJS.Timeout>()

/**
 * Annule un timer de déconnexion si il existe
 */
export function cancelDisconnectTimer(roomId: string, identity: PlayerIdentity) {
  const timerKey = `${roomId}:${getIdentityKey(identity)}`
  const existingTimer = disconnectTimers.get(timerKey)
  
  if (existingTimer) {
    clearTimeout(existingTimer)
    disconnectTimers.delete(timerKey)
    return true
  }
  
  return false
}

/**
 * Configure les gestionnaires d'événements pour la déconnexion
 */
export function setupDisconnectHandlers(
  io: Server, 
  socket: Socket,
  roomStates: Map<string, { started: boolean }>,
  supabase: SupabaseClient
) {
  // Utiliser 'disconnecting' au lieu de 'disconnect' pour avoir accès aux rooms
  socket.on('disconnecting', () => {
    const playerName = socket.data.playerName || 'Un joueur'

    // Copier les rooms AVANT de faire quoi que ce soit
    const roomsCopy = Array.from(socket.rooms)

    // Notifier toutes les rooms auxquelles le joueur appartenait
    roomsCopy.forEach((roomId) => {
      if (roomId !== socket.id) {
        // Ignore la room personnelle du socket
        const roomState = roomStates.get(roomId)
        const isGameStarted = roomState?.started || false

        if (isGameStarted) {
          // Vérifier si la partie est déjà terminée
          const gameState = getGameState(roomId)
          const isGameFinished = gameState?.gameStatus === 'finished'
          
          if (isGameFinished) {
            // Partie déjà terminée, pas besoin de timer d'abandon
            return
          }

          // Vérifier si c'est un abandon volontaire (bouton Abandonner)
          if (socket.data.voluntaryAbandon) {
            // Pas de timer de grâce pour un abandon volontaire
            return
          }
          
          // Partie en cours : attendre 60 secondes avant de considérer comme abandonné
          const identity = getSocketPlayerIdentity(socket)
          
          if (identity) {
            // Notifier les autres joueurs de la déconnexion temporaire
            io.to(roomId).emit('system_message', `${playerName} s'est déconnecté (60s pour revenir)`)
            
            cancelDisconnectTimer(roomId, identity)
            const timerKey = `${roomId}:${getIdentityKey(identity)}`
            
            // Créer un timer pour l'abandon après 60 secondes
            const abandonTimer = setTimeout(async () => {
              disconnectTimers.delete(timerKey)
              const before = getGameState(roomId)
              const player = before?.players.find(p => matchesIdentity(p, identity))
              if (!before || before.gameStatus !== 'playing' || !player || player.abandoned) return
              const wasCurrentPlayer = before.players[before.currentPlayerIndex] === player
              // Resolve the current connection from the persistent identity.
              // Mark abandoned synchronously before the first database await.
              const updated = removePlayer(roomId, player.id)
              if (!updated) return
              const persist = async (attempt: number): Promise<void> => {
                try {
                  if (!await saveGameSnapshot(supabase, updated)) throw new Error('Abandon snapshot failed')
                  await recordPlayerAbandon({ io, supabase, roomId, gameState: updated, player, reason: 'abandon' })
                  if (updated.gameStatus === 'finished') {
                    await finalizeGame({ io, supabase, roomId, gameState: updated, reason: 'abandon' })
                    roomStates.set(roomId, { started: true })
                  } else {
                    io.to(roomId).emit('system_message', `${playerName} a abandonné la partie`)
                    io.to(roomId).emit('game_update', updated)
                    if (wasCurrentPlayer) await startTurnTimerWithCallbacks(io, supabase, roomId)
                  }
                } catch (error) {
                  console.error('[DISCONNECT] Abandon persistence failed:', error)
                  if (attempt < 3) setTimeout(() => void persist(attempt + 1), 5000)
                }
              }
              await persist(0)
            }, DISCONNECT_GRACE_PERIOD)
            
            // Stocker le timer
            disconnectTimers.set(timerKey, abandonTimer)
          }
        } else {
          // Salle d'attente : simple notification
          // Envoyer le message AVANT de récupérer la nouvelle liste
          io.to(roomId).emit('system_message', `${playerName} s'est déconnecté`)
          
          const room = io.sockets.adapter.rooms.get(roomId)
          const socketsInRoom = room ? Array.from(room) : []

          const players = socketsInRoom.filter(id => id !== socket.id).map((socketId) => {
            const s = io.sockets.sockets.get(socketId)
            return {
              id: socketId,
              name: s?.data?.playerName || 'Unknown',
              userId: s?.data.userId, guestSessionId: s?.data.guestSessionId, isHost: s?.data.memberships?.[roomId]?.isHost, ready: s?.data.memberships?.[roomId]?.ready,
            }
          })

          io.to(roomId).emit('room_update', {
            players,
            started: false,
          })
        }
      }
    })
  })
}

