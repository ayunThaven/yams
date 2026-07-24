'use client'
import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/components/Providers"
import { useGameProtection } from "@/contexts/GameProtectionContext"
import { tokenManager } from "@/lib/tokenManager"
import { generateGameId } from "@/lib/gameIdGenerator"
import { GameVariant } from "@/types/game"
import { VARIANT_NAMES, VARIANT_DESCRIPTIONS } from "@/lib/variantLogic"
import ThemeToggle from "./ThemeToggle"
import PlusIcon from "./icons/PlusIcon"
import { useTheme } from "next-themes"

export default function Navbar() {
  const { user, userProfile, refreshUserProfile } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joinLoading, setJoinLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [selectedVariant, setSelectedVariant] = useState<GameVariant>('classic')
  const router = useRouter()
  const { isInActiveGame, handleAbandonBeforeNavigation } = useGameProtection()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeToggle = () => {
    const newTheme = theme === "yams-dark" ? "yams" : "yams-dark"
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
    }

    tokenManager.clearTokens()
    await refreshUserProfile()

    setLoading(false)
    setIsMenuOpen(false)
    router.push('/login')
  }

  const handleJoinGame = async () => {
    const trimmed = joinCode.trim()
    if (!trimmed) {
      alert("Veuillez entrer un code de partie valide.")
      return
    }

    try {
      setJoinLoading(true)
      // On vide le champ dès que l'action est lancée
      setJoinCode("")
      // Petit délai pour laisser React afficher l'état de chargement
      await new Promise((resolve) => setTimeout(resolve, 50))
      router.push(`/game/${trimmed}`)
    } finally {
      setJoinLoading(false)
    }
  }

  const handleJoinKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleJoinGame()
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text.trim()) {
        setJoinCode(text.trim().toUpperCase())
      }
    } catch (error) {
      console.error('Erreur lors de la lecture du presse-papier:', error)
      // Fallback: essayer de coller depuis un input temporaire
      const tempInput = document.createElement('input')
      tempInput.style.position = 'fixed'
      tempInput.style.opacity = '0'
      document.body.appendChild(tempInput)
      tempInput.focus()
      document.execCommand('paste')
      const pastedText = tempInput.value
      document.body.removeChild(tempInput)
      if (pastedText && pastedText.trim()) {
        setJoinCode(pastedText.trim().toUpperCase())
      }
    }
  }

  const handleCreateGame = async () => {
    if (!user) {
      return router.push('/login')
    }

    setCreateLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 50))

    const id = generateGameId()

    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, variant: selectedVariant }),
      })

      const data = await response.json()

      if (!response.ok) {
        setCreateLoading(false)
        alert(`Erreur lors de la création de la partie: ${data.error || 'Erreur inconnue'}`)
      } else {
        setShowCreateModal(false)
        await new Promise((resolve) => setTimeout(resolve, 200))
        router.push(`/game/${id}`)
      }
    } catch (err) {
      console.error('Erreur création partie:', err)
      setCreateLoading(false)
      alert('Erreur inattendue lors de la création de la partie')
    }
  }

  // Gestion de la navigation avec confirmation si en partie
  const handleNavigation = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (isInActiveGame) {
      e.preventDefault()
      const confirmed = window.confirm(
        '⚠️ Vous êtes en pleine partie !\n\nSi vous quittez maintenant, cela sera considéré comme un abandon et vous perdrez la partie.\n\nÊtes-vous sûr de vouloir quitter ?'
      )
      if (confirmed) {
        // Émettre l'abandon AVANT de naviguer
        handleAbandonBeforeNavigation()
        // Petit délai pour laisser le temps au serveur de traiter l'abandon
        setTimeout(() => {
          router.push(href)
        }, 100)
      }
    }
 
    // Sur mobile on ferme le menu après clic
    setIsMenuOpen(false)
  }

  return (
    <div className="navbar bg-base-200/95 backdrop-blur-md shadow-lg border-b border-base-300 sticky top-0 z-50 lg:relative">
      <div className="flex-1 flex items-center gap-2 md:gap-3 lg:gap-4 min-w-0">
        <Link 
          href="/" 
          className="btn btn-ghost normal-case text-xl md:text-2xl font-display font-bold flex-shrink-0 gap-2 hover:bg-primary/10 transition-all max-[430px]:px-2"
          onClick={(e) => handleNavigation(e, '/')}
        >
          <svg 
            className="w-8 h-8 navbar-dice-icon" 
            viewBox="0 0 32 32" 
            fill="var(--dice-color)" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
              <title>perspective-dice-one</title>
              <path d="M27.111 8.247l-9.531-5.514c-0.895-0.518-2.346-0.518-3.241 0l-9.531 5.514c-0.61 0.353-0.804 0.856-0.582 1.304l11.291 6.447c0.27 0.031 0.548 0.033 0.819 0.007l11.385-6.515c0.176-0.432-0.026-0.906-0.609-1.243zM17.397 9.982c-0.779 0.462-2.041 0.462-2.82 0s-0.779-1.211 0-1.673 2.041-0.462 2.82 0c0.779 0.462 0.779 1.211 0 1.673zM27.424 10.14l-10.366 5.932c-0.365 0.36-0.669 0.831-0.861 1.322v11.721c0.281 0.394 0.803 0.467 1.401 0.122l9.168-5.294c0.895-0.517 1.621-1.774 1.621-2.808v-9.84c0-0.763-0.396-1.191-0.963-1.155zM20.092 17.199c0.002 0.861-0.626 1.923-1.401 2.372s-1.405 0.116-1.407-0.745c0-0.002 0-0.004 0-0.006-0.002-0.861 0.626-1.923 1.401-2.372s1.405-0.116 1.407 0.745c0 0.002 0 0.004 0 0.006zM27.081 20.821c0.002 0.861-0.626 1.923-1.401 2.372s-1.405 0.116-1.407-0.745c0-0.002 0-0.004 0-0.006-0.002-0.861 0.626-1.923 1.401-2.372s1.405-0.116 1.407 0.745c0 0.002 0 0.004 0 0.006zM15.645 17.134c-0.165-0.345-0.383-0.671-0.635-0.944l-10.597-6.051c-0.504 0.027-0.846 0.446-0.846 1.156v9.84c0 1.034 0.726 2.291 1.621 2.808l9.168 5.294c0.525 0.303 0.992 0.284 1.289 0.008v-12.111h-0zM7.682 14.791c-0.002 0.861-0.631 1.194-1.407 0.745s-1.403-1.511-1.401-2.372c0-0.002 0-0.004 0-0.006 0.002-0.861 0.631-1.194 1.407-0.745s1.403 1.511 1.401 2.372c0 0.002 0 0.004 0 0.006zM11.176 20.615c-0.002 0.861-0.631 1.194-1.407 0.745s-1.403-1.511-1.401-2.372c0-0.002 0-0.004 0-0.006 0.002-0.861 0.631-1.194 1.407-0.745s1.403 1.511 1.401 2.372c0 0.002 0 0.004 0 0.006zM14.671 26.483c-0.002 0.861-0.631 1.194-1.407 0.745s-1.403-1.511-1.401-2.372c0-0.002 0-0.004 0-0.006 0.002-0.861 0.631-1.194 1.407-0.745s1.403 1.511 1.401 2.372c0 0.002 0 0.004 0 0.006z"></path>
            </g>
          </svg>
          <span className="navbar-logo-text max-[830px]:hidden">Yams</span>
        </Link>

        {/* Zone création + rejoindre une partie - entre le nom du site et le menu */}
        {user && (
          <div className="flex-1 flex justify-center min-w-0 max-w-2xl lg:absolute lg:left-1/2 lg:-translate-x-1/2">
            <div className="flex items-center gap-1 md:gap-2 w-full max-w-lg lg:max-w-xl">
              {/* Bouton créer une partie - visible seulement sur desktop */}
              <button
                type="button"
                className="hidden md:inline-flex btn btn-sm btn-primary whitespace-nowrap"
                onClick={() => setShowCreateModal(true)}
                disabled={createLoading}
              >
                <PlusIcon className="w-4 h-4" />
                <span>Créer une partie</span>
              </button>
              {/* Séparateur visuel entre création et jointure */}
              <div className="hidden md:block h-6 w-px bg-neutral/40 dark:bg-neutral/60" />
              <div className="flex items-center gap-0 w-full max-w-[280px] lg:max-w-xs">
                <button
                  type="button"
                  className="input input-sm input-bordered rounded-r-none w-10 px-0 flex items-center justify-center cursor-pointer hover:bg-base-200 transition-colors input-no-focus"
                  onClick={handlePaste}
                  disabled={joinLoading}
                  title="Coller le code de la partie"
                >
                  📋
                </button>
                <input
                  type="text"
                  placeholder="Code de la partie"
                  className="input input-sm input-bordered flex-1 rounded-none border-r-0 input-no-focus"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={handleJoinKeyDown}
                  disabled={joinLoading}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-secondary whitespace-nowrap rounded-l-none"
                  onClick={handleJoinGame}
                  disabled={joinLoading || !joinCode.trim()}
                  title="Rejoindre la partie"
                >
                  {joinLoading ? (
                    "..."
                  ) : (
                    <>
                      <span className="max-[430px]:hidden">Rejoindre</span>
                      <span className="min-[431px]:hidden">→</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-none flex items-center gap-2 max-[430px]:px-2">
        <div className="max-[430px]:hidden">
          <ThemeToggle />
        </div>

        {/* Menu desktop */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Link 
                href="/leaderboard" 
                className="btn btn-ghost"
                onClick={(e) => handleNavigation(e, '/leaderboard')}
              >
                🏆 Classement
              </Link>
              {/* Bulle utilisateur avec avatar + menu */}
              <div className="dropdown dropdown-end">
                <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
                  <div className="w-10 rounded-full overflow-hidden">
                    {userProfile?.avatar_url ? (
                      <Image
                        src={userProfile.avatar_url}
                        alt={userProfile.username}
                        width={40}
                        height={40}
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="bg-neutral-focus text-neutral-content w-full h-full flex items-center justify-center">
                        <span className="text-lg">
                          {userProfile?.username?.charAt(0).toUpperCase() ?? "U"}
                        </span>
                      </div>
                    )}
                  </div>
                </label>
                <ul
                  tabIndex={0}
                  className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300"
                >
                  <li className="menu-title border-b border-base-300 pb-2 mb-2">
                    <span className="font-semibold">{userProfile?.username ?? "Utilisateur"}</span>
                  </li>
                  <li>
                    <Link
                      href="/dashboard"
                      onClick={(e) => handleNavigation(e, "/dashboard")}
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <button onClick={handleLogout} disabled={loading}>
                      {loading ? "..." : "Déconnexion"}
                    </button>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost">Connexion</Link>
              <Link href="/register" className="btn btn-primary">Inscription</Link>
            </>
          )}
        </div>

        {/* Menu burger mobile */}
        <div className="md:hidden">
          <div className="dropdown dropdown-end">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsMenuOpen((prev) => !prev)}
            >
              <span className="sr-only">Ouvrir le menu</span>
              <div className="flex flex-col gap-1">
                <span className="h-0.5 w-5 bg-current rounded" />
                <span className="h-0.5 w-5 bg-current rounded" />
                <span className="h-0.5 w-5 bg-current rounded" />
              </div>
            </button>
            <ul
              className={`menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 ${isMenuOpen ? "" : "hidden"}`}
            >
              {user ? (
                <>
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false)
                        setShowCreateModal(true)
                      }}
                      disabled={createLoading}
                    >
                      <PlusIcon className="w-4 h-4" />
                <span>Créer une partie</span>
                    </button>
                  </li>
                  {mounted && (
                    <li className="max-[430px]:block hidden">
                      <button
                        type="button"
                        onClick={handleThemeToggle}
                        className="w-full text-left"
                      >
                        {theme === "yams-dark" ? "☀️" : "🌙"}
                        <span>{theme === "yams-dark" ? "Thème clair" : "Thème sombre"}</span>
                      </button>
                    </li>
                  )}
                  <li>
                    <Link
                      href="/leaderboard"
                      onClick={(e) => handleNavigation(e, '/leaderboard')}
                    >
                      🏆 Classement
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard"
                      onClick={(e) => handleNavigation(e, '/dashboard')}
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <button onClick={handleLogout} disabled={loading}>
                      {loading ? "..." : "Déconnexion"}
                    </button>
                  </li>
                </>
              ) : (
                <>
                  {mounted && (
                    <li className="max-[430px]:block hidden">
                      <button
                        type="button"
                        onClick={handleThemeToggle}
                        className="w-full text-left"
                      >
                        {theme === "yams-dark" ? "☀️" : "🌙"}
                        <span>{theme === "yams-dark" ? "Thème clair" : "Thème sombre"}</span>
                      </button>
                    </li>
                  )}
                  <li>
                    <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                      Connexion
                    </Link>
                  </li>
                  <li>
                    <Link href="/register" onClick={() => setIsMenuOpen(false)}>
                      Inscription
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Modal de création de partie - rendue via portail pour s'afficher au centre de la page */}
      {showCreateModal && typeof window !== 'undefined' && createPortal(
        <div className="modal modal-open">
          <div className="modal-box card-bordered max-w-2xl">
            <h3 className="font-bold text-2xl mb-6">Choisir une variante</h3>
            
            <div className="space-y-4">
              {/* Variante Classique */}
              <div
                onClick={() => setSelectedVariant('classic')}
                className={`card glass cursor-pointer transition-all ${
                  selectedVariant === 'classic' 
                    ? 'bg-primary text-primary-content shadow-lg' 
                    : 'bg-base-200 hover:bg-base-300'
                }`}
              >
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="variant"
                      className="radio"
                      checked={selectedVariant === 'classic'}
                      onChange={() => setSelectedVariant('classic')}
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{VARIANT_NAMES.classic}</h4>
                      <p className={selectedVariant === 'classic' ? 'opacity-90' : 'text-base-content/70'}>
                        {VARIANT_DESCRIPTIONS.classic}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Variante Descendante */}
              <div
                onClick={() => setSelectedVariant('descending')}
                className={`card glass cursor-pointer transition-all ${
                  selectedVariant === 'descending' 
                    ? 'bg-primary text-primary-content shadow-lg' 
                    : 'bg-base-200 hover:bg-base-300'
                }`}
              >
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="variant"
                      className="radio"
                      checked={selectedVariant === 'descending'}
                      onChange={() => setSelectedVariant('descending')}
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{VARIANT_NAMES.descending}</h4>
                      <p className={selectedVariant === 'descending' ? 'opacity-90' : 'text-base-content/70'}>
                        {VARIANT_DESCRIPTIONS.descending}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Variante Montante */}
              <div
                onClick={() => setSelectedVariant('ascending')}
                className={`card glass cursor-pointer transition-all ${
                  selectedVariant === 'ascending' 
                    ? 'bg-primary text-primary-content shadow-lg' 
                    : 'bg-base-200 hover:bg-base-300'
                }`}
              >
                <div className="card-body">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="variant"
                      className="radio"
                      checked={selectedVariant === 'ascending'}
                      onChange={() => setSelectedVariant('ascending')}
                    />
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{VARIANT_NAMES.ascending}</h4>
                      <p className={selectedVariant === 'ascending' ? 'opacity-90' : 'text-base-content/70'}>
                        {VARIANT_DESCRIPTIONS.ascending}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-action">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn"
                disabled={createLoading}
              >
                Annuler
              </button>
              <button
                onClick={handleCreateGame}
                className="btn btn-primary"
                disabled={createLoading}
              >
                {createLoading ? 'Création...' : 'Créer la partie'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
