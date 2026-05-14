import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { UserRole } from '../types/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresRole?: UserRole[]
    title?: string
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // ── Public ──────────────────────────────────────────────────────────────
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/auth/LoginView.vue'),
      meta: { title: 'Sign In' },
    },

    // ── App Shell (authenticated) ────────────────────────────────────────────
    {
      path: '/',
      component: () => import('../components/layout/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'overview',
          component: () => import('../views/overview/OverviewView.vue'),
          meta: { requiresAuth: true, title: 'Overview' },
        },
        {
          path: 'proposals',
          name: 'proposals',
          component: () => import('../views/proposals/ProposalsListView.vue'),
          meta: { requiresAuth: true, title: 'Proposals' },
        },
        {
          path: 'proposals/new',
          name: 'proposal-new',
          component: () => import('../views/proposals/ProposalFormView.vue'),
          meta: { requiresAuth: true, requiresRole: ['admin', 'editor'], title: 'New Proposal' },
        },
        {
          path: 'proposals/:id/edit',
          name: 'proposal-edit',
          component: () => import('../views/proposals/ProposalFormView.vue'),
          meta: { requiresAuth: true, requiresRole: ['admin', 'editor'], title: 'Edit Proposal' },
        },
        {
          path: 'proposals/:id',
          name: 'proposal-detail',
          component: () => import('../views/proposals/ProposalDetailView.vue'),
          meta: { requiresAuth: true, title: 'Proposal' },
        },
        {
          path: 'pos',
          name: 'pos',
          component: () => import('../views/purchase-orders/PurchaseOrdersListView.vue'),
          meta: { requiresAuth: true, title: 'Purchase Orders' },
        },
        {
          path: 'invoices',
          name: 'invoices',
          component: () => import('../views/invoices/InvoicesListView.vue'),
          meta: { requiresAuth: true, title: 'Invoices' },
        },
        {
          path: 'expenses',
          name: 'expenses',
          component: () => import('../views/expenses/ExpensesListView.vue'),
          meta: { requiresAuth: true, title: 'Expenses' },
        },
        {
          path: 'pl',
          name: 'pl',
          component: () => import('../views/pl/PLView.vue'),
          meta: { requiresAuth: true, title: 'P&L Report' },
        },
        {
          path: 'clients',
          name: 'clients',
          component: () => import('../views/clients/ClientsListView.vue'),
          meta: { requiresAuth: true, title: 'Clients' },
        },
        {
          path: 'clients/:business',
          name: 'client-detail',
          component: () => import('../views/clients/ClientDetailView.vue'),
          meta: { requiresAuth: true, title: 'Client' },
        },
        {
          path: 'taxes',
          name: 'taxes',
          component: () => import('../views/tax-rates/TaxRatesListView.vue'),
          meta: { requiresAuth: true, title: 'Tax Rates' },
        },
        {
          path: 'bookkeeping',
          name: 'bookkeeping',
          component: () => import('../views/bookkeeping/BookkeepingView.vue'),
          meta: { requiresAuth: true, title: 'Bookkeeping' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/settings/SettingsView.vue'),
          meta: {
            requiresAuth: true,
            requiresRole: ['admin'],
            title: 'Configuration',
          },
        },
        // ── Dev only: styleguide ─────────────────────────────────────────────
        ...(import.meta.env.DEV
          ? [{
              path: 'styleguide',
              name: 'styleguide',
              component: () => import('../views/StyleguideView.vue'),
              meta: { requiresAuth: true, title: 'Styleguide' },
            }]
          : []),
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

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.meta.requiresRole && auth.role) {
    const allowed = to.meta.requiresRole
    if (!allowed.includes(auth.role)) {
      return { name: 'overview' }
    }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'overview' }
  }
})

export default router
