'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightIcon, CopyIcon } from './icons/ClubIcons'

export default function JoinGame() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function join() {
    const value = code.trim()
    if (!value) { setError('Saisissez le code inscrit sur votre invitation.'); return }
    setLoading(true); setError(null); router.push(`/game/${value}`)
  }

  async function paste() {
    try { const value = await navigator.clipboard.readText(); if (value.trim()) setCode(value.trim().toUpperCase()) }
    catch { setError('Le presse-papiers n’est pas accessible. Saisissez le code manuellement.') }
  }

  return <div className="club-join-form">
    {error && <p className="club-form-error" role="alert">{error}</p>}
    <div><button type="button" onClick={paste} aria-label="Coller le code"><CopyIcon/></button><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && join()} placeholder="CODE DE LA TABLE" aria-label="Code de la partie"/><button type="button" onClick={join} disabled={loading || !code.trim()} aria-label="Rejoindre la partie">{loading ? <span className="loading loading-spinner loading-sm"/> : <ArrowRightIcon/>}</button></div>
    <button type="button" className="club-public-games-button" disabled><span>Parties publiques</span><small>Bientôt disponible</small></button>
  </div>
}
