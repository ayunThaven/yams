'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BackofficeLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'password' | 'totp'>('password')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('')
    const form = new FormData(event.currentTarget)
    const endpoint = step === 'password' ? '/api/backoffice/auth/login' : '/api/backoffice/auth/verify'
    const body = step === 'password' ? { email: form.get('email'), password: form.get('password') } : { code: form.get('code') }
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json().catch(() => ({})); setLoading(false)
    if (!response.ok) { setError(result.error || 'Accès refusé.'); return }
    if (step === 'password') setStep('totp'); else router.replace('/backoffice')
  }
  return <div className="min-h-screen flex items-center justify-center"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl space-y-5"><div><p className="text-xs uppercase tracking-[.3em] text-emerald-400">Accès restreint</p><h1 className="text-3xl font-bold">Back-office</h1></div>{step === 'password' ? <><label className="block"><span className="text-sm">Email professionnel</span><input name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-600 p-3" /></label><label className="block"><span className="text-sm">Mot de passe</span><input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-600 p-3" /></label></> : <label className="block"><span className="text-sm">Code TOTP ou récupération</span><input name="code" required autoFocus autoComplete="one-time-code" className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-600 p-3 tracking-widest" /></label>}{error && <p className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}<button disabled={loading} className="w-full rounded-lg bg-emerald-500 p-3 font-bold text-slate-950 disabled:opacity-50">{loading ? 'Vérification…' : step === 'password' ? 'Continuer' : 'Ouvrir le back-office'}</button></form></div>
}

