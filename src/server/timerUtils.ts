/**
 * Utilitaires pour la gestion des timers de tour
 * Centralise la logique de gestion du temps pour éviter la duplication
 */

import { Server } from 'socket.io'
import { SupabaseClient } from '@supabase/supabase-js'
import { getGameState, handleTimerExpired, startTurnTimer } from './gameManager'
import { getCategoryLabel } from '../lib/categoryLabels'
import { saveGameSnapshot, saveScoreAction, updateFinishedGame } from './gameDbUtils'

/**
 * Gère l'expiration du timer et redémarre le timer suivant
 * Utilisé par les handlers de room et de jeu
 */
export async function handleTimerExpiredAndRestart(
  io: Server,
  supabase: SupabaseClient,
  roomId: string
): Promise<void> {
  const result = handleTimerExpired(roomId)
  if (!result) return
  
  const { gameState: updatedGameState, category, score, playerName, userId, diceValues, turnNumber, totalAfter, yamsFace } = result

  // L'action automatique et son snapshot doivent être durables avant toute diffusion.
  const persistedAction = userId
    ? await saveScoreAction(supabase, updatedGameState, {
      userId, playerName, turnNumber, category, diceValues, score, totalAfter, yamsFace,
    })
    : await saveGameSnapshot(supabase, updatedGameState)
  if (!persistedAction) {
    io.to(roomId).emit('error', { message: 'Impossible de sauvegarder le score automatique.' })
    return
  }
  
  // Message de score avec (afk)
  const categoryLabel = getCategoryLabel(category)
  const message = `${playerName} a marqué ${score} point${score > 1 ? 's' : ''} en ${categoryLabel} (afk)`
  io.to(roomId).emit('system_message', message)
  
  io.to(roomId).emit('game_update', updatedGameState)
  
  // Si la partie est terminée
  if (updatedGameState.gameStatus === 'finished') {
    const persisted = await updateFinishedGame(supabase, roomId, updatedGameState, 'timeout')
    if (!persisted.success) {
      io.to(roomId).emit('error', { message: 'Impossible de finaliser la partie.' })
      return
    }

    io.to(roomId).emit('game_ended', {
      winner: updatedGameState.winner,
      reason: 'timeout',
      message: `${updatedGameState.winner} remporte la partie !`,
    })
  } else {
    // Redémarrer le timer pour le joueur suivant
    const currentPlayer = updatedGameState.players[updatedGameState.currentPlayerIndex]
    io.to(roomId).emit('system_message', `C'est au tour de ${currentPlayer.name}`)
    
    // Redémarrer le timer (appel récursif)
    startTurnTimer(
      roomId,
      () => {
        void handleTimerExpiredAndRestart(io, supabase, roomId)
      },
      (timeLeft: number) => io.to(roomId).emit('turn_timer_update', timeLeft)
    )
  }
}

/**
 * Démarre le timer pour un nouveau tour
 * Centralise la logique commune d'initialisation du timer
 */
export async function startTurnTimerWithCallbacks(
  io: Server,
  supabase: SupabaseClient,
  roomId: string,
  expiresAt?: number
): Promise<void> {
  startTurnTimer(
    roomId,
    () => void handleTimerExpiredAndRestart(io, supabase, roomId),
    (timeLeft: number) => io.to(roomId).emit('turn_timer_update', timeLeft),
    expiresAt
  )
  const gameState = getGameState(roomId)
  if (gameState) await saveGameSnapshot(supabase, gameState)
}

