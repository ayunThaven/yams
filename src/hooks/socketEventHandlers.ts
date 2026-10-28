/**
 * Gestionnaires d'événements Socket.IO côté client
 * Sépare la logique des listeners pour améliorer la lisibilité
 */

import { Socket } from 'socket.io-client'
import { Dispatch, SetStateAction } from 'react'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { GameState } from '@/types/game'
import { logger } from '@/lib/logger'

type Player = { id: string; name: string; ready?: boolean; isHost?: boolean }

/**
 * Configure les listeners de base (room_update, game_started, game_update)
 */
export function setupBasicListeners(
  socket: Socket,
  setPlayers: Dispatch<SetStateAction<Player[]>>,
  setStarted: Dispatch<SetStateAction<boolean>>,
  setIsHost: Dispatch<SetStateAction<boolean>>,
  setGameState: Dispatch<SetStateAction<GameState | null>>,
  setRoomJoined: Dispatch<SetStateAction<boolean>>,
  setPreGameCountdown: Dispatch<SetStateAction<number | null>>
): void {
  // Mise à jour de la room
  socket.on('room_update', (room: { players: Player[]; started: boolean }) => {
    setPlayers(room.players)
    setStarted(room.started)
    const amIHost = room.players.some(p => p.id === socket.id && p.isHost)
    setIsHost(amIHost)
    setRoomJoined(true)
  })

  // Partie démarrée
  socket.on('game_started', (initialState: GameState) => {
    setStarted(true)
    setGameState(initialState)
    // On cache le compte à rebours éventuel une fois la partie démarrée
    setPreGameCountdown(null)
    setRoomJoined(true)
  })

  // Mise à jour du jeu
  socket.on('game_update', (updatedState: GameState) => {
    setGameState(updatedState)
  })

  // Début du compte à rebours avant la partie
  socket.on('countdown_started', (initialSeconds: number) => {
    setPreGameCountdown(initialSeconds)
  })

  // Tick du compte à rebours
  socket.on('countdown_tick', (remainingSeconds: number) => {
    setPreGameCountdown(remainingSeconds)
  })

  // Annulation du compte à rebours (ex: plus assez de joueurs)
  socket.on('countdown_cancelled', () => {
    setPreGameCountdown(null)
  })
}

/**
 * Configure les listeners de messages et de fin de partie
 */
export function setupMessageListeners(
  socket: Socket,
  setSystemMessages: Dispatch<SetStateAction<string[]>>,
  setGameEnded: Dispatch<SetStateAction<boolean>>,
  router: AppRouterInstance,
  home = '/dashboard'
): void {
  // Message système
  socket.on('system_message', (message: string) => {
    logger.info('[CLIENT] Message système reçu:', message)
    setSystemMessages((prev) => [...prev, message])
  })

  // Partie terminée
  socket.on('game_ended', () => {
    setGameEnded(true)
  })

  // L'hôte a quitté une partie terminée
  socket.on('host_left_finished_game', (data: { message: string }) => {
    logger.info('Hôte a quitté la partie terminée:', data.message)
    alert(data.message)
    router.replace(home)
  })
}

/**
 * Configure les listeners d'erreurs et de parties introuvables
 */
export function setupErrorListeners(
  socket: Socket,
  socketRef: { current: Socket | null },
  isConnectingRef: { current: boolean },
  setRoomJoined: Dispatch<SetStateAction<boolean>>,
  router: AppRouterInstance,
  home = '/dashboard',
  retryPath = home
): void {
  // Partie introuvable
  socket.on('game_not_found', (data: { message: string }) => {
    logger.error('Partie introuvable:', data.message)
    router.replace(home)
  })

  // Erreur générale
  socket.on('error', (data: { message: string }) => {
    logger.error('Erreur:', data.message)
    
    // Déconnecter et nettoyer le socket
    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.disconnect()
      socketRef.current = null
    }
    isConnectingRef.current = false
    setRoomJoined(false)
    
    alert(data.message)
    router.replace(retryPath)
  })

  // Erreur de connexion
  socket.on('connect_error', (error) => {
    logger.error('Erreur de connexion:', error)
    isConnectingRef.current = false
  })

  // Déconnexion
  socket.on('disconnect', () => {
    isConnectingRef.current = false
  })
}

/**
 * Configure les listeners pour les dés et le timer
 */
export function setupGameplayListeners(
  socket: Socket,
  setDiceRolledTrigger: Dispatch<SetStateAction<number>>,
  setTurnTimeLeft: Dispatch<SetStateAction<number | null>>
): void {
  // Dés lancés
  socket.on('dice_rolled', () => {
    setDiceRolledTrigger(prev => prev + 1)
  })

  // Mise à jour du timer du tour
  socket.on('turn_timer_update', (timeLeft: number) => {
    setTurnTimeLeft(timeLeft)
  })
}

