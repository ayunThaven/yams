'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/Providers'
import CreateGame from '@/components/CreateGame'
import JoinGame from '@/components/JoinGame'
import { usePublicGames } from '@/hooks/usePublicGames'
import { VARIANT_NAMES } from '@/lib/variantLogic'

type LobbyProps = { beforeAction?: () => Promise<void>; disabled?: boolean; initialCode?: string }
type Mode = 'CASUAL' | 'RANKED'

function ModeTabs({ mode, onChange, label }: { mode: Mode; onChange: (mode: Mode) => void; label: string }) {
  return <div className="club-mode-tabs" role="group" aria-label={label}>
    <button type="button" className={mode === 'CASUAL' ? 'is-active' : ''} aria-pressed={mode === 'CASUAL'} onClick={() => onChange('CASUAL')}>Casual</button>
    <button type="button" className={mode === 'RANKED' ? 'is-active' : ''} aria-pressed={mode === 'RANKED'} onClick={() => onChange('RANKED')}>Ranked</button>
  </div>
}

export function CreateLobbyCard({ beforeAction, disabled }: LobbyProps) {
  const [mode, setMode] = useState<Mode>('CASUAL')
  const { session } = useSupabase()
  const [rank, setRank] = useState<number | null>(null)
  const [rankStatus, setRankStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    if (mode !== 'RANKED' || session.kind !== 'USER') return
    let active = true
    fetch('/api/leaderboard').then(async response => {
      if (!response.ok) throw new Error('Classement indisponible')
      const data = await response.json()
      const topIndex = (data.data || []).findIndex((player: { id: string }) => player.id === session.user.id)
      if (active) { setRank(topIndex >= 0 ? topIndex + 1 : data.userRank || null); setRankStatus('ready') }
    }).catch(() => { if (active) setRankStatus('error') })
    return () => { active = false }
  }, [mode, session])
  return <article className="club-panel club-start-card club-create-card">
    <div><p className="club-eyebrow">Nouvelle partie</p><h2>Créer une partie</h2><p>Choisissez le mode de jeu qui vous convient.</p></div>
    <ModeTabs mode={mode} onChange={setMode} label="Type de partie à créer"/>
    <div className="club-mode-content">
      <div className="club-mode-panel" data-active={mode === 'CASUAL'} aria-hidden={mode !== 'CASUAL'} inert={mode !== 'CASUAL'}><CreateGame beforeCreate={beforeAction} disabled={disabled}/></div>
      <div className="club-mode-panel" data-active={mode === 'RANKED'} aria-hidden={mode !== 'RANKED'} inert={mode !== 'RANKED'}><div className="club-ranked-preview"><p>Les parties classées seront disponibles prochainement.</p><span className="club-eyebrow">Votre classement actuel</span><strong>{session.kind !== 'USER' ? 'Réservé aux comptes' : rankStatus === 'loading' ? 'Chargement…' : rankStatus === 'error' ? 'Indisponible' : rank ? `#${rank}` : 'Non classé'}</strong><button className="club-button club-button-primary" disabled>Créer une partie classée</button></div></div>
    </div>
  </article>
}

export function JoinLobbyCard({ beforeAction, disabled, initialCode }: LobbyProps) {
  const [mode, setMode] = useState<Mode>('CASUAL')
  const [actionError, setActionError] = useState('')
  const { session, isLoading } = useSupabase()
  const { games, loading, error } = usePublicGames(!isLoading && session.kind !== 'NONE' && mode === 'CASUAL')
  const router = useRouter()
  async function go(path: string) {
    try { setActionError(''); await beforeAction?.(); router.push(path) }
    catch (err) { setActionError(err instanceof Error ? err.message : 'Impossible de continuer.') }
  }
  return <article className="club-panel club-start-card club-join-card">
    <div><p className="club-eyebrow">Rejoindre</p><h2>Rejoindre une partie</h2><p>Rejoignez vos amis ou trouvez une table ouverte.</p></div>
    <ModeTabs mode={mode} onChange={setMode} label="Type de partie à rejoindre"/>
    <div className="club-mode-content">
    <div className="club-mode-panel" data-active={mode === 'CASUAL'} aria-hidden={mode !== 'CASUAL'} inert={mode !== 'CASUAL'}><div className="club-lobby-join-content">
      <JoinGame initialCode={initialCode} beforeJoin={beforeAction} disabled={disabled}/>
      <div className="club-lobby-public"><p className="club-eyebrow">Tables publiques</p>
        {actionError && <p className="club-form-error" role="alert">{actionError}</p>}
        {session.kind === 'NONE' ? <p>Choisissez votre pseudo pour découvrir les tables.</p> : loading ? <p>Recherche des tables…</p> : error ? <p>Tables indisponibles pour le moment.</p> : games.length === 0 ? <p>Aucune table ouverte pour le moment.</p> : <div className="club-lobby-public-list">{games.slice(0, 3).map(game => <button type="button" className="club-lobby-public-row" key={game.id} disabled={disabled} onClick={() => void go(`/game/${game.id}`)}>
          <span className="club-lobby-avatar" aria-hidden="true">{game.avatar ? <Image src={game.avatar} width={32} height={32} alt="" unoptimized/> : game.host.trim().charAt(0).toUpperCase()}</span><span className="club-lobby-table-name"><strong>{game.host}</strong><small>{VARIANT_NAMES[game.variant] || game.variant}</small></span><span>{game.players}/{game.maxPlayers}</span><span aria-hidden="true">→</span>
        </button>)}</div>}
        {beforeAction ? <button className="club-public-entry" disabled={disabled} onClick={() => void go('/public-games')}>Toutes les parties <span aria-hidden="true">→</span></button> : <Link className="club-public-entry" href="/public-games">Toutes les parties <span aria-hidden="true">→</span></Link>}
      </div>
    </div></div>
    <div className="club-mode-panel" data-active={mode === 'RANKED'} aria-hidden={mode !== 'RANKED'} inert={mode !== 'RANKED'}><div className="club-ranked-preview"><p>Les parties classées seront disponibles prochainement.</p><span className="club-eyebrow">Tables classées</span><strong>À venir</strong></div></div>
    </div>
  </article>
}
