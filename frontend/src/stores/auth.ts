import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser, LoginCredentials, UserRole } from '../types/auth'
import { loginRequest } from '../api/auth'

// ─── Auth Store ───────────────────────────────────────────────────────────────
// Single source of truth for authentication state.
//
// Rules (from spec §2):
//   - Token lives in memory only — never localStorage, never sessionStorage
//   - Page refresh = token gone = redirect to /login (correct behavior)
//   - Role is embedded in the JWT and mirrored here for UI rendering
//   - Server enforces role independently — UI hiding is cosmetic only

export const useAuthStore = defineStore('auth', () => {
  // ─── State ──────────────────────────────────────────────────────────────────
  const token = ref<string | null>(null)
  const user = ref<AuthUser | null>(null)

  // ─── Getters ────────────────────────────────────────────────────────────────
  const isAuthenticated = computed(
    () => token.value !== null && user.value !== null,
  )

  const role = computed<UserRole | null>(() => user.value?.role ?? null)

  // Role helpers — used by components to conditionally render UI
  const isAdmin = computed(() => role.value === 'admin')
  const canEdit = computed(
    () => role.value === 'admin' || role.value === 'editor',
  )
  const canDelete = computed(
    () => role.value === 'admin' || role.value === 'editor',
  )

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Calls the login endpoint, stores token + user on success.
   * Throws on failure so the LoginView can catch and display the error.
   */

  async function login(credentials: LoginCredentials): Promise<void> {
    const data = await loginRequest(credentials)
    token.value = data.access_token
    user.value = data.user
  }

  /**
   * Clears all auth state.
   * Called on sign-out button click AND by the axios 401 interceptor.
   */
  function logout(): void {
    token.value = null
    user.value = null
  }

  return {
    // State (expose as readonly from outside)
    token,
    user,
    // Getters
    isAuthenticated,
    role,
    isAdmin,
    canEdit,
    canDelete,
    // Actions
    login,
    logout,
  }
})
