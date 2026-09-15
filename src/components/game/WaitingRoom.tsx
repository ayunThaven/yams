/** Salle d'attente avant le début d'une partie. */

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Socket } from 'socket.io-client'
import { GameVariant } from '@/types/game'
import { VARIANT_NAMES } from '@/lib/variantLogic'
import { DiceMonogram } from '@/components/BrandMark'
import { ClockIcon, CopyIcon, PlusCircleIcon } from '@/components/icons/ClubIcons'

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
  const messagesRef = useRef<HTMLDivElement>(null)
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
    try {
      await navigator.clipboard.writeText(uuid)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const nonHostPlayers = players.slice(1)
  const allNonHostReady = nonHostPlayers.length > 0 && nonHostPlayers.every((player) => player.ready === true)
  const canStart = players.length >= 2 && allNonHostReady
  const myReady = players.find((player) => player.id === socket?.id)?.ready

  const handleMaxPlayersChange = (nextMax: number) => {
    if (!isHost || !socket || updatingMaxPlayers || preGameCountdown !== null) return
    if (nextMax < players.length) {
      setCapacityError(`Il y a déjà ${players.length} joueurs à la table.`)
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
    ? canStart ? 'Tout le monde est prêt.' : players.length < 2 ? 'Invitez au moins un partenaire.' : 'En attente des confirmations.'
    : players.length < 2 ? 'En attente d’un autre joueur.' : myReady ? 'Votre place est confirmée.' : 'Confirmez votre présence à la table.'

  return (
    <main className="club-lobby">
      <header className="club-lobby-hero">
        <DiceMonogram />
        <div>
          <p className="club-eyebrow">Table ouverte</p>
          <h1>La table est dressée.</h1>
          <p>Partagez le code, réunissez les joueurs, puis lancez la première manche.</p>
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
              <h2 id="lobby-invitation-title">Votre code de table</h2>
            </div>
            <span className={`club-lobby-status ${canStart ? 'is-ready' : ''}`}>{canStart ? 'Prête' : 'En préparation'}</span>
          </div>

          <button className="club-invite-code" type="button" onClick={copyGameId} aria-label="Copier le code de la partie">
            <code>{uuid}</code>
            <span><CopyIcon width={18} height={18} />{copied ? 'Copié' : 'Copier'}</span>
          </button>
          <p className="club-lobby-hint">Envoyez ce code à vos partenaires pour les faire entrer à la table.</p>

          <dl className="club-lobby-details">
            <div><dt>Variante</dt><dd>{variantLoading ? 'Chargement…' : VARIANT_NAMES[variant]}</dd></div>
            <div><dt>Places</dt><dd>{players.length} <span>/</span> {maxPlayers}</dd></div>
            <div><dt>Départ</dt><dd>À partir de 2 joueurs</dd></div>
          </dl>

          {isHost && (
            <label className="club-capacity-control">
              <span>Capacité de la table</span>
              <select value={maxPlayers} onChange={(event) => handleMaxPlayersChange(Number(event.target.value))} disabled={updatingMaxPlayers || preGameCountdown !== null}>
                {[2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count} joueurs</option>)}
              </select>
            </label>
          )}
          {capacityError && <p className="club-capacity-error" role="alert">{capacityError}</p>}
        </section>

        <section className="club-lobby-seats club-panel" aria-labelledby="lobby-seats-title">
          <header className="club-lobby-panel-heading">
            <div><p className="club-eyebrow">Autour de la table</p><h2 id="lobby-seats-title">Les places</h2></div>
            <span className="club-seat-count">{players.length} / {maxPlayers}</span>
          </header>
          <div className={`club-seat-grid ${maxPlayers >= 4 ? 'is-two-columns' : ''}`}>
            {players.map((player, index) => {
              const isPlayerHost = index === 0
              const isSelf = player.id === socket?.id
              return (
                <article className={`club-seat ${player.ready || isPlayerHost ? 'is-ready' : ''}`} key={player.id}>
                  <div className="club-seat-avatar">
                    {player.avatar ? <Image src={player.avatar} alt="" width={48} height={48} unoptimized /> : <span>{player.name.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="club-seat-name"><strong>{isSelf ? 'Vous' : player.name}</strong><small>{isPlayerHost ? 'Hôte' : player.ready ? 'Présence confirmée' : 'En attente'}</small></div>
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

      <section className="club-lobby-action club-panel">
        <div><p className="club-eyebrow">Prochaine étape</p><h2>{actionCopy}</h2></div>
        {isHost ? (
          <button type="button" className="club-button club-button-primary" onClick={onStart} disabled={!canStart || preGameCountdown !== null}>
            {preGameCountdown !== null ? 'Départ imminent…' : 'Commencer la partie'}
          </button>
        ) : (
          <button type="button" className="club-button club-button-primary" onClick={() => socket?.emit('player_ready', uuid)} disabled={players.length < 2 || Boolean(myReady) || preGameCountdown !== null}>
            {preGameCountdown !== null ? 'Départ imminent…' : myReady ? 'Présence confirmée' : 'Je suis prêt'}
          </button>
        )}
        <button type="button" className="club-button club-button-quiet" onClick={onLeave}>Quitter la table</button>
      </section>

      {systemMessages.length > 0 && (
        <details className="club-lobby-activity">
          <summary>Activité de la table <span>{systemMessages.length}</span></summary>
          <div ref={messagesRef}>{systemMessages.slice(-5).reverse().map((message, index) => <p key={`${message}-${index}`}>{message}</p>)}</div>
        </details>
      )}
    </main>
  )
}
