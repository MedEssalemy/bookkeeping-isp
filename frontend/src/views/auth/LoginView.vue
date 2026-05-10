<template>
  <div class="login-page">
    <div class="login-card">

      <!-- Brand -->
      <div class="login-card__brand">
        <img src="/isp-logo.png" alt="ISP" class="login-card__logo"
          @error="logoFailed = true"
          v-if="!logoFailed"
        />
        <div v-else class="login-card__logo-fallback">ISP</div>
        <div class="login-card__app-name">Bookkeeping</div>
      </div>

      <!-- Form -->
      <form class="login-card__form" @submit.prevent="handleSubmit">

        <!-- Email -->
        <div class="field">
          <label class="field__label" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            class="field__input"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <!-- Password -->
        <div class="field">
          <label class="field__label" for="password">Password</label>
          <div class="password-wrapper">
            <input
              id="password"
              v-model="password"
              class="field__input"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              required
            />
            <!-- Show/hide toggle — spec §2 -->
            <button
              type="button"
              class="password-toggle"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <!-- Eye icon -->
              <svg v-if="!showPassword" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <!-- Eye-off icon -->
              <svg v-else width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Error message — spec §2: "Invalid credentials. Please try again." -->
        <p v-if="errorMessage" class="login-card__error" role="alert">
          {{ errorMessage }}
        </p>

        <!-- Submit -->
        <BaseButton
          type="submit"
          variant="primary"
          size="md"
          :loading="isLoading"
          style="width: 100%;"
        >
          Sign In
        </BaseButton>

      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import BaseButton from '../../components/base/BaseButton.vue'

const auth = useAuthStore()
const router = useRouter()

// ─── Form state ───────────────────────────────────────────────────────────────
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const logoFailed = ref(false)

// ─── Submit ───────────────────────────────────────────────────────────────────
async function handleSubmit() {
  errorMessage.value = ''
  isLoading.value = true

  try {
    await auth.login({ email: email.value, password: password.value })
    // On success: store has token + user, navigate to overview
    router.push({ name: 'overview' })
  } catch {
    // Any error from the API (401, 422, network) shows the spec error message
    errorMessage.value = 'Invalid credentials. Please try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* ── Page ──────────────────────────────────────────────────────────────────── */
.login-page {
  min-height: 100svh;
  background: var(--color-bg-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* ── Card ──────────────────────────────────────────────────────────────────── */
.login-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: var(--shadow-modal);
  width: 100%;
  max-width: 400px;
  padding: 36px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Brand ─────────────────────────────────────────────────────────────────── */
.login-card__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.login-card__logo {
  max-height: 48px;
  object-fit: contain;
}

.login-card__logo-fallback {
  font-size: 22px;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: 0.04em;
}

.login-card__app-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
}

/* ── Form ──────────────────────────────────────────────────────────────────── */
.login-card__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Password wrapper ──────────────────────────────────────────────────────── */
.password-wrapper {
  position: relative;
}

.password-wrapper .field__input {
  padding-right: 40px; /* room for the toggle button */
}

.password-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 4px;
  line-height: 0;
  transition: color 0.12s;
}

.password-toggle:hover {
  color: var(--color-text);
}

/* ── Error ─────────────────────────────────────────────────────────────────── */
.login-card__error {
  font-size: 13px;
  color: var(--color-error);
  text-align: center;
  margin: 0;
}
</style>