'use client'

import { useState } from 'react'

export default function RegisterForm() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      const data = await response.json()
      setLoading(false)

      if (!response.ok) {
        setMessage(data.error || 'Erreur lors de la création du compte.')
        return
      }

      setMessage(
        data.message ||
          '✅ Compte créé. Vérifie ton email pour confirmer ton inscription.'
      )
    } catch (error) {
      console.error('Erreur inscription:', error)
      setLoading(false)
      setMessage('Erreur inattendue lors de la création du compte.')
    }
  }

  return (
    <div className="flex justify-center items-center min-h-[70vh] relative overflow-hidden w-full">
      {/* Fond avec dégradé */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10"></div>
      
      <form
        onSubmit={handleSubmit}
        className="bg-base-100 p-8 md:p-10 rounded-2xl shadow-2xl w-full max-w-md space-y-6 relative z-10 border border-base-300"
      >
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Inscription
          </h1>
          <p className="text-base-content/70">Rejoignez la communauté Yams !</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text font-semibold">Nom d&apos;utilisateur</span>
            </label>
            <input
              name="username"
              placeholder="Votre nom d'utilisateur"
              className="input input-bordered w-full focus:input-primary"
              onChange={handleChange}
            />
          </div>
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
              <span>Création...</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>S&apos;inscrire</span>
            </>
          )}
        </button>

        {message && (
          <div className={`alert ${message.includes('✅') ? 'alert-success' : 'alert-error'} shadow-lg`}>
            <span>{message}</span>
          </div>
        )}

        <div className="divider">ou</div>

        <p className="text-center text-sm text-base-content/70">
          Déjà un compte ?{' '}
          <a href="/login" className="link link-primary font-semibold">
            Connecte-toi
          </a>
        </p>
      </form>
    </div>
  )
}
