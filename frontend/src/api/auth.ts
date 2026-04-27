import { api } from './axios'
import type { LoginCredentials, LoginResponse } from '../types/auth'

// ─── Auth API ─────────────────────────────────────────────────────────────────
// Raw API calls only. No state, no side effects — that's the store's job.

export async function loginRequest(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', credentials)
  return response.data
}
