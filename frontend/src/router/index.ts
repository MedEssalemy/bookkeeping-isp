import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { UserRole } from '../types/auth'
import type { DocDirection } from '../types/common'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresRole?: UserRole[]
    title?: string
    /** Direction-scoped list routes carry the side they show (spec §2). */
    direction?: DocDirection
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
        // ── Proposals (direction-scoped lists; static before :id) ────────────
        {
          path: 'proposals',
          name: 'proposals',
          redirect: { name: 'proposals-issued' },
        },
        {
          path: 'proposals/issued',
          name: 'proposals-issued',
          component: () => import('../views/proposals/ProposalsListView.vue'),
          meta: { requiresAuth: true, title: 'Proposals', direction: 'issued' },
        },
        {
          path: 'proposals/received',
          name: 'proposals-received',
          component: () => import('../views/proposals/ProposalsListView.vue'),
          meta: { requiresAuth: true, title: 'Proposals', direction: 'received' },
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

        // ── Purchase Orders (direction-scoped; module lands Phase 5) ─────────
        {
          path: 'pos',
          name: 'pos',
          redirect: { name: 'pos-received' },
        },
        {
          path: 'pos/received',
          name: 'pos-received',
          component: () => import('../views/purchase-orders/PurchaseOrdersListView.vue'),
          meta: { requiresAuth: true, title: 'Purchase Orders', direction: 'received' },
        },
        {
          path: 'pos/issued',
          name: 'pos-issued',
          component: () => import('../views/purchase-orders/PurchaseOrdersListView.vue'),
          meta: { requiresAuth: true, title: 'Purchase Orders', direction: 'issued' },
        },
        {
          path: 'pos/new',
          name: 'po-new',
          component: () => import('../views/purchase-orders/PurchaseOrderFormView.vue'),
          meta: { requiresAuth: true, requiresRole: ['admin', 'editor'], title: 'New Purchase Order' },
        },
        {
          path: 'pos/:id/edit',
          name: 'po-edit',
          component: () => import('../views/purchase-orders/PurchaseOrderFormView.vue'),
          meta: { requiresAuth: true, requiresRole: ['admin', 'editor'], title: 'Edit Purchase Order' },
        },
        {
          path: 'pos/:id',
          name: 'po-detail',
          component: () => import('../views/purchase-orders/PurchaseOrderDetailView.vue'),
          meta: { requiresAuth: true, title: 'Purchase Order' },
        },

        // ── Invoices (direction-scoped; module lands Phase 6) ────────────────
        {
          path: 'invoices',
          name: 'invoices',
          redirect: { name: 'invoices-issued' },
        },
        {
          path: 'invoices/issued',
          name: 'invoices-issued',
          component: () => import('../views/invoices/InvoicesListView.vue'),
          meta: { requiresAuth: true, title: 'Invoices', direction: 'issued' },
        },
        {
          path: 'invoices/received',
          name: 'invoices-received',
          component: () => import('../views/invoices/InvoicesListView.vue'),
          meta: { requiresAuth: true, title: 'Invoices', direction: 'received' },
        },
        {
          path: 'invoices/new',
          name: 'invoice-new',
          component: () => import('../views/invoices/InvoiceFormView.vue'),
          meta: { requiresAuth: true, requiresRole: ['admin', 'editor'], title: 'New Invoice' },
        },
        {
          path: 'invoices/:id/edit',
          name: 'invoice-edit',
          component: () => import('../views/invoices/InvoiceFormView.vue'),
          meta: { requiresAuth: true, requiresRole: ['admin', 'editor'], title: 'Edit Invoice' },
        },
        {
          path: 'invoices/:id',
          name: 'invoice-detail',
          component: () => import('../views/invoices/InvoiceDetailView.vue'),
          meta: { requiresAuth: true, title: 'Invoice' },
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
          path: 'contractors',
          name: 'contractors',
          component: () => import('../views/contractors/ContractorsListView.vue'),
          meta: { requiresAuth: true, title: 'Contractors' },
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
