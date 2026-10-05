'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightIcon, CopyIcon } from './icons/ClubIcons'

export default function JoinGame({ beforeJoin, initialCode = '', disabled = false }: { beforeJoin?: () => Promise<void>; initialCode?: string; disabled?: boolean } = {}) {
  const router = useRouter()
  const [code, setCode] = useState(initialCode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function join() {
    const value = code.trim().toUpperCase()
    if (!/^[A-HJ-NP-Z2-9]{8}$/.test(value)) { setError('Saisissez un code valide de 8 caractères.'); return }
    if (!value) { setError('Saisissez le code de la partie.'); return }
    setLoading(true); setError(null)
    try { await beforeJoin?.(); router.push(`/game/${value}`) }
    catch (err) { setError(err instanceof Error ? err.message : 'Impossible de rejoindre la partie.'); setLoading(false) }
  }

  async function paste() {
    try { const value = await navigator.clipboard.readText(); if (value.trim()) setCode(value.trim().toUpperCase()) }
    catch { setError('Le presse-papiers n’est pas accessible. Saisissez le code manuellement.') }
  }

  return <div className="club-join-form">
    <p className="club-eyebrow">Rejoindre avec un code</p>
    {error && <p className="club-form-error" role="alert">{error}</p>}
    <div className="club-join-code"><button type="button" onClick={paste} aria-label="Coller le code"><CopyIcon/></button><input value={code} disabled={loading || disabled} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && !disabled && !loading && join()} placeholder="CODE DE LA PARTIE" aria-label="Code de la partie"/><button type="button" onClick={join} disabled={disabled || loading || !code.trim()} aria-label="Rejoindre la partie">{loading ? <span className="loading loading-spinner loading-sm"/> : <ArrowRightIcon/>}</button></div>
  </div>
}
