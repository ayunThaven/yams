/**
 * Gestionnaires d'événements pour les actions de jeu
 * Encapsule toute la logique des interactions avec Socket.IO
 */

import { Socket } from 'socket.io-client'
import { ScoreCategory, GameState } from '@/types/game'

/**
 * Démarre la partie
 */
export function handleStartGame(socket: Socket | null, roomId: string): void {
  if (!socket || !roomId) return
  // On lance d'abord un compte à rebours côté serveur.
  // Le serveur démarrera ensuite la partie automatiquement à la fin du timer.
  socket.emit('start_countdown', roomId)
}

/**
 * Quitte ou abandonne la partie
 */
export function handleLeaveGame(
  socket: Socket | null,
  roomId: string,
  started: boolean,
  onComplete: () => void
): void {
  if (socket) {
    if (started) {
      // Si la partie est démarrée, c'est un abandon
      // Émettre l'événement et attendre un peu pour qu'il soit traité par le serveur
      socket.emit('abandon_game', roomId)

      // Laisser 100ms pour que l'événement arrive au serveur avant de déconnecter
      setTimeout(() => {
        socket.disconnect()
        onComplete()
      }, 100)
    } else {
      // Sinon, c'est juste quitter la salle d'attente
      socket.emit('leave_room', roomId)
      socket.disconnect()
      onComplete()
    }
  } else {
    onComplete()
  }
}

/**
 * Lance les dés
 */
export function handleRollDice(
  socket: Socket | null,
  roomId: string,
  gameState: GameState | null,
  setIsRolling: (value: boolean) => void,
  setRollCount: (fn: (prev: number) => number) => void
): void {
  if (!socket || !gameState) return
  
  // Vérifier que c'est bien le tour du joueur avant d'émettre
  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  if (currentPlayer.id !== socket.id) {
    console.warn('[CLIENT] Tentative de lancer les dés alors que ce n\'est pas votre tour')
    return
  }
  
  // Vérifier que le joueur n'a pas abandonné
  if (currentPlayer.abandoned) {
    console.warn('[CLIENT] Tentative de lancer les dés alors que le joueur a abandonné')
    return
  }
  
  // Vérifier qu'il reste des lancers
  if (gameState.rollsLeft <= 0) {
    console.warn('[CLIENT] Tentative de lancer les dés alors qu\'il ne reste plus de lancers')
    return
  }
  
  setIsRolling(true)
  setRollCount((prev) => prev + 1)
  socket.emit('roll_dice', roomId)
}

/**
 * Verrouille/déverrouille un dé
 */
export function handleToggleDieLock(
  socket: Socket | null,
  roomId: string,
  gameState: GameState | null,
  dieIndex: number
): void {
  if (!socket || !gameState) return
  
  // Vérifier que c'est bien le tour du joueur avant d'émettre
  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  if (currentPlayer.id !== socket.id) {
    console.warn('[CLIENT] Tentative de verrouiller un dé alors que ce n\'est pas votre tour')
    return
  }
  
  // Vérifier que le joueur n'a pas abandonné
  if (currentPlayer.abandoned) {
    console.warn('[CLIENT] Tentative de verrouiller un dé alors que le joueur a abandonné')
    return
  }
  
  // Vérifier l'index du dé
  if (dieIndex < 0 || dieIndex >= 5) {
    console.warn('[CLIENT] Index de dé invalide:', dieIndex)
    return
  }
  
  socket.emit('toggle_die_lock', { roomId, dieIndex })
}

/**
 * Choisit une catégorie de score
 */
export function handleChooseScore(
  socket: Socket | null,
  roomId: string,
  category: ScoreCategory
): void {
  if (socket) {
    socket.emit('choose_score', { roomId, category })
  }
}

