'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [token, setToken] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token') || ''
    setToken(urlToken)
  }, [])

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!email) {
      setMessage('❌ Merci de saisir ton email.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()
      setLoading(false)

      if (!res.ok) {
        setMessage(`❌ ${data.error || 'Erreur lors de la demande de réinitialisation.'}`)
        return
      }

      setMessage(
        data.message ||
          '✅ Si un compte existe avec cet email, tu recevras un lien de réinitialisation.'
      )
    } catch (error) {
      console.error('Erreur request reset:', error)
      setLoading(false)
      setMessage('❌ Erreur inattendue lors de la demande de réinitialisation.')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!token) {
      setMessage('❌ Lien invalide ou incomplet.')
      return
    }

    if (!password || password.length < 6) {
      setMessage('❌ Le mot de passe doit contenir au moins 6 caractères.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('❌ Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()
      setLoading(false)

      if (!res.ok) {
        setMessage(`❌ ${data.error || 'Erreur lors de la réinitialisation du mot de passe.'}`)
        return
      }

      setMessage('✅ Mot de passe mis à jour. Redirection vers la connexion...')
      setTimeout(() => router.push('/login'), 1500)
    } catch (error) {
      console.error('Erreur reset password:', error)
      setLoading(false)
      setMessage('❌ Erreur inattendue lors de la réinitialisation.')
    }
  }

  // Si pas de token dans l’URL : étape 1 = saisie de l’email
  if (!token) {
    return (
      <div className="club-auth-page club-auth-page-single">
        <form
          onSubmit={handleRequestReset}
          className="club-auth-form"
        >
          <h1 className="text-2xl font-bold text-center">Mot de passe oublié</h1>
          <p className="text-sm text-base-content/70 text-center">
            Entre ton email, nous t&apos;enverrons un lien pour définir un nouveau mot de passe.
          </p>

          <input
            type="email"
            placeholder="Ton email"
            className="input input-bordered w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
          </button>

          {message && (
            <p className="text-center text-sm text-base-content/80">{message}</p>
          )}
        </form>
      </div>
    )
  }

  // Si token présent : étape 2 = choix du nouveau mot de passe
  return (
    <div className="club-auth-page club-auth-page-single">
      <form
        onSubmit={handleChangePassword}
        className="club-auth-form"
      >
        <h1 className="text-2xl font-bold text-center">Réinitialiser le mot de passe</h1>

        <input
          type="password"
          placeholder="Nouveau mot de passe"
          className="input input-bordered w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="Confirmer le mot de passe"
          className="input input-bordered w-full"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={loading}
        >
          {loading ? 'Enregistrement...' : 'Enregistrer le nouveau mot de passe'}
        </button>

        {message && (
          <p className="text-center text-sm text-base-content/80">{message}</p>
        )}
      </form>
    </div>
  )
}


