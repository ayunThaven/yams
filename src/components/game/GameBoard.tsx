import { useEffect, useRef, useState } from 'react'
import { Socket } from 'socket.io-client'
import { GameState, ScoreCategory } from '@/types/game'
import Dice from './Dice'
import ActiveCategoryCard from './ActiveCategoryCard'
import MobileGameBoard, { SharedScoreSheet } from './MobileGameBoard'
import { getNextCategory } from '@/lib/variantLogic'
import { getCategoryLabel } from '@/lib/categoryLabels'
import { calculateScore } from '@/lib/yamsLogic'
import { ClockIcon, DotsIcon } from '@/components/icons/ClubIcons'
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
  const nextCategory = gameState.variant !== 'classic' && myPlayer ? getNextCategory(gameState.variant, myPlayer.scoreSheet) : null
  const allDiceLocked = gameState.dice.every(die => die.locked)
  const diceWithIndices = gameState.dice.map((die, originalIndex) => ({ ...die, originalIndex }))
  const diceToRoll = diceWithIndices.filter(die => !die.locked)
  const heldDice = diceWithIndices.filter(die => die.locked)
  const hasRolled = gameState.rollsLeft < 3
  const scorePlayers = [currentPlayer, ...gameState.players.filter(player => player.id !== currentPlayer.id)]
  const previousMyTurn = useRef<boolean | null>(null)
  const [pendingCategory, setPendingCategory] = useState<ScoreCategory | null>(null)

  useEffect(() => {
    if (previousMyTurn.current === false && myTurn) window.scrollTo({ top: 0, behavior: 'smooth' })
    previousMyTurn.current = myTurn
  }, [myTurn])

  const time = turnTimeLeft === null ? null : `${Math.floor(turnTimeLeft / 60)}:${String(turnTimeLeft % 60).padStart(2, '0')}`
  const messages = systemMessages.slice(-(gameState.players.length * 3)).reverse()
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
        return <div key={player.id} className={`club-player-chip ${active ? 'is-active' : ''} ${player.abandoned ? 'is-away' : ''}`}><span>{player.name.charAt(0).toUpperCase()}</span><p><strong>{player.id === socket.id ? 'Vous' : player.name}</strong><small>{active ? 'Lance les dés' : player.abandoned ? 'A quitté' : 'À la table'}</small></p><b>{player.totalScore}</b></div>
      })}</section>

      <main className="club-game-layout">
        <section className="club-game-center">
          <div className="club-felt-table">
            <header><div><p className="club-eyebrow">{myTurn ? 'Votre lancer' : `Lancer de ${currentPlayer.name}`}</p><h1>{myTurn ? 'Faites parler les dés.' : 'La table attend.'}</h1></div><span><b>{gameState.rollsLeft}</b> lancer{gameState.rollsLeft > 1 ? 's' : ''}</span></header>
            <div className="club-desktop-dice-groups">
              <section className="club-dice-active" aria-label="Dés à relancer">
                <header><span>Dés à relancer</span><small>{diceToRoll.length} disponible{diceToRoll.length > 1 ? 's' : ''}</small></header>
                <div className="club-dice-stage">
                  {diceToRoll.length > 0 ? <Dice dice={diceToRoll} onToggleLock={myTurn ? onToggleDieLock : undefined} canRoll={myTurn && hasRolled && gameState.rollsLeft > 0} isRolling={isRolling} rollCount={rollCount} hideLockIndicator/> : <p>Tous les dés sont gardés.</p>}
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

          {myTurn && gameState.variant !== 'classic' && nextCategory && (
            <ActiveCategoryCard category={nextCategory} categoryLabel={getCategoryLabel(nextCategory)} categoryDescription="" potentialScore={calculateScore(nextCategory, gameState.dice.map(die => die.value))} onValidate={() => onChooseScore(nextCategory)} canValidate={gameState.rollsLeft < 3}/>
          )}

          <details className="club-activity" open={messages.length > 0}><summary><span><DotsIcon/>Activité de la table</span><small>{messages.length} événement{messages.length > 1 ? 's' : ''}</small></summary><div>{messages.length ? messages.map((message,index) => <p key={`${message}-${index}`}>{message}</p>) : <p>La table est calme pour le moment.</p>}</div></details>
        </section>

        <aside className="club-score-rail"><header><p className="club-eyebrow">Feuille partagée</p><h2>Scores de la table</h2><small>{gameState.variant !== 'classic' ? 'Ordre imposé' : 'Toutes les feuilles sont consultables'}</small></header><SharedScoreSheet players={scorePlayers} currentPlayerId={currentPlayer.id} localPlayerId={socket.id ?? ''} currentDice={gameState.dice.map(die => die.value)} variant={gameState.variant} hasRolled={hasRolled} myTurn={myTurn} onRequestScore={setPendingCategory} showHeader={false} className="club-desktop-score-sheet"/></aside>
      </main>
      {pendingCategory && pendingScore !== null && <div className="club-score-confirm-layer" role="dialog" aria-modal="true" aria-labelledby="desktop-score-confirmation-title"><button className="club-score-confirm-backdrop" aria-label="Annuler l’inscription du score" onClick={() => setPendingCategory(null)}/><section className="club-score-confirmation"><p className="club-eyebrow">Confirmer le score</p><h2 id="desktop-score-confirmation-title">Inscrire <strong>{pendingScore}</strong> en {getCategoryLabel(pendingCategory)} ?</h2><p>Cette ligne sera définitivement ajoutée à votre feuille.</p><footer><button type="button" className="club-button club-button-quiet" onClick={() => setPendingCategory(null)}>Annuler</button><button type="button" className="club-button club-button-primary" onClick={confirmScore}>Valider {pendingScore} points</button></footer></section></div>}
    </div>
  </>
}
