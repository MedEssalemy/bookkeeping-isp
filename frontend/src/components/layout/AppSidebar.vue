<template>
  <aside class="sidebar">

    <!-- Brand block -->
    <div class="sidebar__logo-block">
      <!-- Top row: icon + app name -->
      <div class="sidebar__brand-row">
        <img src="/small-logo.png" alt="ISP" class="sidebar__favicon" />
        <span class="sidebar__app-name">Bookkeeping</span>
      </div>
      <!-- Tagline -->
      <div class="sidebar__tagline">Financial management &amp; reporting</div>
    </div>

    <!-- Navigation -->
    <nav class="sidebar__nav">
      <template v-for="group in visibleNavGroups" :key="group.label ?? 'root'">

        <!-- Section label -->
        <div v-if="group.label" class="sidebar__section-label">
          {{ group.label }}
        </div>

        <!-- Nav items -->
        <RouterLink
          v-for="item in group.items"
          :key="item.key"
          :to="item.to"
          class="sidebar__nav-item"
          :active-class="item.exact ? '' : 'is-active'"
          :exact-active-class="item.exact ? 'is-active' : ''"
          @click="emit('navigate')"
        >
          <span class="sidebar__nav-item-inner">
            <span class="nav-icon" v-html="item.icon" />
            <span>{{ item.label }}</span>
          </span>

          <span v-if="item.badge && item.badge > 0" class="nav-badge">
            {{ item.badge }}
          </span>
        </RouterLink>

      </template>
    </nav>

    <!-- Footer: profile widget -->
    <div class="sidebar__footer" ref="footerRef">

      <!-- Profile button — click to toggle menu -->
      <button class="sidebar__profile-btn" @click="menuOpen = !menuOpen" :aria-expanded="menuOpen">
        <div class="sidebar__avatar">{{ userInitials }}</div>
        <div class="sidebar__user-info">
          <div class="sidebar__user-name">{{ auth.user?.full_name }}</div>
          <div class="sidebar__user-role">{{ roleLabel }}</div>
        </div>
        <!-- Chevron -->
        <svg class="sidebar__chevron" :class="{ 'is-open': menuOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>

      <!-- Popup menu -->
      <Transition name="menu">
        <div v-if="menuOpen" class="sidebar__menu">
          <div class="sidebar__menu-item sidebar__menu-item--danger" @click="handleSignOut">
            <!-- Logout icon -->
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </div>
        </div>
      </Transition>

    </div>

  </aside>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const emit = defineEmits<{
  navigate: []
}>()

const auth = useAuthStore()
const router = useRouter()

const menuOpen = ref(false)
const footerRef = ref<HTMLElement | null>(null)

function handleClickOutside(e: MouseEvent) {
  if (footerRef.value && !footerRef.value.contains(e.target as Node)) {
    menuOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))

const userInitials = computed(() => {
  const name = auth.user?.full_name ?? ''
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const roleLabel = computed(() => {
  const map: Record<string, string> = {
    admin: 'Admin',
    editor: 'Editor',
    viewer: 'View Only',
  }
  return map[auth.role ?? ''] ?? ''
})

function handleSignOut() {
  menuOpen.value = false
  auth.logout()
  router.push('/login')
}

const icons = {
  overview:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  clients:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  proposals:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  pos:          `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  invoices:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
  expenses:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  taxes:        `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14l6-6"/><circle cx="9.5" cy="8.5" r="1"/><circle cx="14.5" cy="13.5" r="1"/><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/></svg>`,
  bookkeeping:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  pl:           `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13.5 9 7.5l4 4L21 6M3 20h18"/></svg>`,
  settings:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>`,
}

interface NavItem {
  key: string
  label: string
  to: string
  icon: string
  badge?: number
  adminOnly?: boolean
  exact?: boolean
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { key: 'overview',     label: 'Overview',          to: '/',              icon: icons.overview,     exact: true },
    ],
  },
  {
    label: 'Inputs',
    items: [
      { key: 'proposals',    label: 'Proposals',         to: '/proposals',     icon: icons.proposals },
      { key: 'pos',          label: 'Purchase Orders',   to: '/pos',           icon: icons.pos },
      { key: 'invoices',     label: 'Invoices',          to: '/invoices',      icon: icons.invoices },
      { key: 'expenses',     label: 'Expenses',          to: '/expenses',      icon: icons.expenses },
    ],
  },
  {
    label: 'Reports',
    items: [
      { key: 'bookkeeping',  label: 'Bookkeeping',       to: '/bookkeeping',   icon: icons.bookkeeping },
      { key: 'pl',           label: 'P&L Report',        to: '/pl',            icon: icons.pl },
    ],
  },
  {
    label: 'Settings',
    items: [
      { key: 'clients',      label: 'Clients',           to: '/clients',       icon: icons.clients },
      { key: 'settings',     label: 'Configuration',     to: '/settings',      icon: icons.settings, adminOnly: true },
    ],
  },
]

const visibleNavGroups = computed<NavGroup[]>(() =>
  NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.adminOnly && !auth.isAdmin) return false
      return true
    }),
  })).filter(group => group.items.length > 0)
)
</script>

<style scoped>
/* ── Shell ──────────────────────────────────────────────────────────────────── */
.sidebar {
  width: var(--sidebar-width);
  height: 100svh;
  background: #0F172A;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 40;
  overflow: hidden;             /* shell never scrolls — only __nav does */
  transition: transform 0.25s, width 0.25s;
}

/* ── Brand block ───────────────────────────────────────────────────────────── */
.sidebar__logo-block {
  padding: 20px 18px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  overflow: hidden;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar__brand-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  overflow: hidden;
}

.sidebar__favicon {
  width: 36px;
  height: 36px;
  object-fit: contain;
  background: #ffffff;
  padding: 6px;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  flex-shrink: 0;
}

.sidebar__app-name {
  font-size: 17px;
  font-weight: 800;
  color: #F8FAFC;
  letter-spacing: -0.02em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.sidebar__tagline {
  font-size: 11px;
  color: #64748B;
  line-height: 1.4;
  white-space: normal;
  overflow: hidden;
}

/* ── Custom scrollbar (nav area) ──────────────────────────────────────────── */
.sidebar__nav {
  scrollbar-width: thin;
  scrollbar-color: #1E293B transparent;
}

.sidebar__nav::-webkit-scrollbar {
  width: 4px;
}

.sidebar__nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar__nav::-webkit-scrollbar-thumb {
  background: #1E293B;
  border-radius: 99px;
}

.sidebar__nav:hover::-webkit-scrollbar-thumb {
  background: #334155;
}

/* ── Navigation ────────────────────────────────────────────────────────────── */
.sidebar__nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 12px 10px;
  overflow-y: auto;
}

.sidebar__section-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #334155;
  padding: 14px 12px 5px;
}

.sidebar__nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #94A3B8;
  text-decoration: none;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: color 0.1s, background 0.1s;
  user-select: none;
}

.sidebar__nav-item:hover {
  color: #E2E8F0;
}

.sidebar__nav-item.is-active {
  background: #1E293B;
  color: #F8FAFC;
  font-weight: 600;
  border-left-color: #2563EB;
}

.sidebar__nav-item-inner {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  line-height: 0;
  opacity: 0.8;
}

.nav-badge {
  margin-left: auto;
  background: #DC2626;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 9999px;
  padding: 1px 6px;
  min-width: 18px;
  text-align: center;
}

/* ── Footer ────────────────────────────────────────────────────────────────── */
.sidebar__footer {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 10px 10px;
  flex-shrink: 0;
  position: relative;
}

/* Profile button */
.sidebar__profile-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px;
  border-radius: 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  text-align: left;
  transition: background 0.12s;
  min-width: 0;
}

.sidebar__profile-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

.sidebar__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #1D4ED8;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  letter-spacing: 0.04em;
}

.sidebar__user-info {
  flex: 1;
  min-width: 0;
}

.sidebar__user-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #E2E8F0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.sidebar__user-role {
  font-size: 11px;
  color: #64748B;
}

.sidebar__chevron {
  color: #475569;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.sidebar__chevron.is-open {
  transform: rotate(180deg);
}

/* Popup menu — floats above the footer */
.sidebar__menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 10px;
  right: 10px;
  background: #1E293B;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 4px;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.4);
  z-index: 50;
}

.sidebar__menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.1s;
  color: #94A3B8;
}

.sidebar__menu-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #E2E8F0;
}

.sidebar__menu-item--danger {
  color: #F87171;
}

.sidebar__menu-item--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #FCA5A5;
}

/* Menu transition */
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.sidebar__copyright {
  font-size: 10.5px;
  color: #334155;
  line-height: 1.4;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Rail (600–899px): icon-only strip, always visible, 56px wide
   ───────────────────────────────────────────────────────────────────────────── */
@media (max-width: 899px) {
  .sidebar {
    width: var(--sidebar-rail-width);
  }

  .sidebar__app-name,
  .sidebar__tagline,
  .sidebar__section-label,
  .sidebar__user-info,
  .sidebar__chevron,
  .sidebar__copyright {
    display: none;
  }

  .sidebar__logo-block {
    padding: 12px 0;
    display: flex;
    justify-content: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sidebar__brand-row { margin-bottom: 0; }

  .sidebar__favicon {
    width: 30px;
    height: 30px;
    padding: 4px;
  }

  .sidebar__nav {
    padding: 8px 6px;
  }

  .sidebar__nav-item {
    padding: 9px 0;
    justify-content: center;
    border-left: none;
    position: relative;
  }

  .sidebar__nav-item.is-active {
    border-left: none;
  }

  .sidebar__nav-item.is-active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 20px;
    background: #2563EB;
    border-radius: 0 2px 2px 0;
  }

  .sidebar__nav-item-inner { gap: 0; }

  .nav-icon { opacity: 1; }

  .sidebar__footer {
    padding: 10px 0;
    align-items: center;
  }

  .sidebar__user { justify-content: center; }

  .nav-badge {
    position: absolute;
    top: 3px;
    right: 3px;
    margin-left: 0;
    font-size: 9px;
    padding: 1px 4px;
    min-width: 14px;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Rail expanded (hamburger open at 600–899px): full sidebar slides over rail
   ───────────────────────────────────────────────────────────────────────────── */
@media (min-width: 600px) and (max-width: 899px) {
  .sidebar.is-open {
    width: var(--sidebar-width);
    box-shadow: 4px 0 32px rgba(0, 0, 0, 0.5);
    z-index: 41;
  }

  .sidebar.is-open .sidebar__app-name,
  .sidebar.is-open .sidebar__tagline,
  .sidebar.is-open .sidebar__section-label,
  .sidebar.is-open .sidebar__user-info,
  .sidebar.is-open .sidebar__chevron,
  .sidebar.is-open .sidebar__copyright {
    display: revert;
  }

  .sidebar.is-open .sidebar__logo-block {
    padding: 20px 18px 16px;
    justify-content: flex-start;
  }

  .sidebar.is-open .sidebar__brand-row { margin-bottom: 0; }

  .sidebar.is-open .sidebar__favicon {
    width: 36px;
    height: 36px;
    padding: 6px;
  }

  .sidebar.is-open .sidebar__nav { padding: 12px 10px; }

  .sidebar.is-open .sidebar__nav-item {
    padding: 8px 12px;
    justify-content: space-between;
    border-left: 2px solid transparent;
    position: static;
  }

  .sidebar.is-open .sidebar__nav-item.is-active {
    border-left-color: #2563EB;
  }

  .sidebar.is-open .sidebar__nav-item.is-active::before { display: none; }

  .sidebar.is-open .sidebar__nav-item-inner { gap: 10px; }

  .sidebar.is-open .sidebar__footer {
    padding: 12px 14px;
    align-items: flex-start;
  }

  .sidebar.is-open .sidebar__user { justify-content: flex-start; }

  .sidebar.is-open .nav-badge {
    position: static;
    margin-left: auto;
    font-size: 10px;
    padding: 1px 6px;
    min-width: 18px;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Drawer (< 600px): off-canvas, slides in from bottom nav "More" tap
   ───────────────────────────────────────────────────────────────────────────── */
@media (max-width: 599px) {
  .sidebar {
    width: var(--sidebar-width);
    transform: translateX(-100%);
    /* Slide in from the left over the bottom nav */
    padding-bottom: calc(60px + env(safe-area-inset-bottom));
  }

  .sidebar.is-open {
    transform: translateX(0);
    box-shadow: 4px 0 32px rgba(0, 0, 0, 0.5);
  }

  /* Restore everything hidden by the rail rules */
  .sidebar__app-name,
  .sidebar__tagline,
  .sidebar__section-label,
  .sidebar__user-info,
  .sidebar__chevron,
  .sidebar__copyright {
    display: revert;
  }

  .sidebar__logo-block {
    padding: 20px 18px 16px;
    justify-content: flex-start;
  }

  .sidebar__brand-row { margin-bottom: 0; }

  .sidebar__favicon {
    width: 36px;
    height: 36px;
    padding: 6px;
  }

  .sidebar__nav { padding: 12px 10px; }

  .sidebar__nav-item {
    padding: 8px 12px;
    justify-content: space-between;
    border-left: 2px solid transparent;
    position: static;
  }

  .sidebar__nav-item.is-active { border-left-color: #2563EB; }

  .sidebar__nav-item.is-active::before { display: none; }

  .sidebar__nav-item-inner { gap: 10px; }

  .sidebar__footer {
    padding: 12px 14px;
    align-items: flex-start;
  }

  .sidebar__user { justify-content: flex-start; }

  .nav-badge {
    position: static;
    margin-left: auto;
    font-size: 10px;
    padding: 1px 6px;
    min-width: 18px;
  }
}
</style>
