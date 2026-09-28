/** Salle d'attente avant le début d'une partie. */

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Socket } from 'socket.io-client'
import { GameVariant } from '@/types/game'
import { VARIANT_NAMES } from '@/lib/variantLogic'
import { DiceMonogram } from '@/components/BrandMark'
import { ChevronDownIcon, ClockIcon, CopyIcon, PlusCircleIcon } from '@/components/icons/ClubIcons'

type Player = { id: string; name: string; avatar?: string; ready?: boolean }

interface WaitingRoomProps {
  uuid: string
  players: Player[]
  systemMessages: string[]
  isHost: boolean
  onStart: () => void
  onLeave: () => void
  variant?: GameVariant
  variantLoading?: boolean
  preGameCountdown?: number | null
  maxPlayers?: number
  socket?: Socket | null
  onMaxPlayersChange?: (maxPlayers: number) => void
}

export default function WaitingRoom({
  uuid,
  players,
  systemMessages,
  isHost,
  onStart,
  onLeave,
  variant = 'classic',
  variantLoading = false,
  preGameCountdown = null,
  maxPlayers: initialMaxPlayers = 4,
  socket,
  onMaxPlayersChange,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false)
  const [maxPlayers, setMaxPlayers] = useState(initialMaxPlayers)
  const [updatingMaxPlayers, setUpdatingMaxPlayers] = useState(false)
  const [capacityError, setCapacityError] = useState('')
  const [capacityPickerOpen, setCapacityPickerOpen] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const capacityPickerRef = useRef<HTMLDivElement>(null)
  const countdownStartSoundRef = useRef<HTMLAudioElement | null>(null)
  const countdownBeepSoundRef = useRef<HTMLAudioElement | null>(null)
  const previousCountdownRef = useRef<number | null>(null)

  useEffect(() => setMaxPlayers(initialMaxPlayers), [initialMaxPlayers])

  useEffect(() => {
    if (!socket) return
    const handleMaxPlayersUpdated = ({ maxPlayers: nextMax }: { maxPlayers: number }) => {
      setMaxPlayers(nextMax)
      onMaxPlayersChange?.(nextMax)
    }
    socket.on('max_players_updated', handleMaxPlayersUpdated)
    return () => {
      socket.off('max_players_updated', handleMaxPlayersUpdated)
    }
  }, [socket, onMaxPlayersChange])

  useEffect(() => {
    if (!capacityPickerOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!capacityPickerRef.current?.contains(event.target as Node)) setCapacityPickerOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCapacityPickerOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [capacityPickerOpen])

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = 0
  }, [systemMessages])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { countdownStartSoundRef.current = new Audio('/sounds/countdown-beep.mp3') } catch { countdownStartSoundRef.current = null }
    try { countdownBeepSoundRef.current = new Audio('/sounds/countdown-beep.mp3') } catch { countdownBeepSoundRef.current = null }
  }, [])

  useEffect(() => {
    if (preGameCountdown === null) {
      previousCountdownRef.current = null
      return
    }
    const previous = previousCountdownRef.current
    const shouldStartBeep = (previous === null || previous === 0) && preGameCountdown === 10
    const shouldTick = [3, 2, 1].includes(preGameCountdown)
    try {
      if (shouldStartBeep) countdownStartSoundRef.current?.play().catch(() => {})
      if (shouldTick) countdownBeepSoundRef.current?.play().catch(() => {})
    } catch { /* Audio is optional. */ }
    previousCountdownRef.current = preGameCountdown
  }, [preGameCountdown])

  const copyGameId = async () => {
    let didCopy = false
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(uuid)
        didCopy = true
      }
    } catch { /* Fall back to the legacy clipboard API below. */ }

    if (!didCopy) {
      const textarea = document.createElement('textarea')
      textarea.value = uuid
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      textarea.style.pointerEvents = 'none'
      document.body.appendChild(textarea)
      textarea.select()
      textarea.setSelectionRange(0, textarea.value.length)
      try {
        didCopy = document.execCommand('copy')
      } finally {
        document.body.removeChild(textarea)
      }
    }

    setCopied(didCopy)
    if (didCopy) window.setTimeout(() => setCopied(false), 2000)
  }

  const nonHostPlayers = players.slice(1)
  const allNonHostReady = nonHostPlayers.length > 0 && nonHostPlayers.every((player) => player.ready === true)
  const canStart = players.length >= 2 && allNonHostReady
  const myReady = players.find((player) => player.id === socket?.id)?.ready

  const handleMaxPlayersChange = (nextMax: number) => {
    if (!isHost || !socket || updatingMaxPlayers || preGameCountdown !== null) return
    if (nextMax < players.length) {
      setCapacityError(`Il y a déjà ${players.length} joueurs dans la partie.`)
      return
    }
    setCapacityError('')
    setUpdatingMaxPlayers(true)
    socket.emit('update_max_players', { roomId: uuid, maxPlayers: nextMax })
    setMaxPlayers(nextMax)
    onMaxPlayersChange?.(nextMax)
    setUpdatingMaxPlayers(false)
  }

  const actionCopy = isHost
    ? canStart ? 'Tout le monde est prêt.' : players.length < 2 ? 'Partagez le code de la partie.' : 'En attente des confirmations.'
    : players.length < 2 ? 'En attente d’un autre joueur.' : myReady ? 'Vous êtes prêt(e).' : 'Indiquez que vous êtes prêt(e).'
  const lobbyTitle = canStart
    ? 'La partie peut commencer.'
    : players.length < 2
      ? 'Invitez un autre joueur.'
      : 'En attente des confirmations.'
  const lobbyDescription = canStart
    ? 'Tout le monde est prêt. Vous pouvez commencer la partie.'
    : players.length < 2
      ? 'Partagez le code pour permettre à un autre joueur de rejoindre la partie.'
      : 'Chaque joueur doit indiquer qu’il est prêt avant le départ.'

  return (
    <main className="club-lobby">
      <header className="club-lobby-hero">
        <DiceMonogram />
        <div>
          <p className="club-eyebrow">{canStart ? 'Prêts à jouer' : 'Partie en attente'}</p>
          <h1>{lobbyTitle}</h1>
          <p>{lobbyDescription}</p>
        </div>
      </header>

      {preGameCountdown !== null && (
        <section className="club-lobby-countdown" aria-live="assertive">
          <ClockIcon width={22} height={22} />
          <span>Les dés seront lancés dans</span>
          <strong>{preGameCountdown}</strong>
        </section>
      )}

      <div className="club-lobby-layout">
        <section className="club-lobby-invitation club-panel" aria-labelledby="lobby-invitation-title">
          <div className="club-lobby-panel-heading">
            <div>
              <p className="club-eyebrow">Invitation</p>
              <h2 id="lobby-invitation-title">Code de la partie</h2>
            </div>
            <span className={`club-lobby-status ${canStart ? 'is-ready' : ''}`}>{canStart ? 'Prête' : 'En préparation'}</span>
          </div>

          <button className="club-invite-code" type="button" onClick={copyGameId} aria-label="Copier le code de la partie">
            <code>{uuid}</code>
            <span><CopyIcon width={18} height={18} />{copied ? 'Copié' : 'Copier'}</span>
          </button>
          <p className="club-lobby-hint">Partagez ce code pour inviter les autres joueurs.</p>

          <dl className="club-lobby-details">
            <div><dt>Variante</dt><dd>{variantLoading ? 'Chargement…' : VARIANT_NAMES[variant]}</dd></div>
          </dl>

          {isHost && (
            <div className={`club-capacity-picker ${capacityPickerOpen ? 'is-open' : ''}`} ref={capacityPickerRef}>
              <button type="button" aria-expanded={capacityPickerOpen} aria-haspopup="listbox" aria-controls="capacity-options" onClick={() => setCapacityPickerOpen((open) => !open)} disabled={updatingMaxPlayers || preGameCountdown !== null}>
                <span>Nombre de joueurs</span>
                <span><strong>{maxPlayers} joueurs</strong><ChevronDownIcon width={16} height={16} /></span>
              </button>
              {capacityPickerOpen && <div id="capacity-options" className="club-capacity-options" role="listbox" aria-label="Nombre de joueurs">
                {[2, 3, 4, 5, 6, 7, 8].map((count) => <button key={count} type="button" role="option" aria-selected={count === maxPlayers} className={count === maxPlayers ? 'is-selected' : ''} onClick={() => { handleMaxPlayersChange(count); setCapacityPickerOpen(false) }} disabled={count < players.length || updatingMaxPlayers || preGameCountdown !== null}>
                  <span>{count} joueurs</span><i aria-hidden="true" />
                </button>)}
              </div>}
            </div>
          )}
          {capacityError && <p className="club-capacity-error" role="alert">{capacityError}</p>}

          <section className="club-lobby-action" aria-label="Actions de la partie">
            <div><p className="club-eyebrow">Prochaine étape</p><h2>{actionCopy}</h2></div>
            {isHost ? (
              <button type="button" className="club-button club-button-primary" onClick={onStart} disabled={!canStart || preGameCountdown !== null}>
                {preGameCountdown !== null ? 'Départ imminent…' : 'Commencer la partie'}
              </button>
            ) : (
              <button type="button" className="club-button club-button-primary" onClick={() => socket?.emit('player_ready', uuid)} disabled={players.length < 2 || Boolean(myReady) || preGameCountdown !== null}>
                {preGameCountdown !== null ? 'Départ imminent…' : myReady ? 'Prêt(e)' : 'Je suis prêt'}
              </button>
            )}
            <button type="button" className="club-button club-button-quiet" onClick={onLeave}>Quitter la partie</button>
          </section>
        </section>

        <section className="club-lobby-seats club-panel" aria-labelledby="lobby-seats-title">
          <header className="club-lobby-panel-heading">
            <div><p className="club-eyebrow">Joueurs</p><h2 id="lobby-seats-title">Participants</h2></div>
            <span className="club-seat-count">{players.length} / {maxPlayers}</span>
          </header>
          <div className={`club-seat-grid ${maxPlayers >= 4 ? 'is-two-columns' : ''} ${maxPlayers >= 5 ? 'is-large-table' : ''}`}>
            {players.map((player, index) => {
              const isPlayerHost = index === 0
              const isSelf = player.id === socket?.id
              return (
                <article className={`club-seat ${player.ready || isPlayerHost ? 'is-ready' : ''}`} key={player.id}>
                  <div className="club-seat-avatar">
                    {player.avatar ? <Image src={player.avatar} alt="" width={48} height={48} unoptimized /> : <span>{player.name.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="club-seat-name"><strong>{isSelf ? 'Vous' : player.name}</strong><small>{isPlayerHost ? 'Hôte' : player.ready ? 'Prêt(e)' : 'En attente'}</small></div>
                  <span className="club-seat-mark" aria-label={isPlayerHost ? 'Hôte' : player.ready ? 'Prêt' : 'En attente'}>{isPlayerHost ? 'H' : player.ready ? '✓' : '·'}</span>
                </article>
              )
            })}
            {Array.from({ length: Math.max(0, maxPlayers - players.length) }).map((_, index) => (
              <div className="club-seat club-seat-empty" key={`empty-${index}`}><PlusCircleIcon width={20} height={20} /><span>Place ouverte</span></div>
            ))}
          </div>
        </section>
      </div>

      {systemMessages.length > 0 && (
        <details className="club-lobby-activity">
          <summary>Activité de la partie <span>{systemMessages.length}</span></summary>
          <div ref={messagesRef}>{systemMessages.slice(-5).reverse().map((message, index) => <p key={`${message}-${index}`}>{message}</p>)}</div>
        </details>
      )}
    </main>
  )
}
