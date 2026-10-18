/**
 * Helpers pour la gestion de la reconnexion à une partie en cours
 */

import { Socket, Server } from 'socket.io'
import { getGameState, updatePlayerSocketId } from './gameManager'
import { cancelDisconnectTimer } from './socketDisconnectHandlers'
import { GameState } from '../types/game'

/**
 * Gère la reconnexion d'un joueur à une partie en cours
 */
export function handlePlayerReconnection(
  io: Server,
  socket: Socket,
  roomId: string,
  userId: string,
  playerName: string,
  avatar?: string
): void {
  const gameState = getGameState(roomId)
  if (!gameState) return

  // Mettre à jour le socket.id du joueur dans le gameState
  const updated = updatePlayerSocketId(roomId, userId, socket.id, avatar)
  if (updated) {
    // socket.id mis à jour pour ce joueur
  }
  
  // Annuler le timer de déconnexion si il existe
  const timerCancelled = cancelDisconnectTimer(roomId, userId)
  if (timerCancelled) {
    // Timer de déconnexion annulé pour ce joueur
  }
  
  // Récupérer l'état mis à jour
  const updatedGameState = getGameState(roomId)
  if (!updatedGameState) return

  // Envoyer l'état actuel au joueur qui se reconnecte
  socket.emit('game_started', updatedGameState)
  
  // Envoyer l'état mis à jour à TOUS les joueurs (pour sync les socket.id)
  io.to(roomId).emit('game_update', updatedGameState)
  
  // Notifier les autres joueurs de la reconnexion
  notifyReconnection(io, socket, roomId, updatedGameState, userId, playerName)
}

/**
 * Notifie les autres joueurs de la reconnexion
 */
function notifyReconnection(
  io: Server,
  socket: Socket,
  roomId: string,
  gameState: GameState,
  userId: string,
  playerName: string
): void {
  // Vérifier si le joueur est en statut abandonné
  const reconnectingPlayer = gameState.players.find(p => p.userId === userId)
  const isAbandoned = reconnectingPlayer?.abandoned || false
  
  // Notifier les autres joueurs de la reconnexion
  if (isAbandoned) {
    socket.to(roomId).emit('system_message', `${playerName} s'est reconnecté (spectateur)`)
  } else {
    socket.to(roomId).emit('system_message', `${playerName} s'est reconnecté`)
    
    // Si c'est le tour du joueur qui se reconnecte, le notifier
    const currentPlayer = gameState.players[gameState.currentPlayerIndex]
    if (currentPlayer.userId === userId) {
      io.to(roomId).emit('system_message', `C'est au tour de ${playerName}`)
    }
  }
}

