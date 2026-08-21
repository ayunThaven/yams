/**
 * Page de jeu principale
 * Gère l'état global de la partie et coordonne les composants
 */

'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSupabase } from '@/components/Providers'
import { useGameSocket } from '@/hooks/useGameSocket'
import { useGameProtection } from '@/contexts/GameProtectionContext'
import {
  handleStartGame,
  handleLeaveGame,
  handleRollDice,
  handleToggleDieLock,
  handleChooseScore,
} from '@/lib/gameHandlers'
import { ScoreCategory, GameVariant } from '@/types/game'
import WaitingRoom from '@/components/game/WaitingRoom'
import GameBoard from '@/components/game/GameBoard'
import GameOver from '@/components/game/GameOver'

/**
 * Page de jeu
 */
export default function GamePage() {
  const params = useParams()
  const uuid = params?.uuid as string
  const router = useRouter()
  const { user, userProfile, isLoading: authLoading } = useSupabase()
  const { setIsInActiveGame, setSocket, setRoomId } = useGameProtection()
  const userId = user?.id

  // Vérification de l'existence de la partie
  const [gameExists, setGameExists] = useState<boolean | null>(null)
  const isRedirectingRef = useRef(false)

  // État du jeu via le hook personnalisé
  const {
    socket,
    players,
    started,
    isHost,
    gameState,
    gameEnded,
    systemMessages,
    roomJoined,
    onDiceRolled,
    turnTimeLeft,
    preGameCountdown,
  } = useGameSocket(
    {
      uuid,
      user,
      authLoading,
      userProfile, // Passer le profil pour éviter une requête supplémentaire
      shouldConnect: gameExists === true, // Ne se connecter que si la partie existe
      onAchievementsUnlocked: (achievements) => {
        achievements.forEach(showAchievement)
      },
    }
  )

  // Dérivés mémoïsés du state de jeu pour éviter de recalculer partout
  const myPlayer = useMemo(() => {
    if (!gameState?.players || (!userId && !socket?.id)) {
      return null 
    }

    return (
      gameState.players.find(
        (p) => p.userId === userId || p.id === socket?.id
      ) ?? null
    )
  }, [gameState?.players, userId, socket?.id])

  const isAbandoned = myPlayer?.abandoned || false
  const isGameFinished = gameEnded || gameState?.gameStatus === 'finished'
  const isInActiveGame = started && !isGameFinished && !isAbandoned

  // État local pour les animations des dés
  const [isRolling, setIsRolling] = useState(false)
  const [rollCount, setRollCount] = useState(0)
  
  // État pour la variante de la partie
  const [variant, setVariant] = useState<GameVariant>('classic')
  const [variantLoading, setVariantLoading] = useState(true)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [maxPlayers, setMaxPlayers] = useState<number>(4)

  // Référence pour éviter de rejouer le son de début de partie plusieurs fois
  const hasPlayedGameStartSoundRef = useRef(false)

  // Référence pour savoir si on peut quitter sans confirmation
  const canLeaveWithoutWarning = useRef(false)

  // Signaler au contexte global si on est en partie active + passer socket et roomId
  useEffect(() => {
    // Si pas de gameState, pas de protection
    if (!gameState || !gameState.players) {
      setIsInActiveGame(false)
      return
    }

    setIsInActiveGame(isInActiveGame)
    setSocket(socket)
    setRoomId(uuid)
  }, [started, gameEnded, isInActiveGame, isAbandoned, gameState, socket, uuid, userId, setIsInActiveGame, setSocket, setRoomId, myPlayer])

  // Protection contre la navigation accidentelle pendant une partie
  useEffect(() => {
    // Si pas de gameState, pas de protection
    if (!gameState || !gameState.players) {
      return
    }

    // Ne protéger que si la partie est en cours ET que le joueur n'a pas abandonné
    if (!started || isGameFinished || isAbandoned) {
      return
    }

    // 1. Protection contre la fermeture/rafraîchissement de la page
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Le message personnalisé n'est plus supporté par les navigateurs modernes
      // mais on doit quand même définir returnValue pour que ça marche
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [started, gameEnded, isGameFinished, isAbandoned, gameState, myPlayer])

  // SÉCURITÉ : Vérifier l'existence de la partie AVANT tout
  useEffect(() => {
    const checkGameExists = async () => {
      if (!uuid || authLoading || isRedirectingRef.current) return
      
      try {
        const res = await fetch(`/api/games/${uuid}/meta`)
        const json = await res.json()

        if (!res.ok || !json.data) {
          if (!isRedirectingRef.current) {
            isRedirectingRef.current = true
            alert('Cette partie n\'existe pas ou a été supprimée.')
            router.replace('/dashboard')
          }
          return
        }

        // La partie existe, on peut continuer
        setGameExists(true)
        setVariant(json.data.variant || 'classic')
        setOwnerId(json.data.owner || null)
        setMaxPlayers(json.data.max_players || 4)
        setVariantLoading(false)
      } catch (err) {
        console.error('Erreur lors de la vérification de la partie:', err)
        if (!isRedirectingRef.current) {
          isRedirectingRef.current = true
          alert('Erreur lors de la vérification de la partie.')
          router.replace('/dashboard')
        }
      }
    }
    
    checkGameExists()
  }, [uuid, authLoading, router])

  // Gérer l'animation des dés
  useEffect(() => {
    if (gameState && isRolling) {
      // Terminer l'animation après 600ms
      const timer = setTimeout(() => {
        setIsRolling(false)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [gameState, isRolling])

  // Déclencher l'animation quand les dés sont lancés (événement socket)
  useEffect(() => {
    if (onDiceRolled) {
      setIsRolling(true)
      setRollCount(prev => prev + 1)
      onDiceRolled() // Réinitialiser le trigger
    }
  }, [onDiceRolled])

  // Jouer un son au lancement de la partie (après le compte à rebours)
  useEffect(() => {
    if (!started || hasPlayedGameStartSoundRef.current) {
      return
    }

    hasPlayedGameStartSoundRef.current = true
  }, [started])

  /**
   * Gestionnaires d'événements
   */
  const onStart = () => handleStartGame(socket, uuid)

  const onLeave = () => {
    // Autoriser la navigation après avoir cliqué sur "Abandonner"
    canLeaveWithoutWarning.current = true
    handleLeaveGame(socket, uuid, started, () => {
      router.push('/dashboard')
    })
  }

  const onRollDice = () => handleRollDice(socket, uuid, gameState, setIsRolling, setRollCount)

  const onToggleDieLock = (dieIndex: number) => handleToggleDieLock(socket, uuid, gameState, dieIndex)

  const onChooseScore = (category: ScoreCategory) => handleChooseScore(socket, uuid, category)

  /**
   * Affichage conditionnel selon l'état de la partie
   */

  // Vérification de l'existence de la partie en cours
  if (gameExists === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4">Vérification de la partie...</p>
      </div>
    )
  }

  // Attente de confirmation du serveur avant d'afficher la waiting room
  if (!started && !roomJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4">Connexion à la partie...</p>
      </div>
    )
  }

  // Salle d'attente
  if (!started) {
    return (
      <WaitingRoom
        uuid={uuid}
        players={players}
        systemMessages={systemMessages}
        isHost={isHost}
        onStart={onStart}
        onLeave={onLeave}
        variant={variant}
        variantLoading={variantLoading}
        preGameCountdown={preGameCountdown}
        maxPlayers={maxPlayers}
        socket={socket}
        onMaxPlayersChange={setMaxPlayers}
      />
    )
  }

  // Chargement du jeu
  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="mt-4">Chargement du jeu...</p>
      </div>
    )
  }

  // Écran de fin de partie
  if (gameEnded || gameState.gameStatus === 'finished') {
    const amIHost = !!ownerId && !!user?.id && ownerId === user.id
    return (
      <GameOver
        gameState={gameState}
        mySocketId={socket?.id}
        socket={socket}
        amIHost={amIHost}
      />
    )
  }

  // Plateau de jeu
  return (
    <GameBoard
      uuid={uuid}
      gameState={gameState}
      socket={socket!}
      systemMessages={systemMessages}
      isRolling={isRolling}
      rollCount={rollCount}
      turnTimeLeft={turnTimeLeft}
      onRollDice={onRollDice}
      onToggleDieLock={onToggleDieLock}
      onChooseScore={onChooseScore}
      onLeave={onLeave}
    />
  )
}
