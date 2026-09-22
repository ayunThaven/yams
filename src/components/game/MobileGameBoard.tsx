'use client'

import { useEffect, useMemo, useState } from 'react'
import { Socket } from 'socket.io-client'
import { GameState, PlayerGameState, ScoreCategory } from '@/types/game'
import { calculateScore } from '@/lib/yamsLogic'
import { canChooseCategory, getNextCategory } from '@/lib/variantLogic'
import Dice from './Dice'
import { ChevronDownIcon } from '@/components/icons/ClubIcons'

interface MobileGameBoardProps {
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

const UPPER_CATEGORIES: Array<{ key: ScoreCategory; label: string }> = [
  { key: 'ones', label: 'As' },
  { key: 'twos', label: 'Deux' },
  { key: 'threes', label: 'Trois' },
  { key: 'fours', label: 'Quatre' },
  { key: 'fives', label: 'Cinq' },
  { key: 'sixes', label: 'Six' },
]

const LOWER_CATEGORIES: Array<{ key: ScoreCategory; label: string }> = [
  { key: 'threeOfKind', label: 'Brelan' },
  { key: 'fourOfKind', label: 'Carré' },
  { key: 'fullHouse', label: 'Full' },
  { key: 'smallStraight', label: 'P. suite' },
  { key: 'largeStraight', label: 'G. suite' },
  { key: 'yams', label: 'Yams' },
  { key: 'chance', label: 'Chance' },
]

const ALL_CATEGORIES = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES]

const UPPER_CATEGORY_TARGETS: Partial<Record<ScoreCategory, number>> = {
  ones: 3,
  twos: 6,
  threes: 9,
  fours: 12,
  fives: 15,
  sixes: 18,
}

const UPPER_CATEGORY_MAXIMUMS: Partial<Record<ScoreCategory, number>> = {
  ones: 5,
  twos: 10,
  threes: 15,
  fours: 20,
  fives: 25,
  sixes: 30,
}

export default function MobileGameBoard({
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
}: MobileGameBoardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [pendingCategory, setPendingCategory] = useState<ScoreCategory | null>(null)
  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  const localPlayerId = socket.id ?? ''
  const myTurn = currentPlayer.id === localPlayerId
  const diceWithIndices = gameState.dice.map((die, originalIndex) => ({ ...die, originalIndex }))
  const diceToRoll = diceWithIndices.filter((die) => !die.locked)
  const heldDice = diceWithIndices.filter((die) => die.locked)
  const allDiceLocked = diceToRoll.length === 0
  const hasRolled = gameState.rollsLeft < 3
  const pendingScore = pendingCategory && hasRolled
    ? calculateScore(pendingCategory, gameState.dice.map((die) => die.value))
    : null

  const orderedPlayers = useMemo(() => {
    const localPlayer = gameState.players.find((player) => player.id === localPlayerId)
    return localPlayer
      ? [localPlayer, ...gameState.players.filter((player) => player.id !== localPlayerId)]
      : gameState.players
  }, [gameState.players, localPlayerId])

  const confirmScore = () => {
    if (!pendingCategory) return
    onChooseScore(pendingCategory)
    setPendingCategory(null)
  }

  return (
    <main className="min-h-[100dvh] bg-base-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold tabular-nums">
            <span>Tour {gameState.turnNumber} / 13</span>
            {turnTimeLeft !== null && <TurnTimer seconds={turnTimeLeft} />}
            <button
              type="button"
              aria-label="Ouvrir le menu de la partie"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none active:bg-base-200"
            >
              ⋮
            </button>
          </div>
          <div className={`mt-1 flex items-center gap-2 text-sm font-medium ${myTurn ? 'text-primary' : 'text-base-content/75'}`}>
            <span className={`h-2 w-2 rounded-full ${myTurn ? 'bg-primary' : 'bg-warning'}`} />
            {myTurn ? 'Votre tour' : `${currentPlayer.name} joue`}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-lg px-4 pt-5" aria-label="Dés du tour">
        <div className={`min-h-52 rounded-3xl border px-4 py-5 ${myTurn ? 'border-primary/25 bg-primary/5' : 'border-base-300 bg-base-200/45'}`}>
          <p className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-base-content/50">
            {myTurn ? 'À relancer' : `Dés de ${currentPlayer.name}`}
          </p>
          <div className="mx-auto grid max-w-[18rem] grid-cols-6 gap-3 justify-items-center">
            {diceWithIndices.map((die, index) => (
              <div
                key={die.originalIndex}
                className={`flex h-[4.6rem] w-[4.6rem] items-center justify-center ${
                  index < 3 ? 'col-span-2' : index === 3 ? 'col-span-2 col-start-2' : 'col-span-2 col-start-4'
                }`}
              >
                {!die.locked && (
                  <Dice
                    dice={[die]}
                    onToggleLock={myTurn && hasRolled ? onToggleDieLock : undefined}
                    canRoll={myTurn && hasRolled && gameState.rollsLeft > 0}
                    isRolling={isRolling}
                    rollCount={rollCount}
                    hideLockIndicator
                    className="club-mobile-active-dice h-full w-full"
                    dieClassName="h-[4.6rem] w-[4.6rem] rounded-2xl border-2 text-3xl shadow-md active:scale-95"
                  />
                )}
                {die.locked && (
                  <div
                    aria-hidden="true"
                    className="h-11 w-11 rounded-xl border-2 border-dashed border-base-300"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {myTurn && (
          <div className="px-2 pt-4 text-center">
            <p className="mb-3 text-sm font-medium text-base-content/65">
              {gameState.rollsLeft === 0
                ? 'Choisissez une case dans la feuille de score'
                : `${gameState.rollsLeft} lancer${gameState.rollsLeft > 1 ? 's' : ''} restant${gameState.rollsLeft > 1 ? 's' : ''}`}
            </p>
            {gameState.rollsLeft > 0 && (
              <button
                type="button"
                onClick={onRollDice}
                disabled={isRolling || allDiceLocked}
                className="btn btn-primary h-14 min-h-14 w-full rounded-2xl text-base tracking-wide disabled:opacity-45"
              >
                {isRolling ? <span className="loading loading-spinner loading-sm" /> : gameState.rollsLeft === 3 ? 'LANCER LES DÉS' : 'RELANCER'}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="mx-auto mt-5 max-w-lg border-y border-base-300 bg-base-200/40 px-4 py-3" aria-label="Dés gardés">
        <div className="flex min-h-16 items-center gap-3">
          <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-base-content/55">Gardés</span>
          {heldDice.length > 0 ? (
            <Dice
              dice={heldDice}
              onToggleLock={myTurn && hasRolled ? onToggleDieLock : undefined}
              canRoll={myTurn && hasRolled && gameState.rollsLeft > 0}
              hideLockIndicator
              className="club-mobile-held-dice flex-1 justify-end gap-2"
              dieClassName="h-14 w-14 animate-die-kept rounded-xl border-2 text-2xl shadow-sm active:scale-95"
            />
          ) : (
            <span className="text-sm text-base-content/45">Touchez un dé pour le garder</span>
          )}
        </div>
      </section>

      <SharedScoreSheet
        players={orderedPlayers}
        currentPlayerId={currentPlayer.id}
        localPlayerId={localPlayerId}
        currentDice={gameState.dice.map((die) => die.value)}
        variant={gameState.variant}
        hasRolled={hasRolled}
        myTurn={myTurn}
        onRequestScore={setPendingCategory}
      />

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-neutral/65 p-2 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="game-menu-title">
          <button className="absolute inset-0 cursor-default" aria-label="Fermer le menu" onClick={() => setIsMenuOpen(false)} />
          <div className="relative flex max-h-[82dvh] w-full flex-col overflow-hidden rounded-3xl border-2 border-base-300 bg-base-100 shadow-2xl animate-slide-in-bottom">
            <div className="flex items-center justify-between border-b border-base-300 px-5 pb-3 pt-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Partie en cours</p>
                <h2 id="game-menu-title" className="mt-0.5 text-lg font-bold">Menu de la partie</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Fermer le menu"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-base-300 text-xl active:bg-base-200"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div>
                  <h3 className="font-bold">Activité récente</h3>
                  <p className="mt-0.5 text-xs text-base-content/55">Les dernières actions de la partie</p>
                </div>
                {systemMessages.length > 0 && <span className="badge badge-ghost badge-sm">{Math.min(systemMessages.length, 10)}</span>}
              </div>

              {systemMessages.length > 0 ? (
                <ol className="space-y-2">
                  {systemMessages.slice(-10).reverse().map((message, index) => (
                    <li key={`${message}-${index}`} className="flex gap-3 rounded-xl border border-base-300 bg-base-200/65 px-3 py-3 text-sm leading-snug">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      <span className="text-base-content/85">{message}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="rounded-xl border border-dashed border-base-300 px-4 py-6 text-center text-sm text-base-content/55">
                  Les actions de la partie apparaîtront ici.
                </div>
              )}
            </div>

            <div className="border-t border-base-300 bg-base-200/45 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <button type="button" onClick={onLeave} className="btn btn-outline btn-error h-12 min-h-12 w-full rounded-xl">
                Abandonner la partie
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingCategory && pendingScore !== null && (
        <div className="fixed inset-0 z-[60] flex items-end bg-neutral/35" role="dialog" aria-modal="true" aria-labelledby="score-confirmation-title">
          <button className="absolute inset-0 cursor-default" aria-label="Annuler" onClick={() => setPendingCategory(null)} />
          <div className="relative w-full rounded-t-3xl bg-base-100 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl">
            <h2 id="score-confirmation-title" className="text-lg font-bold">Inscrire {pendingScore} en {categoryLabel(pendingCategory)} ?</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setPendingCategory(null)} className="btn h-12 min-h-12 rounded-xl">Annuler</button>
              <button type="button" onClick={confirmScore} className="btn btn-primary h-12 min-h-12 rounded-xl">Valider</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function TurnTimer({ seconds }: { seconds: number }) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  const color = seconds > 30 ? 'text-success' : seconds > 10 ? 'text-warning' : 'text-error'
  return <span className={`font-mono font-bold ${color}`}>{minutes}:{remainingSeconds.toString().padStart(2, '0')}</span>
}

interface SharedScoreSheetProps {
  players: PlayerGameState[]
  currentPlayerId: string
  localPlayerId: string
  currentDice: number[]
  variant: GameState['variant']
  hasRolled: boolean
  myTurn: boolean
  onRequestScore: (category: ScoreCategory) => void
}

export function SharedScoreSheet({
  players,
  currentPlayerId,
  localPlayerId,
  currentDice,
  variant,
  hasRolled,
  myTurn,
  onRequestScore,
  showHeader = true,
  className = '',
}: SharedScoreSheetProps & { showHeader?: boolean; className?: string }) {
  const compactScoreSheet = useCompactScoreSheet()
  const focusedScoreSheet = compactScoreSheet || players.length >= 4
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null)
  const localPlayer = players.find((player) => player.id === localPlayerId)
  const opponents = players.filter((player) => player.id !== localPlayerId)

  useEffect(() => {
    if (selectedOpponentId && opponents.some((player) => player.id === selectedOpponentId)) return
    setSelectedOpponentId(opponents.find((player) => player.id === currentPlayerId)?.id ?? opponents[0]?.id ?? null)
  }, [currentPlayerId, opponents, selectedOpponentId])

  const selectedOpponent = opponents.find((player) => player.id === selectedOpponentId) ?? opponents[0]
  const visiblePlayers = focusedScoreSheet && players.length > 2
    ? [localPlayer, selectedOpponent].filter((player): player is PlayerGameState => Boolean(player))
    : players

  const renderCategory = (category: ScoreCategory, label: string) => (
    <tr key={category} className="border-b border-base-300/75">
      <th scope="row" className="sticky left-0 z-10 min-w-24 bg-base-100 px-3 py-2 text-left text-sm font-medium">{label}</th>
      {visiblePlayers.map((player) => {
        const isLocalPlayer = player.id === localPlayerId
        const isActivePlayer = player.id === currentPlayerId
        const isAvailable = player.scoreSheet[category] === null
        const canChoose = isLocalPlayer && myTurn && hasRolled && isAvailable && canChooseCategory(variant, category, player.scoreSheet)
        const potential = hasRolled && isActivePlayer && isAvailable && canChooseCategory(variant, category, player.scoreSheet)
          ? calculateScore(category, currentDice)
          : null
        const isForcedCategory = isLocalPlayer && variant !== 'classic' && getNextCategory(variant, player.scoreSheet) === category
        const isEmptyScore = player.scoreSheet[category] === null && potential === null
        return (
          <td key={player.id} className={`min-w-[4.7rem] border-l border-base-300/60 p-0 text-center ${player.id === currentPlayerId ? 'bg-primary/10' : ''}`}>
            {canChoose ? (
              <button type="button" onClick={() => onRequestScore(category)} className="h-full min-h-10 w-full px-2 py-2 font-bold text-primary active:bg-primary/15">
                +{potential}
              </button>
            ) : (
              <span className={`block px-2 py-2 ${isEmptyScore ? 'club-score-empty' : ''} ${isForcedCategory && isAvailable ? 'font-bold text-primary underline decoration-primary/40 underline-offset-4' : ''}`}>
                {player.scoreSheet[category] ?? (potential !== null ? `+${potential}` : '–')}
              </span>
            )}
          </td>
        )
      })}
    </tr>
  )

  return (
    <section className={`shared-score-sheet mx-auto max-w-lg px-4 pb-4 pt-6 ${className}`} aria-label="Feuille de score partagée">
      {showHeader && <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-bold">Feuille de score</h2>
        {variant !== 'classic' && <span className="text-xs text-base-content/55">Ordre imposé</span>}
      </div>}
      {focusedScoreSheet && opponents.length > 1 && selectedOpponent && <details className="club-score-player-picker">
        <summary><span>Feuille consultée</span><strong>{selectedOpponent.name}</strong><ChevronDownIcon/></summary>
        <div role="listbox" aria-label="Joueur affiché">
          {opponents.map((player) => <button key={player.id} type="button" role="option" aria-selected={player.id === selectedOpponent.id} className={player.id === selectedOpponent.id ? 'is-selected' : ''} onClick={(event) => { setSelectedOpponentId(player.id); event.currentTarget.closest('details')?.removeAttribute('open') }}>
            <span>{player.name}</span>{player.id === currentPlayerId && <small>À jouer</small>}
          </button>)}
        </div>
      </details>}
      <div className={`${focusedScoreSheet ? 'overflow-hidden' : 'overflow-x-auto'} rounded-2xl border border-base-300 bg-base-100 shadow-sm`}>
        <table className="w-max min-w-full border-collapse text-sm tabular-nums">
          <thead className="border-b border-base-300 bg-base-200/80">
            <tr>
              <th className="sticky left-0 z-20 min-w-24 bg-base-200 px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-base-content/55">Score</th>
              {visiblePlayers.map((player) => (
                <th key={player.id} className={`min-w-[4.7rem] border-l border-base-300/60 px-2 py-2 text-center text-xs ${player.id === currentPlayerId ? 'bg-primary/15 text-primary' : ''}`}>
                  <span className="block truncate font-bold">{player.id === localPlayerId ? 'Vous' : player.name}</span>
                  {player.abandoned && <span className="text-[10px] font-normal text-error">abandonné</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-base-300 bg-base-200/45">
              <th colSpan={visiblePlayers.length + 1} className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-base-content/50">Haut</th>
            </tr>
            {UPPER_CATEGORIES.map((category) => renderCategory(category.key, category.label))}
            <tr className="border-b-2 border-base-300 bg-base-200/40">
              <th className="sticky left-0 z-10 bg-base-200 px-3 py-2 text-left text-sm font-bold">Bonus</th>
              {visiblePlayers.map((player) => {
                const upper = upperScore(player)
                const bonusStatus = getBonusStatus(player)
                return (
                  <td key={player.id} className={`min-w-[4.7rem] border-l border-base-300/60 px-2 py-2 text-center text-xs font-semibold ${player.id === currentPlayerId ? 'bg-primary/10' : ''}`}>
                    <span className={bonusStatus.className} title={bonusStatus.label}>
                      <span className="block">{upper}/63</span>
                      {upper >= 63 && <span className="block text-[10px]">+35</span>}
                    </span>
                  </td>
                )
              })}
            </tr>
            <tr className="border-b border-base-300 bg-base-200/45">
              <th colSpan={visiblePlayers.length + 1} className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-base-content/50">Bas</th>
            </tr>
            {LOWER_CATEGORIES.map((category) => renderCategory(category.key, category.label))}
          </tbody>
          <tfoot className="border-t-2 border-base-300 bg-base-200">
            <tr>
              <th className="sticky left-0 z-10 bg-base-200 px-3 py-3 text-left text-sm font-bold">TOTAL</th>
              {visiblePlayers.map((player) => <td key={player.id} className={`min-w-[4.7rem] border-l border-base-300/60 px-2 py-3 text-center font-bold ${player.id === currentPlayerId ? 'bg-primary/15 text-primary' : ''}`}>{player.totalScore}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

function useCompactScoreSheet() {
  const [isCompact, setIsCompact] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px), (pointer: coarse) and (orientation: landscape)')
    const update = () => setIsCompact(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isCompact
}

function upperScore(player: PlayerGameState): number {
  return UPPER_CATEGORIES.reduce((sum, category) => sum + (player.scoreSheet[category.key] || 0), 0)
}

function getBonusStatus(player: PlayerGameState): { className: string; label: string } {
  const upper = upperScore(player)
  const expectedScore = UPPER_CATEGORIES
    .filter((category) => player.scoreSheet[category.key] !== null)
    .reduce((sum, category) => sum + upperCategoryTarget(category.key), 0)
  const maximumStillReachable = upper + UPPER_CATEGORIES
    .filter((category) => player.scoreSheet[category.key] === null)
    .reduce((sum, category) => sum + upperCategoryMaximum(category.key), 0)

  if (maximumStillReachable < 63) {
    return { className: 'text-error', label: 'Bonus hors d’atteinte' }
  }

  if (upper < expectedScore) {
    return { className: 'text-warning', label: 'Retard encore rattrapable pour le bonus' }
  }

  return { className: 'text-success', label: 'Objectif bonus tenu' }
}

function upperCategoryTarget(category: ScoreCategory): number {
  return UPPER_CATEGORY_TARGETS[category] ?? 0
}

function upperCategoryMaximum(category: ScoreCategory): number {
  return UPPER_CATEGORY_MAXIMUMS[category] ?? 0
}

function categoryLabel(category: ScoreCategory): string {
  return ALL_CATEGORIES.find((item) => item.key === category)?.label ?? category
}
