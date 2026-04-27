<template>
  <header class="topbar">

    <!-- Left: hamburger (mobile only) + view title -->
    <div class="topbar__left">
      <!-- Hamburger — only visible on mobile (hidden by CSS on desktop) -->
      <button
        class="topbar__hamburger"
        aria-label="Open navigation"
        @click="emit('toggle-sidebar')"
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>

      <!-- View title driven by route meta — no prop needed -->
      <h1 class="topbar__title">{{ currentTitle }}</h1>
    </div>

    <!-- Right: primary action slot -->
    <!-- Views drop their "+ New X" button here via the default slot -->
    <div class="topbar__right">
      <slot />
    </div>

  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

// ─── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  'toggle-sidebar': []
}>()

// ─── Title from route meta ────────────────────────────────────────────────────
// Each route defines meta.title. No prop passing needed — the topbar reads
// the active route directly. Views don't need to know about the topbar at all.
const route = useRoute()
const currentTitle = computed(() => route.meta.title ?? '')
</script>

<style scoped>
.topbar {
  height: var(--topbar-height);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--color-bg);
  position: sticky;
  top: 0;
  z-index: 30;
  gap: 12px;
}

.topbar__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.topbar__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Hamburger: desktop hidden, mobile visible */
.topbar__hamburger {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text);
  padding: 4px;
  border-radius: 6px;
  line-height: 0;
  transition: background 0.12s;
}

.topbar__hamburger:hover {
  background: var(--color-bg-subtle);
}

/* Show hamburger on rail AND drawer breakpoints */
@media (max-width: 899px) {
  .topbar__hamburger {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

@media (max-width: 599px) {
  .topbar {
    padding: 0 16px;
  }

  /* Bottom nav handles navigation on mobile — hamburger not needed */
  .topbar__hamburger {
    display: none;
  }
}
</style>