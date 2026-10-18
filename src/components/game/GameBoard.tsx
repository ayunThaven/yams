import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Socket } from 'socket.io-client'
import { GameState, ScoreCategory } from '@/types/game'
import Dice from './Dice'
import MobileGameBoard, { SharedScoreSheet } from './MobileGameBoard'
import { getCategoryLabel } from '@/lib/categoryLabels'
import { calculateScore } from '@/lib/yamsLogic'
import { ClockIcon, CloseIcon, JournalIcon } from '@/components/icons/ClubIcons'
import { DiceMonogram } from '@/components/BrandMark'

interface GameBoardProps {
  uuid: string; gameState: GameState; socket: Socket; systemMessages: string[]; isRolling: boolean; rollCount: number; turnTimeLeft: number | null
  onRollDice: () => void; onToggleDieLock: (dieIndex: number) => void; onChooseScore: (category: ScoreCategory) => void; onLeave: () => void
}

export default function GameBoard(props: GameBoardProps) {
  const { uuid, gameState, socket, systemMessages, isRolling, rollCount, turnTimeLeft, onRollDice, onToggleDieLock, onChooseScore, onLeave } = props
  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  const myTurn = currentPlayer.id === socket.id
  const myPlayer = gameState.players.find(player => player.id === socket.id)
  const allDiceLocked = gameState.dice.every(die => die.locked)
  const diceWithIndices = gameState.dice.map((die, originalIndex) => ({ ...die, originalIndex }))
  const diceToRoll = diceWithIndices.filter(die => !die.locked)
  const heldDice = diceWithIndices.filter(die => die.locked)
  const hasRolled = gameState.rollsLeft < 3
  const scorePlayers = myPlayer
    ? [myPlayer, ...gameState.players.filter(player => player.id !== myPlayer.id)]
    : gameState.players
  const previousMyTurn = useRef<boolean | null>(null)
  const activityRef = useRef<HTMLElement>(null)
  const [pendingCategory, setPendingCategory] = useState<ScoreCategory | null>(null)
  const [isActivityOpen, setIsActivityOpen] = useState(false)
  const [lastSeenActivityCount, setLastSeenActivityCount] = useState(() => systemMessages.length)

  useEffect(() => {
    if (previousMyTurn.current === false && myTurn) window.scrollTo({ top: 0, behavior: 'smooth' })
    previousMyTurn.current = myTurn
  }, [myTurn])

  useEffect(() => {
    if (isActivityOpen) setLastSeenActivityCount(systemMessages.length)
  }, [isActivityOpen, systemMessages.length])

  useEffect(() => {
    if (!isActivityOpen) return

    const closeOnOutsideInteraction = (event: PointerEvent) => {
      if (!activityRef.current?.contains(event.target as Node)) setIsActivityOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsActivityOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideInteraction)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideInteraction)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isActivityOpen])

  const time = turnTimeLeft === null ? null : `${Math.floor(turnTimeLeft / 60)}:${String(turnTimeLeft % 60).padStart(2, '0')}`
  const messages = [...systemMessages].reverse()
  const unreadActivityCount = Math.max(0, systemMessages.length - lastSeenActivityCount)
  const pendingScore = pendingCategory && hasRolled ? calculateScore(pendingCategory, gameState.dice.map(die => die.value)) : null

  const confirmScore = () => {
    if (!pendingCategory) return
    onChooseScore(pendingCategory)
    setPendingCategory(null)
  }

  return <>
    <div className="lg:hidden"><MobileGameBoard {...props}/></div>
    <div className="club-game-desktop hidden lg:flex">
      <header className="club-game-bar">
        <div className="club-game-identity"><DiceMonogram/><span><small>Table {uuid}</small><strong>Tour {gameState.turnNumber} <i>/ 13</i></strong></span></div>
        <div className={`club-turn-state ${myTurn ? 'is-mine' : ''}`}><span/>{myTurn ? 'À vous de jouer' : `Au tour de ${currentPlayer.name}`}</div>
        <div className="club-game-bar-actions">{time && <span className={`club-game-timer ${turnTimeLeft! <= 10 ? 'is-urgent' : ''}`}><ClockIcon/>{time}</span>}<button onClick={onLeave}>Quitter la table</button></div>
      </header>

      <section className="club-player-strip" aria-label="Joueurs">{[...gameState.players].sort((a,b) => b.totalScore-a.totalScore).map(player => {
        const active = player.id === currentPlayer.id
        return <div key={player.id} className={`club-player-chip ${active ? 'is-active' : ''} ${player.abandoned ? 'is-away' : ''}`}><span>{player.avatar ? <Image src={player.avatar} alt="" width={34} height={34} unoptimized /> : player.name.charAt(0).toUpperCase()}</span><p><strong>{player.id === socket.id ? 'Vous' : player.name}</strong><small>{active ? 'Lance les dés' : player.abandoned ? 'A quitté' : 'À la table'}</small></p><b>{player.totalScore}</b></div>
      })}</section>

      <main className="club-game-layout">
        <section className="club-game-center">
          <div className="club-felt-table">
            <header><div><p className="club-eyebrow">La table</p><h1>{myTurn ? 'Votre lancer' : `Au tour de ${currentPlayer.name}`}</h1></div><span><b>{gameState.rollsLeft}</b> lancer{gameState.rollsLeft > 1 ? 's' : ''}</span></header>
            <div className="club-desktop-dice-groups">
              <section className="club-dice-active" aria-label="Dés à relancer">
                <header><span>Dés à relancer</span><small>{diceToRoll.length} disponible{diceToRoll.length > 1 ? 's' : ''}</small></header>
                <div className="club-dice-stage">
                  <div className="club-desktop-dice-slots">
                    {diceWithIndices.map((die) => (
                      <div className="club-desktop-die-slot" key={die.originalIndex}>
                        {!die.locked ? <Dice dice={[die]} onToggleLock={myTurn ? onToggleDieLock : undefined} canRoll={myTurn && hasRolled && gameState.rollsLeft > 0} isRolling={isRolling} rollCount={rollCount} hideLockIndicator className="club-desktop-active-die" /> : <span className="club-desktop-die-placeholder" aria-hidden="true" />}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
              <section className="club-dice-held" aria-label="Dés gardés">
                <header><span>Gardés</span><small>{heldDice.length ? 'Cliquez pour remettre un dé en jeu' : 'Choisissez les dés à conserver'}</small></header>
                <div>
                  {heldDice.length > 0 ? <Dice dice={heldDice} onToggleLock={myTurn ? onToggleDieLock : undefined} canRoll={myTurn && hasRolled && gameState.rollsLeft > 0} rollCount={rollCount} hideLockIndicator/> : <span>—</span>}
                </div>
              </section>
            </div>
            <div className="club-roll-zone">{myTurn ? <button onClick={onRollDice} disabled={gameState.rollsLeft === 0 || isRolling || allDiceLocked} className="club-roll-button"><DiceMonogram/>{isRolling ? 'Lancer en cours…' : gameState.rollsLeft === 3 ? 'Lancer les dés' : 'Relancer'}</button> : <p>En attente de {currentPlayer.name}…</p>}<small>{myTurn && hasRolled && gameState.rollsLeft > 0 ? 'Cliquez sur un dé pour le garder ou le remettre en jeu.' : myTurn && gameState.rollsLeft === 0 ? 'Choisissez maintenant une ligne de score.' : ''}</small></div>
          </div>

          <section className="club-table-activity" aria-label="Activité de la table" ref={activityRef}>
            {isActivityOpen ? <div className="club-table-activity-panel">
              <header><div><p className="club-eyebrow">Journal</p><h2>Activité récente</h2></div><button type="button" className="club-icon-button" onClick={() => setIsActivityOpen(false)} aria-label="Fermer l’activité"><CloseIcon /></button></header>
              {messages.length ? <ol>{messages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ol> : <p>Aucune action récente.</p>}
            </div> : <button type="button" className="club-table-activity-trigger" onClick={() => setIsActivityOpen(true)} aria-label={`Ouvrir l’activité de la table${unreadActivityCount ? `, ${unreadActivityCount} nouvel${unreadActivityCount > 1 ? 's' : ''} événement${unreadActivityCount > 1 ? 's' : ''}` : ''}`}><JournalIcon />{unreadActivityCount > 0 && <span>{unreadActivityCount}</span>}</button>}
          </section>
        </section>

        <aside className="club-score-rail"><header><p className="club-eyebrow">Scores</p><h2>Feuille partagée</h2><small>{gameState.variant !== 'classic' ? 'Ordre imposé' : 'Consultez les scores de chaque joueur'}</small></header><SharedScoreSheet players={scorePlayers} currentPlayerId={currentPlayer.id} localPlayerId={socket.id ?? ''} currentDice={gameState.dice.map(die => die.value)} variant={gameState.variant} hasRolled={hasRolled} myTurn={myTurn} onRequestScore={setPendingCategory} showHeader={false} className="club-desktop-score-sheet"/></aside>
      </main>
      {pendingCategory && pendingScore !== null && <section className="club-score-confirmation club-score-confirmation-bottom" aria-live="polite"><div><p className="club-eyebrow">Score à inscrire</p><h3><strong>{pendingScore}</strong> en {getCategoryLabel(pendingCategory)}</h3></div><footer><button type="button" className="club-button club-button-quiet" onClick={() => setPendingCategory(null)}>Annuler</button><button type="button" className="club-button club-button-primary" onClick={confirmScore}>Valider</button></footer></section>}
    </div>
  </>
}
