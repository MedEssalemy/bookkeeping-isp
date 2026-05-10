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

// Lazy store access — deferred to avoid circular dependency at module init time.
// We import the store only when the interceptor actually fires.
let _authStore: ReturnType<typeof import('../stores/auth').useAuthStore> | null = null

async function getAuthStore() {
  if (!_authStore) {
    const { useAuthStore } = await import('../stores/auth')
    _authStore = useAuthStore()
  }
  return _authStore
}

function getTokenFromStore(): string | null {
  try {
    // Synchronous access — store must already be initialized by the time any request fires
    // (Pinia is installed before the first navigation guard runs)
    if (_authStore) return _authStore.token
    // Kick off lazy init for next request; return null this time
    getAuthStore()
    return null
  } catch {
    return null
  }
}

function clearAuthAndRedirect(): void {
  try {
    if (_authStore) {
      _authStore.logout()
    }
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  } catch {
    window.location.href = '/login'
  }
}

// Pre-warm the store reference as soon as the module loads
getAuthStore().catch(() => {})
