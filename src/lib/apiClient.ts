'use client'

import { logger } from './logger'

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message = typeof data?.error === 'string' ? data.error : `Erreur ${response.status}`
      logger.error('Erreur API:', response.status, message)
      return { data: null, error: message }
    }

    return { data: data as T, error: null }
  } catch (error) {
    logger.error('Erreur lors de la requête:', error)
    return { data: null, error: error instanceof Error ? error.message : 'Erreur inconnue' }
  }
}

export const api = {
  get: <T = unknown>(url: string, options?: RequestInit) => apiRequest<T>(url, { ...options, method: 'GET' }),
  post: <T = unknown>(url: string, body?: unknown, options?: RequestInit) => apiRequest<T>(url, { ...options, method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T = unknown>(url: string, body?: unknown, options?: RequestInit) => apiRequest<T>(url, { ...options, method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T = unknown>(url: string, body?: unknown, options?: RequestInit) => apiRequest<T>(url, { ...options, method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T = unknown>(url: string, options?: RequestInit) => apiRequest<T>(url, { ...options, method: 'DELETE' }),
}
