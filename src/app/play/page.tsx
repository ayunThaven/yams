'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSupabase } from '@/components/Providers'
import { CreateLobbyCard, JoinLobbyCard } from '@/components/LobbyCards'

export default function PlayPage() {
  const { session, isLoading, refreshUserProfile } = useSupabase()
  const router = useRouter()
  const [pendingJoin, setPendingJoin] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nicknameCheck, setNicknameCheck] = useState<{ value: string; status: 'checking' | 'available' | 'invalid' | 'unavailable'; message: string } | null>(null)
  const sessionRequest = useRef<Promise<void> | null>(null)
  const nicknameValid = nicknameCheck?.value === nickname && nicknameCheck.status === 'available'
  const nicknameInvalid = nicknameCheck?.value === nickname && nicknameCheck.status === 'invalid'

  useEffect(() => {
    if (session.kind !== 'NONE' || !nickname.trim()) { setNicknameCheck(null); return }
    const controller = new AbortController()
    setNicknameCheck({ value: nickname, status: 'checking', message: 'Vérification du pseudo…' })
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/guest/nickname', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname }), signal: controller.signal })
        const data = await response.json()
        if (controller.signal.aborted) return
        const status = response.ok ? (data.available === true ? 'available' : 'invalid') : response.status === 400 ? 'invalid' : 'unavailable'
        setNicknameCheck({ value: nickname, status, message: status === 'available' ? 'Pseudo disponible.' : data.error || 'Vérification indisponible.' })
      } catch {
        if (!controller.signal.aborted) setNicknameCheck({ value: nickname, status: 'unavailable', message: 'Vérification indisponible. Modifiez le pseudo pour réessayer.' })
      }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [nickname, session.kind])

  useEffect(() => {
    const join = new URLSearchParams(window.location.search).get('join')
    const validJoin = join && /^[A-HJ-NP-Z2-9]{8}$/.test(join) ? join : null
    setPendingJoin(validJoin)
    if (!isLoading && session.kind === 'USER') router.replace(validJoin ? `/game/${validJoin}` : '/dashboard')
  }, [session.kind, isLoading, router])

  async function ensureSession() {
    if (session.kind !== 'NONE') return
    if (!nicknameValid) throw new Error('Choisissez un pseudo disponible avant de continuer.')
    if (sessionRequest.current) return sessionRequest.current
    const request = (async () => {
      setBusy(true); setError(null)
      try {
        const response = await fetch('/api/guest/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname }) })
        const data = await response.json()
        if (!response.ok) {
          if (response.status === 409 || response.status === 400) setNicknameCheck({ value: nickname, status: 'invalid', message: data.error })
          throw new Error(data.error || 'Session indisponible.')
        }
        await refreshUserProfile()
      } finally { setBusy(false) }
    })()
    sessionRequest.current = request
    try { await request } finally { sessionRequest.current = null }
  }

  async function leaveSession() {
    setBusy(true); setError(null)
    try {
      const response = await fetch('/api/guest/session', { method: 'DELETE' })
      if (!response.ok) throw new Error('Impossible de quitter le mode invité.')
      await refreshUserProfile()
      setNickname('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Session indisponible.') }
    finally { setBusy(false) }
  }

  if (isLoading) return <p>Chargement…</p>
  return <section className="club-page club-guest-page">
    <header className="club-page-header"><p className="club-eyebrow">Parties privées · Casual</p><h1 className="club-page-title">Jouer sans compte</h1><p>Choisissez votre pseudo, puis créez ou rejoignez une partie.</p></header>
    {error && <p className="club-form-error" role="alert">{error}</p>}
    {session.kind === 'USER' ? <p>Ouverture de votre espace…</p> : <div className="club-guest-lobby">
      <div className="club-guest-identity">
        {session.kind === 'GUEST' ? <><p>Vous jouez en tant que <strong>{session.nickname}</strong>.</p><button className="club-button club-button-secondary" onClick={leaveSession} disabled={busy}>Changer de pseudo</button></> : <><label htmlFor="guest-nickname">Votre pseudo</label><input id="guest-nickname" className={`input input-bordered ${nicknameInvalid ? 'is-invalid' : nicknameValid ? 'is-valid' : ''}`} aria-invalid={nicknameInvalid} value={nickname} disabled={busy} onChange={event => setNickname(event.target.value)} autoComplete="nickname" placeholder="Choisissez un pseudo" aria-describedby="guest-nickname-help"/><small id="guest-nickname-help" role="status" aria-live="polite" className={nicknameInvalid ? 'is-error' : nicknameValid ? 'is-success' : undefined}>{nicknameCheck?.value === nickname ? nicknameCheck.message : '1 à 32 caractères.'}</small></>}
      </div>
      <div className="club-guest-options">
        <CreateLobbyCard beforeAction={ensureSession} disabled={busy || (session.kind === 'NONE' && !nicknameValid)}/>
        <JoinLobbyCard key={pendingJoin || 'no-invitation'} initialCode={pendingJoin || ''} beforeAction={ensureSession} disabled={busy || (session.kind === 'NONE' && !nicknameValid)}/>
      </div>
      <p className="club-guest-note">Sans inscription</p>
    </div>}
    <nav className="club-guest-account" aria-label="Accès au compte">
      <span>Pour garder votre progression :</span>
      <Link href="/register">Créer un compte</Link><span aria-hidden="true">·</span>
      <Link href="/login">Se connecter</Link>
    </nav>
  </section>
}
