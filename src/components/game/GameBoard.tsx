/**
 * Composant principal du plateau de jeu
 * Affiche l'interface de jeu avec les dés, les scores et les joueurs
 */

import { useEffect, useRef, ReactNode } from 'react'
import { Socket } from 'socket.io-client'
import { GameState, ScoreCategory } from '@/types/game'
import Dice from './Dice'
import PlayerScoreCards from './PlayerScoreCards'
import ActiveCategoryCard from './ActiveCategoryCard'
import MobileGameBoard from './MobileGameBoard'
import { getNextCategory } from '@/lib/variantLogic'
import { getCategoryLabel } from '@/lib/categoryLabels'
import { calculateScore } from '@/lib/yamsLogic'

interface GameBoardProps {
  uuid: string
  gameState: GameState
  socket: Socket
  systemMessages: string[]
  isRolling: boolean
  rollCount: number
  turnTimeLeft: number | null
  onRollDice: () => void
  onToggleDieLock: (dieIndex: number) => void
  onChooseScore: (category: ScoreCategory) => void
  onLeave: () => void
}

/**
 * Composant du plateau de jeu
 */
export default function GameBoard({
  uuid,
  gameState,
  socket,
  systemMessages,
  isRolling,
  rollCount,
  turnTimeLeft,
  onRollDice,
  onToggleDieLock,
  onChooseScore,
  onLeave,
}: GameBoardProps) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  const myTurn = currentPlayer.id === socket.id
  
  // Déterminer la prochaine catégorie si variante non-classique
  const myPlayer = gameState.players.find(p => p.id === socket.id)
  const nextCategory = gameState.variant !== 'classic' && myPlayer
    ? getNextCategory(gameState.variant, myPlayer.scoreSheet)
    : null

  // Vérifier si tous les dés sont verrouillés
  const allDiceLocked = gameState.dice.every(die => die.locked)
  
  // Formater le temps restant en MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  // Déterminer la couleur du timer en fonction du temps restant
  const getTimerColor = (seconds: number): string => {
    if (seconds > 30) return 'badge-success'
    if (seconds > 10) return 'badge-warning'
    return 'badge-error'
  }
  
  // Références pour détecter les changements de tour
  const previousMyTurnRef = useRef<boolean | null>(null)
  const isFirstRenderRef = useRef(true)
  const messagesRef = useRef<HTMLDivElement>(null)

  // Scroll automatique vers le haut quand un nouveau message arrive
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = 0
    }
  }, [systemMessages])

  // Scroll automatique quand c'est mon tour
  useEffect(() => {
    // Ignorer le premier rendu
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      previousMyTurnRef.current = myTurn
      return
    }

    // Détecter le passage de "pas mon tour" à "mon tour"
    const turnJustStarted = previousMyTurnRef.current === false && myTurn === true

    if (turnJustStarted) {
      // Scroll fluide vers le haut
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }

    // Mettre à jour la référence
    previousMyTurnRef.current = myTurn
  }, [myTurn])

  return (
    <>
      <div className="lg:hidden">
        <MobileGameBoard
          gameState={gameState}
          socket={socket}
          systemMessages={systemMessages}
          isRolling={isRolling}
          rollCount={rollCount}
          turnTimeLeft={turnTimeLeft}
          onRollDice={onRollDice}
          onToggleDieLock={onToggleDieLock}
          onChooseScore={onChooseScore}
          onLeave={onLeave}
        />
      </div>

      <div className="hidden min-h-screen flex-col lg:flex">
      {/* Barre supérieure sticky */}
      <div className="sticky top-0 z-10 bg-base-100 shadow-md border-b border-base-300">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Infos partie */}
            <div className="flex-1">
              <h1 className="text-lg md:text-xl font-bold">
                🎲 Yams - Tour {gameState.turnNumber}/13
              </h1>
              <p className="text-xs text-base-content/70 selectable-text">Partie #{uuid}</p>
            </div>

            {/* Info joueur actif */}
            <div className={`badge ${myTurn ? 'badge-info' : 'badge-warning'} badge-lg gap-2 hidden md:flex`}>
              {myTurn ? (
                <>
                  <span>🎯</span>
                  <span>Votre tour</span>
                </>
              ) : (
                <>
                  <span>⏳</span>
                  <span>Au tour de {currentPlayer.name}</span>
                </>
              )}
            </div>

            {/* Timer du tour */}
            {turnTimeLeft !== null && (
              <div className={`badge ${getTimerColor(turnTimeLeft)} badge-lg gap-2 font-mono font-bold`}>
                <span>⏱️</span>
                <span>{formatTime(turnTimeLeft)}</span>
              </div>
            )}

            {/* Bouton abandonner */}
            <button 
              onClick={onLeave} 
              className="btn btn-outline btn-error btn-sm gap-2"
            >
              <span>🏳️</span>
              <span className="hidden md:inline">Abandonner</span>
            </button>
          </div>

          {/* Info joueur actif mobile */}
          <div className="md:hidden mt-2">
            <div className={`badge ${myTurn ? 'badge-info' : 'badge-warning'} gap-2`}>
              {myTurn ? (
                <>
                  <span>🎯</span>
                  <span>C&apos;est votre tour !</span>
                </>
              ) : (
                <>
                  <span>⏳</span>
                  <span>Au tour de {currentPlayer.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Panneau des scores de tous les joueurs (toujours visible) */}
      <div className="sticky top-[73px] z-10 bg-base-200/95 backdrop-blur-sm border-b border-base-300 shadow-sm">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {[...gameState.players]
              .sort((a, b) => b.totalScore - a.totalScore)
              .map((player) => {
                const isCurrentPlayer = gameState.players[gameState.currentPlayerIndex].id === player.id
                const isMe = player.id === socket.id
                
                return (
                  <div
                    key={player.id}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg
                      ${isCurrentPlayer ? 'bg-primary/20 ring-2 ring-primary' : 'bg-base-100'}
                      ${player.abandoned ? 'opacity-50' : ''}
                      ${isMe ? 'font-bold' : ''}
                    `}
                  >
                    <span className="text-sm">
                      {isMe ? '👤' : isCurrentPlayer ? '🎯' : '👥'}
                    </span>
                    <span className="text-sm font-semibold">{player.name}</span>
                    {isMe && <span className="text-xs text-primary">(Vous)</span>}
                    <span className="text-sm font-bold text-primary">{player.totalScore}</span>
                    {player.abandoned && (
                      <span className="text-xs text-error">(Abandonné)</span>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 container mx-auto p-4 space-y-6">
        {/* Dés du joueur actif (visible par tous) */}
        <div className={`card shadow-xl max-w-3xl mx-auto ${
          myTurn 
            ? 'bg-gradient-to-br from-primary/10 to-secondary/10' 
            : 'bg-base-200/50'
        }`}>
          <div className="card-body items-center">
            {/* En-tête de la carte */}
            <div className="flex items-center justify-between w-full mb-4">
              <h3 className="card-title">
                {myTurn ? '🎲 Vos dés' : `🎲 Dés de ${currentPlayer.name}`}
              </h3>
              <div className="badge badge-lg badge-primary gap-2">
                <span className="font-bold">{gameState.rollsLeft}</span>
                <span className="text-xs">
                  lancer{gameState.rollsLeft > 1 ? 's' : ''} restant{gameState.rollsLeft > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Dés */}
            <Dice
              dice={gameState.dice}
              onToggleLock={myTurn ? onToggleDieLock : undefined}
              canRoll={myTurn && gameState.rollsLeft < 3 && gameState.rollsLeft > 0}
              isRolling={isRolling}
              rollCount={rollCount}
            />

            {/* Bouton lancer (visible seulement si c'est mon tour) */}
            {myTurn && (
              <button
                onClick={onRollDice}
                disabled={gameState.rollsLeft === 0 || isRolling || allDiceLocked || !myTurn}
                className="btn btn-primary btn-lg mt-4 gap-2"
              >
                {isRolling ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    <span>Lancer en cours...</span>
                  </>
                ) : gameState.rollsLeft === 3 ? (
                  <>
                    <span>🎲</span>
                    <span>Lancer les dés</span>
                  </>
                ) : (
                  <>
                    <span>🎲</span>
                    <span>Relancer</span>
                  </>
                )}
              </button>
            )}

            {/* Indications */}
            <div className="text-center mt-3">
              {myTurn ? (
                gameState.rollsLeft === 3 ? (
                  <p className="text-sm text-base-content/70">
                    💡 Lancez les dés pour commencer votre tour
                  </p>
                ) : gameState.rollsLeft > 0 ? (
                  <p className="text-sm text-base-content/70">
                    💡 Cliquez sur les dés pour les verrouiller/déverrouiller
                  </p>
                ) : gameState.variant === 'classic' ? (
                  <p className="text-sm text-base-content/70">
                    💡 Choisissez une combinaison dans votre fiche de score
                  </p>
                ) : (
                  <p className="text-sm text-base-content/70">
                    💡 Validez votre score ci-dessous
                  </p>
                )
              ) : (
                <p className="text-sm text-base-content/60 italic">
                  ⏳ En attente de {currentPlayer.name}...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Carte de catégorie active (variantes montante/descendante uniquement) */}
        {myTurn && gameState.variant !== 'classic' && nextCategory && (
          <ActiveCategoryCard
            category={nextCategory}
            categoryLabel={getCategoryLabel(nextCategory)}
            categoryDescription=""
            potentialScore={calculateScore(nextCategory, gameState.dice.map(d => d.value))}
            onValidate={() => onChooseScore(nextCategory)}
            canValidate={gameState.rollsLeft < 3}
          />
        )}

        {/* Messages système en haut des fiches */}
        {systemMessages.length > 0 && (() => {
          // Calculer le nombre maximum de messages : 3 × nombre de joueurs
          const maxMessages = gameState.players.length * 3
          const messagesToShow = systemMessages.slice(-maxMessages).reverse()
          
          return (
            <div className="card bg-info/10 border border-info/30 shadow-lg max-w-3xl mx-auto">
              <div className="card-body py-3">
                <div className="flex items-start gap-2">
                  <span className="text-lg">📢</span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold mb-2">Activité récente</p>
                    <div ref={messagesRef} className="space-y-1 max-h-20 overflow-y-auto scroll-smooth">
                      {messagesToShow.map((msg, idx) => {
                        // Détecter les messages de connexion/déconnexion/abandon pour les griser
                        const isConnectionMessage = 
                          msg.includes('rejoint') || 
                          msg.includes('quitté') || 
                          msg.includes('déconnecté') || 
                          msg.includes('reconnecté') ||
                          msg.includes('abandonné')
                        
                        // Détecter les messages contenant des scores (ex: "a marqué X point(s)")
                        const hasScore = msg.includes('marqué') && /\d+/.test(msg)
                        
                        // Calculer l'opacité progressivement (plus récent = plus opaque)
                        // Le message le plus récent (idx 0) a une opacité de 100%
                        // L'opacité diminue progressivement jusqu'à 30% pour le plus ancien
                        const opacityPercent = Math.max(30, 100 - (idx * 70 / Math.max(1, messagesToShow.length - 1)))
                        const opacityStyle = { opacity: opacityPercent / 100 }
                        
                        // Fonction pour mettre en évidence les scores dans le message
                        const formatMessageWithScores = (text: string): ReactNode => {
                          if (!hasScore) return text
                          
                          // Pattern pour détecter "X point(s)" - capture le nombre et le mot complet "point" ou "points"
                          const scorePattern = /(\d+)\s*(points?)/gi
                          const parts: (string | ReactNode)[] = []
                          let lastIndex = 0
                          let match
                          let keyCounter = 0
                          
                          while ((match = scorePattern.exec(text)) !== null) {
                            // Ajouter le texte avant le score
                            if (match.index > lastIndex) {
                              parts.push(text.substring(lastIndex, match.index))
                            }
                            // Ajouter le score en couleur (nombre + mot complet avec le "s" si présent)
                            parts.push(
                              <span key={`score-${keyCounter++}`} className="font-bold text-primary">
                                {match[1]} {match[2]}
                              </span>
                            )
                            lastIndex = match.index + match[0].length
                          }
                          
                          // Ajouter le reste du texte
                          if (lastIndex < text.length) {
                            parts.push(text.substring(lastIndex))
                          }
                          
                          return parts.length > 0 ? <>{parts}</> : text
                        }
                        
                        return (
                          <p 
                            key={idx} 
                            style={opacityStyle}
                            className={`text-xs py-1 border-b border-base-content/10 first:border-t-0 transition-opacity duration-300 ${
                              isConnectionMessage 
                                ? 'text-base-content/40 italic' 
                                : 'text-base-content/80'
                            }`}
                          >
                            • {formatMessageWithScores(msg)}
                          </p>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Grilles de score */}
        <PlayerScoreCards
          gameState={gameState}
          socket={socket}
          myTurn={myTurn}
          onChooseScore={onChooseScore}
        />
      </div>
      </div>
    </>
  )
}
