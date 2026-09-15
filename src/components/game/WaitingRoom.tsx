/**
 * Composant de salle d'attente avant le début de la partie
 * Affiche les joueurs connectés, le code de la partie et les actions disponibles
 */

import { useState, useEffect, useRef, ReactNode } from 'react'
import Image from 'next/image'
import { Socket } from 'socket.io-client'
import { GameVariant } from '@/types/game'
import { VARIANT_NAMES } from '@/lib/variantLogic'

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

/**
 * Composant de salle d'attente
 */
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
  const messagesRef = useRef<HTMLDivElement>(null)

  // Synchroniser avec la prop si elle change
  useEffect(() => {
    setMaxPlayers(initialMaxPlayers)
  }, [initialMaxPlayers])

  // Écouter les mises à jour de max_players depuis le serveur
  useEffect(() => {
    if (!socket) return

    const handleMaxPlayersUpdated = ({ maxPlayers: newMax }: { maxPlayers: number }) => {
      setMaxPlayers(newMax)
      if (onMaxPlayersChange) {
        onMaxPlayersChange(newMax)
      }
    }

    socket.on('max_players_updated', handleMaxPlayersUpdated)

    return () => {
      socket.off('max_players_updated', handleMaxPlayersUpdated)
    }
  }, [socket, onMaxPlayersChange])

  // Références pour les sons du compte à rebours
  const countdownStartSoundRef = useRef<HTMLAudioElement | null>(null)
  const countdownBeepSoundRef = useRef<HTMLAudioElement | null>(null)
  const previousCountdownRef = useRef<number | null>(null)

  // Scroll automatique vers le haut quand un nouveau message arrive
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = 0
    }
  }, [systemMessages])

  // Précharger les sons (si disponibles dans /public/sounds)
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      countdownStartSoundRef.current = new Audio('/sounds/countdown-beep.mp3')
    } catch {
      countdownStartSoundRef.current = null
    }

    try {
      countdownBeepSoundRef.current = new Audio('/sounds/countdown-beep.mp3')
    } catch {
      countdownBeepSoundRef.current = null
    }
  }, [])

  // Jouer les sons au début du timer et sur 3, 2, 1
  useEffect(() => {
    if (preGameCountdown === null) {
      previousCountdownRef.current = null
      return
    }

    const prev = previousCountdownRef.current

    // Son de début de compte à rebours (au passage à 10)
    if ((prev === null || prev === 0) && preGameCountdown === 10) {
      try {
        countdownStartSoundRef.current?.play().catch(() => {})
      } catch {
        // Ignorer les erreurs audio
      }
    }

    // Son court sur 3, 2, 1
    if (preGameCountdown === 3 || preGameCountdown === 2 || preGameCountdown === 1) {
      try {
        countdownBeepSoundRef.current?.play().catch(() => {})
      } catch {
        // Ignorer les erreurs audio
      }
    }

    previousCountdownRef.current = preGameCountdown
  }, [preGameCountdown])

  /**
   * Copie le code de la partie dans le presse-papier
   */
  const copyGameId = () => {
    navigator.clipboard.writeText(uuid)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Vérifier que tous les joueurs (sauf l'hôte) sont prêts
  const nonHostPlayers = players.slice(1)
  const allNonHostReady = nonHostPlayers.length > 0 && nonHostPlayers.every(p => p.ready === true)
  const canStart = players.length >= 2 && allNonHostReady

  const handleMaxPlayersChange = async (newMax: number) => {
    if (!isHost || !socket || updatingMaxPlayers) return
    if (newMax < 2 || newMax > 8) return
    if (newMax < players.length) {
      alert(`Impossible de réduire le nombre max de joueurs à ${newMax} car il y a déjà ${players.length} joueur(s) dans la partie.`)
      return
    }

    setUpdatingMaxPlayers(true)
    socket.emit('update_max_players', { roomId: uuid, maxPlayers: newMax })
    // On met à jour localement immédiatement pour un feedback rapide
    setMaxPlayers(newMax)
    if (onMaxPlayersChange) {
      onMaxPlayersChange(newMax)
    }
    setUpdatingMaxPlayers(false)
  }

  return (
    <div className={`club-waiting-room container mx-auto px-4 py-8 ${maxPlayers >= 5 ? 'max-w-6xl' : 'max-w-4xl'}`}>
      {/* En-tête */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-3 flex items-center justify-center gap-3">
          <svg
            className="w-10 h-10 md:w-12 md:h-12 waiting-room-dice"
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
              <title>perspective-dice-one</title>
              <path d="M27.111 8.247l-9.531-5.514c-0.895-0.518-2.346-0.518-3.241 0l-9.531 5.514c-0.61 0.353-0.804 0.856-0.582 1.304l11.291 6.447c0.27 0.031 0.548 0.033 0.819 0.007l11.385-6.515c0.176-0.432-0.026-0.906-0.609-1.243zM17.397 9.982c-0.779 0.462-2.041 0.462-2.82 0s-0.779-1.211 0-1.673 2.041-0.462 2.82 0c0.779 0.462 0.779 1.211 0 1.673zM27.424 10.14l-10.366 5.932c-0.365 0.36-0.669 0.831-0.861 1.322v11.721c0.281 0.394 0.803 0.467 1.401 0.122l9.168-5.294c0.895-0.517 1.621-1.774 1.621-2.808v-9.84c0-0.763-0.396-1.191-0.963-1.155zM20.092 17.199c0.002 0.861-0.626 1.923-1.401 2.372s-1.405 0.116-1.407-0.745c0-0.002 0-0.004 0-0.006-0.002-0.861 0.626-1.923 1.401-2.372s1.405-0.116 1.407 0.745c0 0.002 0 0.004 0 0.006zM27.081 20.821c0.002 0.861-0.626 1.923-1.401 2.372s-1.405 0.116-1.407-0.745c0-0.002 0-0.004 0-0.006-0.002-0.861 0.626-1.923 1.401-2.372s1.405-0.116 1.407 0.745c0 0.002 0 0.004 0 0.006zM15.645 17.134c-0.165-0.345-0.383-0.671-0.635-0.944l-10.597-6.051c-0.504 0.027-0.846 0.446-0.846 1.156v9.84c0 1.034 0.726 2.291 1.621 2.808l9.168 5.294c0.525 0.303 0.992 0.284 1.289 0.008v-12.111h-0zM7.682 14.791c-0.002 0.861-0.631 1.194-1.407 0.745s-1.403-1.511-1.401-2.372c0-0.002 0-0.004 0-0.006 0.002-0.861 0.631-1.194 1.407-0.745s1.403 1.511 1.401 2.372c0 0.002 0 0.004 0 0.006zM11.176 20.615c-0.002 0.861-0.631 1.194-1.407 0.745s-1.403-1.511-1.401-2.372c0-0.002 0-0.004 0-0.006 0.002-0.861 0.631-1.194 1.407-0.745s1.403 1.511 1.401 2.372c0 0.002 0 0.004 0 0.006zM14.671 26.483c-0.002 0.861-0.631 1.194-1.407 0.745s-1.403-1.511-1.401-2.372c0-0.002 0-0.004 0-0.006 0.002-0.861 0.631-1.194 1.407-0.745s1.403 1.511 1.401 2.372c0 0.002 0 0.004 0 0.006z"></path>
            </g>
          </svg>
          Invitez vos partenaires
        </h1>
        <p className="text-base-content/70">
          La table est prête. Partagez le code pour compléter les places.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Section gauche : Code de la partie */}
        <div className="space-y-6">
          {/* Code de la partie - Grande carte */}
          <div className="card-bordered">
            <div className="card-body items-center text-center">
              <h2 className="card-title text-sm uppercase tracking-wide text-base-content/70 mb-2">
                Code de la partie
              </h2>
              <div className="bg-base-100 px-6 py-4 rounded-lg shadow-inner">
                <code className="text-3xl md:text-4xl font-mono font-bold tracking-wider selectable-text">
                  {uuid}
                </code>
              </div>
              <button
                onClick={copyGameId}
                className={`btn btn-sm mt-3 ${
                  copied ? 'btn-success' : 'btn-primary'
                } gap-2`}
              >
                {copied ? (
                  <>
                    <span>✓</span>
                    <span>Copié !</span>
                  </>
                ) : (
                  <>
                    <span>📋</span>
                    <span>Copier le code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Informations */}
          <div className="card-bordered">
            <div className="card-body">
              <h3 className="card-title text-lg">ℹ️ Informations</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-base-content/70">Variante :</span>
                  {variantLoading ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <span className="badge badge-primary">
                      {VARIANT_NAMES[variant]}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base-content/70">Joueurs :</span>
                  <div className="flex items-center gap-1 flex-nowrap">
                    <span className="font-bold whitespace-nowrap text-sm">
                      {players.length} /
                    </span>
                    {isHost ? (
                      <div className={`dropdown dropdown-end ${updatingMaxPlayers || preGameCountdown !== null ? 'dropdown-disabled' : ''}`}>
                        <label
                          tabIndex={updatingMaxPlayers || preGameCountdown !== null ? -1 : 0}
                          className="font-bold text-sm cursor-pointer hover:text-primary hover:underline transition-all flex items-center gap-1"
                          title={updatingMaxPlayers || preGameCountdown !== null ? 'Modification impossible' : 'Cliquer pour modifier le nombre maximum de joueurs'}
                        >
                          {maxPlayers}
                          {!updatingMaxPlayers && preGameCountdown === null && (
                            <span className="text-xs opacity-60">▼</span>
                          )}
                        </label>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu menu-xs bg-base-100 rounded-box shadow-lg border border-base-300 z-[1] p-1"
                        >
                          {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                            <li key={num}>
                              <button
                                type="button"
                                className={num === maxPlayers ? 'active' : ''}
                                onClick={() => {
                                  if (updatingMaxPlayers || preGameCountdown !== null) return
                                  handleMaxPlayersChange(num)
                                  // Fermer le dropdown après sélection
                                  const dropdown = document.activeElement as HTMLElement
                                  dropdown?.blur()
                                }}
                                disabled={updatingMaxPlayers || preGameCountdown !== null}
                              >
                                {num}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <span className="font-bold text-sm">{maxPlayers}</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base-content/70">Minimum requis :</span>
                  <span className="font-bold">2 joueurs</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base-content/70">Statut :</span>
                  <span
                    className={`badge ${
                      canStart ? 'badge-success' : 'badge-warning'
                    }`}
                  >
                    {canStart ? 'Prêt' : 'En attente'}
                  </span>
                </div>

                {/* Compte à rebours avant le début de la partie */}
                {preGameCountdown !== null && (
                  <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
                    <p className="text-sm text-base-content/70 mb-1">
                      La partie commence dans
                    </p>
                    <p className="text-3xl font-mono font-bold">
                      {preGameCountdown}s
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages système */}
          {systemMessages.length > 0 && (
            <div className="card bg-info/10 border border-info/30 shadow-lg">
              <div className="card-body py-4">
                <h3 className="card-title text-sm">📢 Activité récente</h3>
                <div ref={messagesRef} className="space-y-1 max-h-32 overflow-y-auto scroll-smooth">
                  {systemMessages.slice(-5).reverse().map((msg, idx) => {
                    // Détecter les messages de connexion/déconnexion/abandon pour les griser
                    const isConnectionMessage = 
                      msg.includes('rejoint') || 
                      msg.includes('quitté') || 
                      msg.includes('déconnecté') || 
                      msg.includes('reconnecté') ||
                      msg.includes('abandonné')
                    
                    // Détecter les messages contenant des scores
                    const hasScore = msg.includes('marqué') && /\d+/.test(msg)
                    
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
                        className={`text-xs py-1 border-b border-base-content/10 first:border-t-0 ${
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
          )}
        </div>

        {/* Section droite : Joueurs */}
        <div className="space-y-6">
          {/* Liste des joueurs */}
          <div className="card-bordered">
            <div className="card-body">
              <h2 className="card-title mb-4">
                👥 Joueurs connectés ({players.length})
              </h2>
              <div className={maxPlayers >= 5 ? "grid grid-cols-2 gap-3" : "space-y-3"}>
                {players.map((p, index) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 glass rem p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Avatar */}
                    <div className="avatar">
                      <div className="w-12 h-12 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 relative overflow-hidden">
                        {p.avatar ? (
                          <Image 
                            src={p.avatar} 
                            alt={p.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="bg-primary text-primary-content rounded-full w-full h-full flex items-center justify-center">
                            <span className="text-xl font-bold">
                              {p.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Info joueur */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      {index === 0 && (
                        <p className="text-xs text-primary">🎮 Hôte</p>
                      )}
                    </div>
                    {/* Badge */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {index === 0 && <span className="badge badge-primary badge-sm">Hôte</span>}
                      {index > 0 && (
                        <span className={`badge badge-sm ${p.ready ? 'badge-success' : 'badge-warning'}`}>
                          {p.ready ? '✓ Prêt' : 'En attente'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Emplacements vides */}
                {Array.from({ length: maxPlayers - players.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-3 bg-base-100/30 p-3 rounded-lg border-2 border-dashed border-base-content/10"
                  >
                    <div className="avatar flex-shrink-0">
                      <div className="w-12 h-12 rounded-full ring ring-base-300/50 ring-offset-base-100 ring-offset-2 bg-base-300/50 relative">
                        {/* Icône utilisateur stylisé */}
                        <svg 
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 text-base-content/30" 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base-content/40 text-sm italic truncate">
                        En attente...
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="card-bordered">
            <div className="card-body">
              <div className="space-y-3">
                {isHost ? (
                  <>
                    {canStart ? (
                      <button
                        onClick={onStart}
                        className="btn btn-success btn-lg w-full gap-2"
                        disabled={preGameCountdown !== null}
                      >
                        <span>🚀</span>
                        <span>
                          {preGameCountdown !== null
                            ? 'Compte à rebours en cours...'
                            : 'Démarrer la partie'}
                        </span>
                      </button>
                    ) : players.length < 2 ? (
                      <div className="alert alert-warning">
                        <span>⏳</span>
                        <span className="text-sm">
                          En attente d&apos;au moins un autre joueur...
                        </span>
                      </div>
                    ) : (
                      <div className="alert alert-warning">
                        <span>⏳</span>
                        <span className="text-sm">
                          En attente que tous les joueurs soient prêts...
                        </span>
                      </div>
                    )}
                    <button onClick={onLeave} className="btn btn-outline btn-error w-full">
                      🚪 Quitter la salle
                    </button>
                  </>
                ) : (
                  <>
                    {players.length >= 2 ? (
                      <button
                        onClick={() => {
                          if (socket) {
                            socket.emit('player_ready', uuid)
                          }
                        }}
                        className={`btn btn-lg w-full gap-2 ${
                          players.find(p => p.id === socket?.id)?.ready
                            ? 'btn-success'
                            : 'btn-primary'
                        }`}
                        disabled={preGameCountdown !== null}
                      >
                        <span>
                          {players.find(p => p.id === socket?.id)?.ready ? '✓' : '👋'}
                        </span>
                        <span>
                          {players.find(p => p.id === socket?.id)?.ready
                            ? 'Prêt !'
                            : 'Marquer comme prêt'}
                        </span>
                      </button>
                    ) : (
                      <div className="alert alert-info">
                        <span>👤</span>
                        <span className="text-sm">
                          En attente d&apos;au moins un autre joueur...
                        </span>
                      </div>
                    )}
                    <button onClick={onLeave} className="btn btn-outline btn-error w-full">
                      🚪 Quitter la salle
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

