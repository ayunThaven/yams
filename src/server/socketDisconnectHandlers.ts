/**
 * Gestionnaires d'événements Socket.IO pour la déconnexion
 * Gère disconnect et la notification aux autres joueurs
 * Avec un délai de grâce de 60 secondes avant de considérer un abandon
 */

import { Server, Socket } from 'socket.io'
import { SupabaseClient } from '@supabase/supabase-js'
import { removePlayer, getGameState } from './gameManager'
import { updateFinishedGame } from './gameDbUtils'

// Délai de grâce en millisecondes (60 secondes)
const DISCONNECT_GRACE_PERIOD = 60000

// Map pour stocker les timers de déconnexion en attente
// Key: roomId-userId, Value: NodeJS.Timeout
const disconnectTimers = new Map<string, NodeJS.Timeout>()

/**
 * Annule un timer de déconnexion si il existe
 */
export function cancelDisconnectTimer(roomId: string, userId: string) {
  const timerKey = `${roomId}-${userId}`
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
          const userId = socket.data.userId
          
          if (userId) {
            // Notifier les autres joueurs de la déconnexion temporaire
            io.to(roomId).emit('system_message', `${playerName} s'est déconnecté (60s pour revenir)`)
            
            const timerKey = `${roomId}-${userId}`
            
            // Créer un timer pour l'abandon après 60 secondes
            const abandonTimer = setTimeout(async () => {
              // Le joueur ne s'est pas reconnecté, marquer comme abandonné
              io.to(roomId).emit('system_message', `${playerName} a abandonné la partie`)
              
              // Retirer le joueur du gameState (utiliser socket.id sauvegardé)
              const updatedGame = removePlayer(roomId, socket.id)
              
              if (!updatedGame) {
                // Plus de joueurs, partie annulée
                roomStates.delete(roomId)
              } else if (updatedGame.gameStatus === 'finished') {
                const persisted = await updateFinishedGame(supabase, roomId, updatedGame)
                if (!persisted.success) {
                  io.to(roomId).emit('error', { message: 'Impossible de finaliser la partie.' })
                  disconnectTimers.delete(timerKey)
                  return
                }

                io.to(roomId).emit('game_update', updatedGame)
                io.to(roomId).emit('game_ended', {
                  winner: updatedGame.winner,
                  reason: 'abandon',
                  message: `${updatedGame.winner} remporte la partie par abandon !`,
                })
                roomStates.delete(roomId)
              } else {
                // 2+ joueurs restent, continuer
                // Compter les joueurs actifs (non-abandonnés)
                const activePlayers = updatedGame.players.filter(p => !p.abandoned)
                const activePlayersCount = activePlayers.length
                
                io.to(roomId).emit('game_update', updatedGame)
                io.to(roomId).emit(
                  'system_message',
                  `La partie continue avec ${activePlayersCount} joueur${activePlayersCount > 1 ? 's' : ''}`
                )
                
                const currentPlayer = updatedGame.players[updatedGame.currentPlayerIndex]
                io.to(roomId).emit('system_message', `C'est au tour de ${currentPlayer.name}`)
              }
              
              // Nettoyer le timer
              disconnectTimers.delete(timerKey)
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

          const players = socketsInRoom.map((socketId) => {
            const s = io.sockets.sockets.get(socketId)
            return {
              id: socketId,
              name: s?.data?.playerName || 'Unknown',
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

