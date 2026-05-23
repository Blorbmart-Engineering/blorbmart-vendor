import { auth } from './firebase'

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

export const apiFetchAuth = async (path: string, options: RequestInit = {}) => {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Missing authenticated user')
  }

  const token = await user.getIdToken()
  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${token}`)

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(apiUrl(path), {
    ...options,
    headers,
  })
}
