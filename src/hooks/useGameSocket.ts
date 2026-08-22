/**
 * Hook personnalisé pour gérer la connexion Socket.IO d'une partie
 * Gère l'authentification, la reconnexion automatique et les événements
 */

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useRouter } from 'next/navigation'
import { logger } from '@/lib/logger'
import { GameState } from '@/types/game'
import { UserProfile } from '@/types/user'
import { Achievement } from '@/types/achievement'
import { fetchUsername, getServerRestartId, saveServerRestartId } from './socketHelpers'
import { setupBasicListeners, setupMessageListeners, setupErrorListeners, setupGameplayListeners } from './socketEventHandlers'
import { handleServerRestart } from './socketReconnectionHelper'

type Player = { id: string; name: string }

interface UseGameSocketParams {
  uuid: string
  user: { id: string; email?: string } | null
  authLoading: boolean
  userProfile?: UserProfile | null
  shouldConnect?: boolean // Permet de retarder la connexion
  onAchievementsUnlocked?: (achievements: Achievement[]) => void
}

interface UseGameSocketReturn {
  socket: Socket | null
  players: Player[]
  started: boolean
  isHost: boolean
  gameState: GameState | null
  gameEnded: boolean
  systemMessages: string[]
  isConnecting: boolean
  roomJoined: boolean // Indique si le serveur a confirmé l'accès à la room
  onDiceRolled: (() => void) | null // Callback appelé quand les dés sont lancés
  turnTimeLeft: number | null // Temps restant pour le tour actuel en secondes
  preGameCountdown: number | null // Compte à rebours avant le début de la partie (en secondes)
}

/**
 * Hook pour gérer la connexion Socket.IO et l'état du jeu
 */
export function useGameSocket({
  uuid,
  user,
  authLoading,
  userProfile,
  shouldConnect = true, // Par défaut, on se connecte
  onAchievementsUnlocked,
}: UseGameSocketParams): UseGameSocketReturn {
  const router = useRouter()
  const socketRef = useRef<Socket | null>(null)
  const isConnectingRef = useRef(false)

  const [players, setPlayers] = useState<Player[]>([])
  const [started, setStarted] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [gameEnded, setGameEnded] = useState(false)
  const [systemMessages, setSystemMessages] = useState<string[]>([])
  const [roomJoined, setRoomJoined] = useState(false)
  const [diceRolledTrigger, setDiceRolledTrigger] = useState(0)
  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(null)
  const [preGameCountdown, setPreGameCountdown] = useState<number | null>(null)

  useEffect(() => {
    // Attendre que l'authentification soit vérifiée
    if (authLoading) return

    // Ne pas se connecter si shouldConnect est false
    if (!shouldConnect) {
      logger.debug('Socket: connexion bloquée (shouldConnect=false)')
      return
    }

    // Rediriger vers login si pas connecté
    if (!user) {
      router.push('/login')
      return
    }

    if (!uuid) return

    // Évite les connexions multiples
    if (socketRef.current || isConnectingRef.current) {
      return
    }

    logger.debug('Socket: démarrage de la connexion (shouldConnect=true)')

    /**
     * Initialise la connexion Socket.IO (optimisé)
     */
    const initSocket = async () => {
      isConnectingRef.current = true

      const playerName = await fetchUsername(user, userProfile)
      if (!playerName) return

      // Créer la connexion Socket.IO
      const newSocket = io({
        path: '/api/socket',
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 20000,
        forceNew: true,
        withCredentials: true,
        auth: {
          serverRestartId: getServerRestartId(),
        },
      })

      socketRef.current = newSocket

      // Recevoir et stocker l'ID de session serveur
      newSocket.on('server_restart_id', (restartId: string) => {
        saveServerRestartId(restartId)
      })

      // Gérer la détection de redémarrage serveur
      newSocket.on('server_restart_detected', (data: { message: string; newServerRestartId: string }) => {
        logger.warn('Redémarrage serveur détecté:', data.message)
        // Mettre à jour l'ID dans le localStorage
        saveServerRestartId(data.newServerRestartId)
        // La connexion est déjà établie, donc on continue normalement
        // Le client peut continuer à utiliser la connexion existante
      })

      newSocket.on('achievements_unlocked', (achievements: Achievement[]) => {
        onAchievementsUnlocked?.(achievements)
      })

      // Connexion réussie
      newSocket.on('connect', () => {
        isConnectingRef.current = false
        newSocket.emit('join_room', uuid)
      })

      // Gérer les erreurs d'authentification et de redémarrage serveur
      newSocket.on('connect_error', async (error) => {
        logger.error('Erreur de connexion Socket:', error.message)
        isConnectingRef.current = false

        // Tentative de reconnexion après redémarrage serveur
          const handled = await handleServerRestart(error, socketRef, router, initSocket)
        if (handled) return

        if (error.message.includes('Authentication')) {
          alert("Erreur d'authentification. Veuillez vous reconnecter.")
          router.push('/login')
        }
      })

      // Configure tous les listeners
      setupBasicListeners(
        newSocket,
        setPlayers,
        setStarted,
        setIsHost,
        setGameState,
        setRoomJoined,
        setPreGameCountdown
      )
      setupMessageListeners(newSocket, setSystemMessages, setGameEnded, router)
      setupErrorListeners(newSocket, socketRef, isConnectingRef, setRoomJoined, router)
      setupGameplayListeners(newSocket, setDiceRolledTrigger, setTurnTimeLeft)
    }

    initSocket()

    // Nettoyage
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        isConnectingRef.current = false
      }
      setRoomJoined(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid, user, authLoading, shouldConnect])

  return {
    socket: socketRef.current,
    players,
    started,
    isHost,
    gameState,
    gameEnded,
    systemMessages,
    isConnecting: isConnectingRef.current,
    roomJoined,
    onDiceRolled: diceRolledTrigger > 0 ? () => setDiceRolledTrigger(0) : null,
    turnTimeLeft,
    preGameCountdown,
  }
}

