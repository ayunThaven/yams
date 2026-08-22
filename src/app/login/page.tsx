'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/Providers'

export default function LoginPage() {
  const router = useRouter()
  const { refreshUserProfile } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const confirm = params.get('confirm')

    if (confirm === 'success') {
      setMessage('✅ Email confirmé. Tu peux maintenant te connecter.')
    } else if (confirm === 'error') {
      setMessage(
        '❌ Erreur lors de la confirmation de ton email. Le lien est peut-être expiré.'
      )
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      const data = await response.json()
      setLoading(false)

      if (!response.ok) {
        setMessage(`❌ ${data.error || 'Erreur lors de la connexion.'}`)
        return
      }

      // Rafraîchir le contexte d'authentification (Navbar, dashboard, etc.)
      await refreshUserProfile()

      setMessage('✅ Connexion réussie ! Redirection...')
      setTimeout(() => router.push('/dashboard'), 500)
    } catch (error) {
      console.error('Erreur connexion:', error)
      setLoading(false)
      setMessage('❌ Erreur inattendue lors de la connexion.')
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[70vh] relative overflow-hidden">
      {/* Fond avec dégradé */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10"></div>
      
      <form
        onSubmit={handleSubmit}
        className="bg-base-100 p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-md space-y-6 relative z-10 border border-base-300"
      >
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Connexion
          </h1>
          <p className="text-base-content/70">Bienvenue sur Yams !</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text font-semibold">Email</span>
            </label>
            <input
              name="email"
              type="email"
              placeholder="votre@email.com"
              className="input input-bordered w-full focus:input-primary"
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="label">
              <span className="label-text font-semibold">Mot de passe</span>
            </label>
            <input
              name="password"
              type="password"
              placeholder="••••••••"
              className="input input-bordered w-full focus:input-primary"
              onChange={handleChange}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full btn-lg gap-2 shadow-lg"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              <span>Connexion...</span>
            </>
          ) : (
            <>
              <span>🔐</span>
              <span>Se connecter</span>
            </>
          )}
        </button>

        {message && (
          <div className={`alert ${message.includes('✅') ? 'alert-success' : 'alert-error'} shadow-lg`}>
            <span>{message}</span>
          </div>
        )}

        <div className="divider">ou</div>

        <div className="space-y-3 text-center">
          <p className="text-sm">
            <a href="/reset-password" className="link link-primary font-semibold">
              Mot de passe oublié ?
            </a>
          </p>

          <p className="text-sm text-base-content/70">
            Pas encore de compte ?{' '}
            <a href="/register" className="link link-primary font-semibold">
              Inscris-toi
            </a>
          </p>
        </div>
      </form>
    </div>
  )
}
