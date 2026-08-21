/**
 * Client API avec gestion automatique des tokens
 */
"use client";

import { tokenManager } from './tokenManager'
import { logger } from './logger'

/**
 * Effectue une requête API avec le token d'authentification
 */
export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    if (!tokenManager.isTokenValid()) {
      tokenManager.clearTokens()
      return {
        data: null,
        error: 'Session expirée. Veuillez vous reconnecter.',
      }
    }

    // Ajoute les headers d'authentification
    const headers = {
      ...tokenManager.getAuthHeaders(),
      ...options.headers,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Erreur API:', response.status, errorText)
      
      if (response.status === 401) {
        tokenManager.clearTokens()
        return {
          data: null,
          error: 'Session expirée. Veuillez vous reconnecter.',
        }
      }

      return {
        data: null,
        error: `Erreur ${response.status}: ${errorText}`,
      }
    }

    const data = await response.json()
    return { data, error: null }
  } catch (error) {
    logger.error('Erreur lors de la requête:', error)
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

/**
 * Raccourcis pour les méthodes HTTP courantes
 */
export const api = {
  get: <T = unknown>(url: string, options?: RequestInit) =>
    apiRequest<T>(url, { ...options, method: 'GET' }),

  post: <T = unknown>(url: string, body?: unknown, options?: RequestInit) =>
    apiRequest<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(url: string, body?: unknown, options?: RequestInit) =>
    apiRequest<T>(url, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(url: string, options?: RequestInit) =>
    apiRequest<T>(url, { ...options, method: 'DELETE' }),

  patch: <T = unknown>(url: string, body?: unknown, options?: RequestInit) =>
    apiRequest<T>(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
}
