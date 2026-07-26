// Gestionnaire de l'état des parties côté serveur

import { GameState, ScoreCategory, GameVariant, ScoreSheet } from '../types/game'
import { calculateScore, calculateTotalScore, createEmptyScoreSheet, isScoreSheetComplete } from '../lib/yamsLogic'
import { canChooseCategory } from '../lib/variantLogic'
import { createDice, rollUnlockedDice } from './diceManager'
import { getGameState, setGameState, deleteGameState, clearAllGames as clearAllGameStates, restoreGameState } from './gameStateManager'
import { startTurnTimer, clearTurnTimer, clearAllTimers } from './timerManager'

/**
 * Nettoie tous les gestionnaires de jeu (utilisé au redémarrage du serveur)
 */
export function clearAllGames(): void {
  clearAllGameStates()
  clearAllTimers()
}

// Ré-exporter pour compatibilité
export { getGameState, startTurnTimer, clearTurnTimer }
export { restoreGameState }

/**
 * Met à jour le socket.id d'un joueur (reconnexion)
 * @param roomId - ID de la partie
 * @param userId - UUID de l'utilisateur
 * @param newSocketId - Nouveau socket.id
 */
export function updatePlayerSocketId(roomId: string, userId: string, newSocketId: string): boolean {
  const game = getGameState(roomId)
  if (!game) return false

  const player = game.players.find(p => p.userId === userId)
  if (!player) return false

  player.id = newSocketId
  return true
}

/**
 * Initialise une nouvelle partie
 */
export function initializeGame(
  roomId: string, 
  players: { id: string; name: string; userId?: string }[],
  variant: GameVariant = 'classic'
): GameState {
  // Mode développement : pré-remplir les scores pour des tests rapides
  
  const gameState: GameState = {
    roomId,
    players: players.sort(() => Math.random() - 0.5).map(p => ({
      id: p.id,
      name: p.name,
      userId: p.userId,
      scoreSheet: createEmptyScoreSheet(),
      totalScore: 0,
      abandoned: false,
    })),
    currentPlayerIndex: 0,
    dice: createDice(),
    rollsLeft: 3,
    turnNumber: 1,
    gameStatus: 'playing',
    winner: null,
    variant,
  }
  
  setGameState(roomId, gameState)
  return gameState
}

/**
 * Lance les dés (sauf ceux qui sont verrouillés)
 */
export function rollDice(roomId: string, playerId: string): GameState | null {
  const game = getGameState(roomId)
  if (!game) return null
  
  // Vérifier que c'est le tour du joueur
  const currentPlayer = game.players[game.currentPlayerIndex]
  if (currentPlayer.id !== playerId) {
    return game
  }
  
  // Vérifier que le joueur n'a pas abandonné
  if (currentPlayer.abandoned) {
    return game
  }
  
  if (game.rollsLeft <= 0) {
    return game
  }
  
  // Lancer uniquement les dés non verrouillés
  game.dice = rollUnlockedDice(game.dice)
  game.rollsLeft--
  
  return game
}

/**
 * Verrouille/déverrouille un dé
 */
export function toggleDieLock(roomId: string, playerId: string, dieIndex: number): GameState | null {
  const game = getGameState(roomId)
  if (!game || dieIndex < 0 || dieIndex >= 5) return null
  
  // Vérifier que c'est le tour du joueur
  const currentPlayer = game.players[game.currentPlayerIndex]
  if (currentPlayer.id !== playerId) {
    return game
  }
  
  // Vérifier que le joueur n'a pas abandonné
  if (currentPlayer.abandoned) {
    return game
  }
  
  game.dice[dieIndex].locked = !game.dice[dieIndex].locked
  
  return game
}

/**
 * Choisit une catégorie de score et passe au joueur suivant
 */
export function chooseScore(
  roomId: string, 
  playerId: string, 
  category: ScoreCategory
): GameState | null {
  const game = getGameState(roomId)
  if (!game) return null
  
  const currentPlayer = game.players[game.currentPlayerIndex]
  if (currentPlayer.id !== playerId) {
    return game
  }
  
  // Vérifier que le joueur n'a pas abandonné
  if (currentPlayer.abandoned) {
    return game
  }
  
  // Vérifier que la catégorie peut être choisie selon la variante
  if (!canChooseCategory(game.variant, category, currentPlayer.scoreSheet)) {
    return game
  }
  
  // Nettoyer le timer du tour actuel
  clearTurnTimer(roomId)
  
  // Calculer et enregistrer le score
  const diceValues = game.dice.map(d => d.value)
  const score = calculateScore(category, diceValues)
  currentPlayer.scoreSheet[category] = score
  currentPlayer.totalScore = calculateTotalScore(currentPlayer.scoreSheet)
  
  
  // Passer au joueur suivant actif (non-abandonné)
  const oldIndex = game.currentPlayerIndex
  game.currentPlayerIndex = getNextActivePlayerIndex(game)
  
  // Si on revient au premier joueur, on passe au tour suivant
  if (game.currentPlayerIndex <= oldIndex) {
    game.turnNumber++
  }
  
  // Réinitialiser pour le prochain tour
  game.dice = createDice()
  game.rollsLeft = 3
  
  // Vérifier si la partie est terminée (13 tours OU tous les joueurs actifs ont fini)
  const activePlayers = game.players.filter(p => !p.abandoned)
  const allActivePlayersFinished = activePlayers.every(p => isScoreSheetComplete(p.scoreSheet))
  
  if (game.turnNumber > 13 || allActivePlayersFinished) {
    game.gameStatus = 'finished'
    // Déterminer le gagnant parmi les joueurs actifs (non-abandonnés)
    const winner = activePlayers.reduce((prev, current) => 
      current.totalScore > prev.totalScore ? current : prev
    )
    game.winner = winner.name
  }
  
  return game
}

/**
 * Marque un joueur comme ayant abandonné
 */
export function removePlayer(roomId: string, playerId: string): GameState | null {
  const game = getGameState(roomId)
  if (!game) return null
  
  const playerIndex = game.players.findIndex(p => p.id === playerId)
  if (playerIndex === -1) return game
  
  const player = game.players[playerIndex]
  
  // Marquer le joueur comme ayant abandonné
  player.abandoned = true
  
  // Compter les joueurs actifs (non-abandonnés)
  const activePlayers = game.players.filter(p => !p.abandoned)
  
  if (activePlayers.length === 0) {
    // Plus personne, partie annulée
    clearTurnTimer(roomId)
    deleteGameState(roomId)
    return null
  } else if (activePlayers.length === 1) {
    // Un seul joueur reste, il gagne
    clearTurnTimer(roomId)
    game.gameStatus = 'finished'
    game.winner = activePlayers[0].name
    return game
  } else {
    // 2+ joueurs restent, passer au prochain joueur actif
    if (playerIndex === game.currentPlayerIndex) {
      // Si c'était le tour du joueur qui abandonne, passer au suivant
      clearTurnTimer(roomId)
      game.currentPlayerIndex = getNextActivePlayerIndex(game)
      // Réinitialiser les dés pour le prochain joueur
      game.dice = createDice()
      game.rollsLeft = 3
    }
    
    return game
  }
}

/**
 * Trouve l'index du prochain joueur actif (non-abandonné)
 */
function getNextActivePlayerIndex(game: GameState): number {
  let nextIndex = (game.currentPlayerIndex + 1) % game.players.length
  let attempts = 0
  
  // Chercher le prochain joueur non-abandonné
  while (game.players[nextIndex].abandoned && attempts < game.players.length) {
    nextIndex = (nextIndex + 1) % game.players.length
    attempts++
  }
  
  return nextIndex
}

/**
 * Alias pour getGameState (pour compatibilité)
 */
export function getGame(roomId: string): GameState | null {
  return getGameState(roomId)
}

/**
 * Supprime une partie
 */
export function deleteGame(roomId: string): void {
  deleteGameState(roomId)
}

/**
 * Réinitialise les dés pour un nouveau tour
 */
export function resetDiceForNewTurn(roomId: string): GameState | null {
  const game = getGameState(roomId)
  if (!game) return null
  
  game.dice = createDice()
  game.rollsLeft = 3
  
  return game
}

/**
 * Trouve la meilleure catégorie disponible pour les dés actuels
 */
function findBestAvailableCategory(diceValues: number[], scoreSheet: ScoreSheet, variant: GameVariant): ScoreCategory | null {
  const categories: ScoreCategory[] = [
    'ones', 'twos', 'threes', 'fours', 'fives', 'sixes',
    'threeOfKind', 'fourOfKind', 'fullHouse', 
    'smallStraight', 'largeStraight', 'yams', 'chance'
  ]
  
  let bestCategory: ScoreCategory | null = null
  let bestScore = -1
  
  for (const category of categories) {
    // Vérifier si la catégorie est disponible
    if (scoreSheet[category] !== null) continue
    
    // Vérifier si la catégorie peut être choisie selon la variante
    if (!canChooseCategory(variant, category, scoreSheet)) continue
    
    const score = calculateScore(category, diceValues)
    
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }
  
  return bestCategory
}

/**
 * Gère l'expiration du timer : choisit automatiquement le meilleur score
 * Retourne l'état du jeu mis à jour ainsi que la catégorie et le score choisis
 */
export function handleTimerExpired(roomId: string): { gameState: GameState; category: ScoreCategory; score: number; playerName: string } | null {
  const game = getGameState(roomId)
  if (!game) return null
  
  const currentPlayer = game.players[game.currentPlayerIndex]
  const playerName = currentPlayer.name
  
  // Si aucun lancer n'a été fait, simuler un lancer
  if (game.rollsLeft === 3) {
    game.dice = createDice()
    game.rollsLeft = 2
  }
  
  // Trouver le meilleur score possible
  const diceValues = game.dice.map(d => d.value)
  const bestCategory = findBestAvailableCategory(diceValues, currentPlayer.scoreSheet, game.variant)
  
  if (!bestCategory) {
    return null
  }
  
  // Calculer le score avant de le choisir
  const scoreValue = calculateScore(bestCategory, diceValues)

  // Choisir automatiquement le meilleur score
  const updatedGameState = chooseScore(roomId, currentPlayer.id, bestCategory)
  
  if (!updatedGameState) return null
  
  return {
    gameState: updatedGameState,
    category: bestCategory,
    score: scoreValue,
    playerName
  }
}

/**
 * Supprime une partie et nettoie ses timers
 */
export function deleteGameAndTimers(roomId: string): void {
  clearTurnTimer(roomId)
  deleteGame(roomId)
}
