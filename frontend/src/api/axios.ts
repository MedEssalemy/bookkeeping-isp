import axios from 'axios'

// ─── Axios Instance ───────────────────────────────────────────────────────────
// All API calls go through this instance.
// Base URL proxied by Vite in dev → Nginx in production.

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attaches the in-memory token to every outgoing request.
// The token is pulled lazily from the store so we avoid a circular import.

api.interceptors.request.use((config) => {
  // Lazy import avoids circular dependency (store imports api, api imports store)
  const token = getTokenFromStore()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Response Interceptor ─────────────────────────────────────────────────────
// 401 → token expired or invalid. Clear auth state and redirect to login.
// This fires for every API call in the app automatically.

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthAndRedirect()
    }
    return Promise.reject(error)
  }
)

// ─── Helpers (break circular dependency) ─────────────────────────────────────
// We read/clear the store by importing it inside a function, not at module level.
// This is the standard pattern for Pinia + axios in Vue 3.

function getTokenFromStore(): string | null {
  // Dynamic import to avoid circular reference at module init time
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../stores/auth')
    const store = useAuthStore()
    return store.token
  } catch {
    return null
  }
}

function clearAuthAndRedirect(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../stores/auth')
    const store = useAuthStore()
    store.logout()
    // Router redirect — use window.location to avoid importing router here
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  } catch {
    window.location.href = '/login'
  }
}
