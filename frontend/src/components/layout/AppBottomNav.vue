<template>
  <nav class="bottom-nav">
    <RouterLink
      v-for="tab in primaryTabs"
      :key="tab.key"
      :to="tab.to"
      class="bottom-nav__tab"
      :active-class="tab.exact ? '' : 'is-active'"
      :exact-active-class="tab.exact ? 'is-active' : ''"
    >
      <span class="bottom-nav__icon" v-html="tab.icon" />
      <span class="bottom-nav__label">{{ tab.label }}</span>
    </RouterLink>

    <!-- More button — opens sidebar drawer -->
    <button class="bottom-nav__tab bottom-nav__tab--more" @click="emit('open-more')">
      <span class="bottom-nav__icon" v-html="moreIcon" />
      <span class="bottom-nav__label">More</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  'open-more': []
}>()

const moreIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>`

const primaryTabs = [
  {
    key: 'overview',
    label: 'Overview',
    to: '/',
    exact: true,
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  },
  {
    key: 'invoices',
    label: 'Invoices',
    to: '/invoices',
    exact: false,
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
  },
  {
    key: 'expenses',
    label: 'Expenses',
    to: '/expenses',
    exact: false,
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  },
  {
    key: 'clients',
    label: 'Clients',
    to: '/clients',
    exact: false,
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  },
]
</script>

<style scoped>
.bottom-nav {
  display: none;
}

@media (max-width: 599px) {
  .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: #0F172A;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    z-index: 38;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .bottom-nav__tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: #475569;
    text-decoration: none;
    font-size: 10px;
    font-weight: 500;
    font-family: var(--font-sans);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .bottom-nav__tab:hover,
  .bottom-nav__tab:active {
    color: #94A3B8;
  }

  .bottom-nav__tab.is-active {
    color: #60A5FA;
  }

  .bottom-nav__tab.is-active .bottom-nav__icon {
    position: relative;
  }

  .bottom-nav__tab.is-active .bottom-nav__icon::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #60A5FA;
  }

  .bottom-nav__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .bottom-nav__label {
    line-height: 1;
  }
}
</style>
