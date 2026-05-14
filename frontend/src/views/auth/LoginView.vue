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

      <!-- Sign-in form -->
      <form
        v-if="view === 'login'"
        class="login-card__form"
        @submit.prevent="handleSubmit"
      >

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
          <div class="field__label-row">
            <label class="field__label" for="password">Password</label>
            <button
              type="button"
              class="login-card__link login-card__link--inline"
              @click="goToForgot"
            >Forgot password?</button>
          </div>
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

      <!-- Forgot-password form (UI only — backend wiring is a TODO). -->
      <form
        v-else-if="view === 'forgot'"
        class="login-card__form"
        @submit.prevent="handleForgotSubmit"
      >
        <p class="login-card__intro">
          Enter the email tied to your account and we'll send you a link to reset
          your password.
        </p>

        <div class="field">
          <label class="field__label" for="forgot-email">Email</label>
          <input
            id="forgot-email"
            v-model="forgotEmail"
            class="field__input"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            required
            autofocus
          />
        </div>

        <BaseButton
          type="submit"
          variant="primary"
          size="md"
          :loading="forgotLoading"
          style="width: 100%;"
        >
          Send reset link
        </BaseButton>

        <button
          type="button"
          class="login-card__link login-card__link--center"
          @click="backToLogin"
        >
          ← Back to sign in
        </button>
      </form>

      <!-- Forgot-password confirmation -->
      <div v-else-if="view === 'forgot-sent'" class="login-card__form">
        <div class="login-card__success">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <p class="login-card__success-title">Check your inbox</p>
          <p class="login-card__success-body">
            If an account exists for <strong>{{ forgotEmail }}</strong>, you'll
            receive a password-reset email shortly. The link will expire in 30 minutes.
          </p>
        </div>

        <button
          type="button"
          class="login-card__link login-card__link--center"
          @click="backToLogin"
        >
          ← Back to sign in
        </button>
      </div>
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

// ─── View switcher ────────────────────────────────────────────────────────────
// 'login'       — credentials form (default)
// 'forgot'      — email entry for password reset
// 'forgot-sent' — confirmation after submitting forgot form
type View = 'login' | 'forgot' | 'forgot-sent'
const view = ref<View>('login')

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

// ─── Forgot-password flow (UI only) ───────────────────────────────────────────
const forgotEmail = ref('')
const forgotLoading = ref(false)

function goToForgot() {
  // Carry whatever the user typed in the sign-in email field into the forgot
  // form so they don't have to retype.
  forgotEmail.value = email.value
  errorMessage.value = ''
  view.value = 'forgot'
}

function backToLogin() {
  view.value = 'login'
}

async function handleForgotSubmit() {
  forgotLoading.value = true
  // TODO(backend): POST /auth/forgot-password { email }. We always show the
  // same confirmation regardless of whether the email exists — this matches
  // the security-best-practice pattern (don't leak account enumeration).
  await new Promise((resolve) => setTimeout(resolve, 400))
  forgotLoading.value = false
  view.value = 'forgot-sent'
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

/* ── Forgot-password link + view ──────────────────────────────────────────── */
.field__label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.login-card__link {
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: none;
  transition: color 0.1s;
}

.login-card__link:hover {
  text-decoration: underline;
}

.login-card__link--inline {
  font-size: 12px;
}

.login-card__link--center {
  align-self: center;
  font-size: 13px;
  margin-top: 4px;
}

.login-card__intro {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
}

.login-card__success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 8px 0;
  color: var(--color-primary);
}

.login-card__success-title {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
}

.login-card__success-body {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.5;
}
</style>