<template>
  <button
    :class="['btn', `btn--${variant}`, `btn--${size}`, { 'btn--loading': loading }]"
    :disabled="disabled || loading"
    :type="type"
    v-bind="$attrs"
  >
    <!-- Loading spinner -->
    <svg
      v-if="loading"
      class="btn__spinner"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>

    <!-- Leading icon slot -->
    <span v-if="$slots.icon && !loading" class="btn__icon">
      <slot name="icon" />
    </span>

    <!-- Label -->
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'purple'
  size?: 'sm' | 'md'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
})
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: 6px;
  font-family: var(--font-sans);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s, box-shadow 0.15s;
  text-decoration: none;
  white-space: nowrap;
  letter-spacing: 0.01em;
  line-height: 1;
}

/* ── Sizes ─────────────────────────────────────────────────────────────────── */
.btn--md { padding: 8px 14px; font-size: 14px; }
.btn--sm { padding: 5px 10px; font-size: 13px; }

/* ── Variants ──────────────────────────────────────────────────────────────── */
.btn--primary   { background: var(--color-primary);  color: #fff; }
.btn--success   { background: var(--color-success);  color: #fff; }
.btn--danger    { background: var(--color-error);    color: #fff; }
.btn--purple    { background: #7C3AED;               color: #fff; }

.btn--primary:hover  { background: var(--color-primary-hover); }
.btn--success:hover  { opacity: 0.88; }
.btn--danger:hover   { opacity: 0.88; }
.btn--purple:hover   { opacity: 0.88; }

.btn--secondary {
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
.btn--secondary:hover { background: var(--color-bg-subtle); }

.btn--ghost {
  background: transparent;
  color: var(--color-text-muted);
}
.btn--ghost:hover {
  color: var(--color-text);
  background: var(--color-bg-subtle);
}

/* ── States ────────────────────────────────────────────────────────────────── */
.btn:disabled,
.btn--loading {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

/* ── Icon / Spinner ────────────────────────────────────────────────────────── */
.btn__icon {
  display: flex;
  align-items: center;
  line-height: 0;
}

.btn__spinner {
  width: 14px;
  height: 14px;
  animation: btn-spin 0.75s linear infinite;
  flex-shrink: 0;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
</style>