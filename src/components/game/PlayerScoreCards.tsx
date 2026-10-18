/**
 * Composant pour afficher les cartes de score des joueurs
 * Gère l'affichage responsive et les animations de transition
 */

import { useState, useEffect, useRef } from 'react'
import { Socket } from 'socket.io-client'
import { GameState, ScoreCategory } from '@/types/game'
import ScoreGrid from './ScoreGrid'

interface PlayerScoreCardsProps {
  gameState: GameState
  socket: Socket
  myTurn: boolean
  onChooseScore: (category: ScoreCategory) => void
  scoresOnly?: boolean
}

/**
 * Composant pour afficher les cartes de score des joueurs
 */
export default function PlayerScoreCards({
  gameState,
  socket,
  myTurn,
  onChooseScore,
  scoresOnly = false,
}: PlayerScoreCardsProps) {
  const [transitionAnimation, setTransitionAnimation] = useState<'slide-down' | 'slide-up' | null>(
    null
  )
  const [delayedIsMyTurn, setDelayedIsMyTurn] = useState(false)
  const [transitionPlayerId, setTransitionPlayerId] = useState<string | null>(null)
  const previousPlayerIndexRef = useRef<number | null>(null)

  // Trier les joueurs : ma propre fiche en premier, puis les autres
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    const aIsMe = a.id === socket.id
    const bIsMe = b.id === socket.id

    if (aIsMe) return -1
    if (bIsMe) return 1
    return 0
  })

  const myPlayer = sortedPlayers[0]
  const otherPlayers = sortedPlayers.slice(1)

  // Gérer les animations de transition de tour
  useEffect(() => {
    const currentIndex = gameState.currentPlayerIndex
    const wasMyTurn =
      previousPlayerIndexRef.current !== null &&
      gameState.players[previousPlayerIndexRef.current]?.id === socket.id
    const isNowMyTurn = gameState.players[currentIndex]?.id === socket.id

    // Détecte le changement de tour
    if (
      previousPlayerIndexRef.current !== null &&
      previousPlayerIndexRef.current !== currentIndex
    ) {
      if (wasMyTurn && !isNowMyTurn) {
        // Mon tour se termine → fiche du joueur suivant apparaît (slide-down)
        setTransitionAnimation('slide-down')
        setDelayedIsMyTurn(false)
        setTransitionPlayerId(gameState.players[currentIndex].id)
        setTimeout(() => {
          setTransitionAnimation(null)
          setTransitionPlayerId(null)
        }, 600)
      } else if (!wasMyTurn && isNowMyTurn) {
        // Le tour d'un adversaire se termine et ça devient mon tour → sa fiche disparaît (slide-up)
        const previousPlayer = gameState.players[previousPlayerIndexRef.current]
        setDelayedIsMyTurn(false)
        setTransitionAnimation('slide-up')
        setTransitionPlayerId(previousPlayer.id)
        // Retarder le passage à "mon tour" pour laisser l'animation se jouer
        setTimeout(() => {
          setDelayedIsMyTurn(true)
          setTransitionAnimation(null)
          setTransitionPlayerId(null)
        }, 600)
      }
    } else {
      // Initialisation ou pas de changement
      setDelayedIsMyTurn(isNowMyTurn)
      setTransitionPlayerId(null)
    }

    previousPlayerIndexRef.current = currentIndex
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayerIndex])

  if (scoresOnly) {
    return <div className={myPlayer.abandoned ? 'opacity-50' : ''}>
      <div className="club-score-owner"><span>{myPlayer.name} · vous</span><strong>{myPlayer.totalScore} points</strong></div>
      <ScoreGrid scoreSheet={myPlayer.scoreSheet} currentDice={gameState.dice.map(d => d.value)} onChooseScore={onChooseScore} isMyTurn={myTurn && myPlayer.id === socket.id} canChoose={gameState.rollsLeft < 3} variant={gameState.variant}/>
    </div>
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Version mobile - empilé verticalement */}
      <div className="lg:hidden space-y-4">
        {/* Ma fiche complète */}
        <div className={myPlayer.abandoned ? 'opacity-50' : ''}>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">
              {myPlayer.name} (Vous)
              {gameState.players[gameState.currentPlayerIndex].id === myPlayer.id && (
                <span className="ml-2 badge badge-info badge-sm">En jeu</span>
              )}
              {myPlayer.abandoned && <span className="ml-2 text-sm text-error">(Abandonné)</span>}
            </h3>
            <span className="badge badge-lg">Score: {myPlayer.totalScore}</span>
          </div>

          <ScoreGrid
            scoreSheet={myPlayer.scoreSheet}
            currentDice={gameState.dice.map((d) => d.value)}
            onChooseScore={onChooseScore}
            isMyTurn={myTurn && myPlayer.id === socket.id}
            canChoose={gameState.rollsLeft < 3}
            variant={gameState.variant}
          />
        </div>

        {/* Adversaires - version compacte */}
        {otherPlayers.length > 0 && (
          <div>
            <h3 className="font-bold text-lg mb-3">Adversaires</h3>
            <div className="space-y-2">
              {otherPlayers.map((player) => {
                const isCurrentPlayer =
                  gameState.players[gameState.currentPlayerIndex].id === player.id

                return (
                  <div
                    key={player.id}
                    className={`
                      player-card-glass
                      ${player.abandoned ? 'opacity-50' : ''}
                      ${isCurrentPlayer ? 'ring-2 ring-info' : ''}
                    `}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold">
                          {player.name}
                          {isCurrentPlayer && (
                            <span className="ml-2 badge badge-info badge-sm">En jeu</span>
                          )}
                          {player.abandoned && (
                            <span className="ml-2 text-sm text-error">(Abandonné)</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{player.totalScore}</div>
                        <div className="text-xs text-base-content/60">points</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Version desktop - grid */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-6">
        {/* Colonne gauche - Ma fiche */}
        <div className={myPlayer.abandoned ? 'opacity-50' : ''}>
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">
              {myPlayer.name} (Vous)
              {gameState.players[gameState.currentPlayerIndex].id === myPlayer.id && (
                <span className="ml-2 badge badge-info badge-sm">En jeu</span>
              )}
              {myPlayer.abandoned && <span className="ml-2 text-sm text-error">(Abandonné)</span>}
            </h3>
            <span className="badge badge-lg">Score: {myPlayer.totalScore}</span>
          </div>

          <ScoreGrid
            scoreSheet={myPlayer.scoreSheet}
            currentDice={gameState.dice.map((d) => d.value)}
            onChooseScore={onChooseScore}
            isMyTurn={myTurn && myPlayer.id === socket.id}
            canChoose={gameState.rollsLeft < 3}
            variant={gameState.variant}
          />
        </div>

        {/* Colonne droite - Adversaires */}
        <div>
          {(() => {
            // Utilise delayedIsMyTurn pour permettre l'animation slide-up de se jouer
            // Forcer le mode adversaire si slide-up en cours
            const shouldShowCompactCards = delayedIsMyTurn && transitionAnimation !== 'slide-up'

            if (shouldShowCompactCards) {
              // C'est mon tour : afficher les cartes compactes de tous les adversaires
              return (
                <div>
                  <h3 className="font-bold text-lg mb-3">Adversaires</h3>
                  <div className="space-y-2">
                    {otherPlayers.map((player) => (
                      <div
                        key={player.id}
                        className={`
                          player-card-compact
                          ${player.abandoned ? 'opacity-50' : ''}
                        `}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-bold">
                              {player.name}
                              {player.abandoned && (
                                <span className="ml-2 text-sm text-error">(Abandonné)</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              {player.totalScore}
                            </div>
                            <div className="text-xs text-base-content/60">points</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            } else {
              // C'est le tour d'un adversaire : afficher seulement sa fiche complète
              // Pendant la transition, utiliser transitionPlayerId pour garder le bon joueur affiché
              const playerIdToShow =
                transitionPlayerId || gameState.players[gameState.currentPlayerIndex].id
              const currentPlayer = otherPlayers.find((p) => p.id === playerIdToShow)

              if (!currentPlayer) return null

              return (
                <div
                  key={`player-${currentPlayer.id}-${transitionAnimation || 'static'}`}
                  className={`
                    ${currentPlayer.abandoned ? 'opacity-50' : ''}
                    ${transitionAnimation === 'slide-down' ? 'animate-slide-down' : ''}
                    ${transitionAnimation === 'slide-up' ? 'animate-slide-up' : ''}
                  `}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold">
                      {currentPlayer.name}
                      {!transitionPlayerId && (
                        <span className="ml-2 badge badge-info badge-sm">En jeu</span>
                      )}
                      {currentPlayer.abandoned && (
                        <span className="ml-2 text-sm text-error">(Abandonné)</span>
                      )}
                    </h3>
                    <span className="badge badge-lg">Score: {currentPlayer.totalScore}</span>
                  </div>

                  <ScoreGrid
                    scoreSheet={currentPlayer.scoreSheet}
                    currentDice={gameState.dice.map((d) => d.value)}
                    onChooseScore={onChooseScore}
                    isMyTurn={false}
                    canChoose={false}
                    variant={gameState.variant}
                  />
                </div>
              )
            }
          })()}
        </div>
      </div>
    </div>
  )
}

