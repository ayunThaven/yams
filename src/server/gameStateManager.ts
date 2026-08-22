/**
 * Module de gestion de l'état des parties
 * Responsable du stockage et de la récupération des états de jeu en mémoire
 */

import { GameState } from '../types/game'

// Stocker les états de jeu en mémoire
const games = new Map<string, GameState>()

/**
 * Récupère l'état d'une partie
 */
export function getGameState(roomId: string): GameState | null {
  return games.get(roomId) || null
}

/**
 * Enregistre l'état d'une partie
 */
export function setGameState(roomId: string, gameState: GameState): void {
  games.set(roomId, gameState)
}

export function restoreGameState(gameState: GameState): void {
  games.set(gameState.roomId, gameState)
}

/**
 * Supprime une partie
 */
export function deleteGameState(roomId: string): void {
  games.delete(roomId)
}

/**
 * Nettoie toutes les parties (utilisé au redémarrage du serveur)
 */
export function clearAllGames(): number {
  const count = games.size
  games.clear()
  return count
}

/**
 * Vérifie si une partie existe
 */
export function gameExists(roomId: string): boolean {
  return games.has(roomId)
}

