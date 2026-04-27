import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { UserRole } from '../types/auth'

// ─── Route Meta Types ─────────────────────────────────────────────────────────
// Extend Vue Router's RouteMeta so TypeScript knows about our custom fields.

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresRole?: UserRole[] // if set, only these roles can access the route
    title?: string // used by the top bar
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ── Public ──────────────────────────────────────────────────────────────
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: 'Sign In' },
    },

    // ── App Shell (authenticated) ────────────────────────────────────────────
    // AppLayout wraps the sidebar + topbar. All protected views live inside it.
    {
      path: '/',
      component: () => import('../components/layout/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'overview',
          component: () => import('../views/OverviewView.vue'),
          meta: { requiresAuth: true, title: 'Overview' },
        },
        {
          path: 'proposals',
          name: 'proposals',
          component: () => import('../views/ProposalsView.vue'),
          meta: { requiresAuth: true, title: 'Proposals' },
        },
        {
          path: 'pos',
          name: 'pos',
          component: () => import('../views/PurchaseOrdersView.vue'),
          meta: { requiresAuth: true, title: 'Purchase Orders' },
        },
        {
          path: 'invoices',
          name: 'invoices',
          component: () => import('../views/InvoicesView.vue'),
          meta: { requiresAuth: true, title: 'Invoices' },
        },
        {
          path: 'expenses',
          name: 'expenses',
          component: () => import('../views/ExpensesView.vue'),
          meta: { requiresAuth: true, title: 'Outside Expenses' },
        },
        {
          path: 'pl',
          name: 'pl',
          component: () => import('../views/PLView.vue'),
          meta: { requiresAuth: true, title: 'P&L Report' },
        },
        {
          path: 'clients',
          name: 'clients',
          component: () => import('../views/ClientsView.vue'),
          meta: { requiresAuth: true, title: 'Clients' },
        },
        {
          path: 'taxes',
          name: 'taxes',
          component: () => import('../views/TaxRatesView.vue'),
          meta: { requiresAuth: true, title: 'Tax Rates' },
        },
        {
          path: 'bookkeeping',
          name: 'bookkeeping',
          component: () => import('../views/BookkeepingView.vue'),
          meta: { requiresAuth: true, title: 'Bookkeeping' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/SettingsView.vue'),
          // Admin only — spec §3: "settings nav item only rendered for Admin role"
          meta: {
            requiresAuth: true,
            requiresRole: ['admin'],
            title: 'Configuration',
          },
        },
      ],
    },

    // ── 404 ─────────────────────────────────────────────────────────────────
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
})

// ─── Navigation Guard ─────────────────────────────────────────────────────────
//
// Runs before every navigation. Two checks in sequence:
//   1. requiresAuth  → must be authenticated, else → /login
//   2. requiresRole  → must have one of the allowed roles, else → / (overview)
//
// Spec §13: "Unauthorized route (wrong role): redirect to Overview silently"
// Spec §2:  "When the in-memory JWT is lost, redirect silently to the login page"

router.beforeEach((to) => {
  const auth = useAuthStore()

  // Check 1: authentication
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  // Check 2: role
  if (to.meta.requiresRole && auth.role) {
    const allowed = to.meta.requiresRole
    if (!allowed.includes(auth.role)) {
      // Redirect silently to overview — no error page shown (spec §15)
      return { name: 'overview' }
    }
  }

  // Redirect authenticated users away from /login
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'overview' }
  }
})

export default router
