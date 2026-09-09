// ─── Auth Types ───────────────────────────────────────────────────────────────
// Mirrors the JWT payload and API response shapes from the backend.
// Role values must match the backend enum exactly.

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: UserRole
}

// Shape returned by POST /api/v1/auth/login
export interface LoginResponse {
  access_token: string
  user: AuthUser
}

// Shape sent to POST /api/v1/auth/login
export interface LoginCredentials {
  email: string
  password: string
}
