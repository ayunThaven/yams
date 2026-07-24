'use client';

import { ThemeProvider } from "next-themes"
import { createContext, useCallback, useContext, useEffect, useState, useMemo } from "react"
import { UserProfile } from "@/types/user"
import { createClient } from "@/lib/supabase/browser"
import { SupabaseClient } from "@supabase/supabase-js"

type AuthUser = {
  id: string
  email?: string
}

type SupabaseContextType = {
  user: AuthUser | null
  userProfile: UserProfile | null
  isLoading: boolean
  refreshUserProfile: () => Promise<void>
  supabase: SupabaseClient
}

const AUTH_ME_CACHE_KEY = 'yams_auth_me_cache'
const AUTH_ME_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined)

export function useSupabase() {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider')
  }
  return context
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Créer le client Supabase une seule fois
  const supabase = useMemo(() => createClient(), [])

  const readCachedAuthAndProfile = () => {
    if (typeof window === 'undefined') return null

    try {
      const raw = window.localStorage.getItem(AUTH_ME_CACHE_KEY)
      if (!raw) return null

      const parsed = JSON.parse(raw) as {
        user: AuthUser | null
        profile: UserProfile | null
        expiresAt: number
      }

      if (!parsed || typeof parsed.expiresAt !== 'number') return null
      if (parsed.expiresAt <= Date.now()) {
        window.localStorage.removeItem(AUTH_ME_CACHE_KEY)
        return null
      }

      return { user: parsed.user, profile: parsed.profile }
    } catch {
      return null
    }
  }

  const writeCachedAuthAndProfile = useCallback((nextUser: AuthUser | null, nextProfile: UserProfile | null) => {
    if (typeof window === 'undefined') return

    try {
      const payload = {
        user: nextUser,
        profile: nextProfile,
        expiresAt: Date.now() + AUTH_ME_CACHE_TTL_MS,
      }
      window.localStorage.setItem(AUTH_ME_CACHE_KEY, JSON.stringify(payload))
    } catch {
      // En cas d'erreur de stockage, on ignore silencieusement.
    }
  }, [])

  const fetchAuthAndProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (!res.ok) {
        setUser(null)
        setUserProfile(null)
        writeCachedAuthAndProfile(null, null)
        return
      }
      const data = await res.json()
      setUser(data.user)
      setUserProfile(data.profile)
      writeCachedAuthAndProfile(data.user, data.profile)
    } catch (error) {
      console.error('Erreur récupération auth/me:', error)
      setUser(null)
      setUserProfile(null)
      writeCachedAuthAndProfile(null, null)
    }
  }, [writeCachedAuthAndProfile])

  const refreshUserProfile = useCallback(async () => {
    await fetchAuthAndProfile()
  }, [fetchAuthAndProfile])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setIsLoading(true)

      // 1) On tente d'utiliser le cache local pour afficher vite quelque chose.
      const cached = readCachedAuthAndProfile()
      if (cached && !cancelled) {
        setUser(cached.user)
        setUserProfile(cached.profile)
      }

      // 2) On revalide toujours en arrière-plan pour être sûr d'avoir un état frais.
      await fetchAuthAndProfile()

      if (!cancelled) {
        setIsLoading(false)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [fetchAuthAndProfile])

  return (
    <SupabaseContext.Provider value={{ user, userProfile, isLoading, refreshUserProfile, supabase }}>
      <ThemeProvider 
        attribute="data-theme" 
        defaultTheme="yams" 
        themes={["yams", "yams-dark"]}
        enableSystem={false}
        enableColorScheme={false}
      >
        {children}
      </ThemeProvider>
    </SupabaseContext.Provider>
  )
}
