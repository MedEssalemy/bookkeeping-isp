<template>
  <div class="inv-detail">
    <!-- Header -->
    <div class="inv-detail__header">
      <div class="inv-detail__header-left">
        <button class="btn btn--ghost btn--sm" @click="goBack">← Back</button>
        <h1 class="inv-detail__title">{{ invoice?.number ?? '…' }}</h1>
        <StatusPopover
          v-if="invoice"
          :status="invoice.status"
          :options="statusOptions"
          :variantMap="INVOICE_STATUS_VARIANTS"
          @change="onStatusChange"
        />
        <StatusBadge v-if="isOverdue" label="Overdue" variant="red" />
      </div>
      <div v-if="invoice" class="inv-detail__header-actions">
        <button v-if="auth.canEdit" class="btn btn--secondary btn--sm" @click="router.push({ name: 'invoice-edit', params: { id: invoice.id } })">Edit</button>
        <button v-if="auth.canEdit && invoice.direction === 'issued'" class="btn btn--secondary btn--sm" @click="handleGenerateDoc">Generate Document</button>
        <button v-if="auth.canEdit && invoice.direction === 'issued'" class="btn btn--secondary btn--sm" @click="showPreview = true">Preview Document</button>
        <button v-if="auth.canEdit && invoice.status !== 'Paid'" class="btn btn--secondary btn--sm" @click="showMarkPaidModal = true">Mark Paid</button>
        <button v-if="auth.canEdit" class="btn btn--secondary btn--sm inv-detail__delete" @click="showDeleteModal = true">Delete</button>
      </div>
    </div>

    <div v-if="isLoading" class="inv-detail__loading">
      <div v-for="i in 4" :key="i" class="skeleton" style="height:80px;border-radius:8px" />
    </div>

    <div v-else-if="isError || !invoice" class="inv-detail__error">Invoice not found or failed to load.</div>

    <template v-else>
      <!-- Header section -->
      <div class="inv-detail__section card card--padded">
        <h2 class="inv-detail__section-title">Header</h2>
        <div class="inv-detail__grid">
          <DetailField label="Date" :value="formatDate(invoice.date)" />
          <DetailField label="Invoice #" :value="invoice.number" />
          <DetailField label="Status" :value="invoice.status" />
          <DetailField :label="`${counterpartyLabel} Name`" :value="invoice.client_name" />
          <DetailField label="Address" :value="invoice.address" />
          <DetailField label="Project No." :value="invoice.project_no" />
          <DetailField label="Agreement No." :value="invoice.agreement_no" />
          <DetailField label="Ship Date" :value="invoice.ship_date ? formatDate(invoice.ship_date) : ''" />
          <DetailField label="Payment Terms" :value="invoice.payment_terms" />
          <DetailField label="Due Date" :value="dueDateDisplay" />
        </div>
      </div>

      <!-- Linked documents -->
      <div v-if="hasLinks" class="inv-detail__section card card--padded">
        <h2 class="inv-detail__section-title">Linked Documents</h2>
        <div class="inv-detail__links">
          <router-link v-if="invoice.po_id" class="inv-detail__link" :to="{ name: 'po-detail', params: { id: invoice.po_id } }">
            <span class="inv-detail__link-kind">Purchase Order</span>
            <span class="inv-detail__link-num">{{ invoice.po_number || 'View' }}</span>
          </router-link>
          <router-link v-if="invoice.proposal_id" class="inv-detail__link" :to="{ name: 'proposal-detail', params: { id: invoice.proposal_id } }">
            <span class="inv-detail__link-kind">Proposal</span>
            <span class="inv-detail__link-num">{{ invoice.proposal_number || 'View' }}</span>
          </router-link>
          <router-link v-if="invoice.linked_client_po_id" class="inv-detail__link" :to="{ name: 'po-detail', params: { id: invoice.linked_client_po_id } }">
            <span class="inv-detail__link-kind">Client PO (engagement)</span>
            <span class="inv-detail__link-num">{{ linkedClientPoNumber || 'View' }}</span>
          </router-link>
          <router-link v-if="invoice.linked_owner_invoice_id" class="inv-detail__link" :to="{ name: 'invoice-detail', params: { id: invoice.linked_owner_invoice_id } }">
            <span class="inv-detail__link-kind">Owner Invoice (engagement)</span>
            <span class="inv-detail__link-num">{{ linkedOwnerInvoiceNumber || 'View' }}</span>
          </router-link>
          <router-link
            v-for="sub in referencingReceivedInvoices"
            :key="sub.id"
            class="inv-detail__link"
            :to="{ name: 'invoice-detail', params: { id: sub.id } }"
          >
            <span class="inv-detail__link-kind">Contractor Invoice (linked)</span>
            <span class="inv-detail__link-num">{{ sub.number }}</span>
          </router-link>
        </div>
      </div>

      <!-- Attachments (received documents only) -->
      <AttachmentsCard v-if="invoice.direction === 'received'" module="invoices" :record-id="invoice.id" />

      <!-- Line items -->
      <div class="inv-detail__section card card--padded">
        <h2 class="inv-detail__section-title">Line Items</h2>
        <LineItemsTable :items="invoice.line_items as any" variant="Standard" :readonly="true" />
      </div>

      <!-- Tax & totals -->
      <div class="inv-detail__section card card--padded">
        <h2 class="inv-detail__section-title">Tax &amp; Totals</h2>
        <div class="inv-detail__tax-row">
          <DetailField label="Taxable" :value="invoice.taxable ? 'Yes' : 'No'" />
          <DetailField label="Tax Rate" :value="(invoice.tax_rate * 100).toFixed(4) + '%'" />
        </div>
        <div class="inv-detail__totals">
          <TotalsCards variant="Standard" :subtotal="invoice.subtotal" :salesTax="invoice.sales_tax" :taxRate="invoice.tax_rate" :total="invoice.total" />
          <div class="inv-detail__extra-cards">
            <div class="inv-detail__card">
              <div class="inv-detail__card-label">Payments / Credits</div>
              <div class="inv-detail__card-value">{{ formatCurrency(invoice.payments_credits) }}</div>
            </div>
            <div class="inv-detail__card inv-detail__card--balance">
              <div class="inv-detail__card-label">Balance Due</div>
              <div class="inv-detail__card-value">{{ formatCurrency(balanceDue) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div v-if="hasRichContent(invoice.notes)" class="inv-detail__section card card--padded">
        <h2 class="inv-detail__section-title">Notes</h2>
        <div class="inv-detail__rich-content proposal-rich-content" v-html="invoice.notes" />
      </div>
    </template>

    <DocPreviewModal v-model:visible="showPreview" />

    <ConfirmModal
      v-model:visible="showMarkPaidModal"
      title="Mark invoice as paid?"
      :message="`Record ${invoice?.number} as fully paid (${invoice ? formatCurrency(invoice.total) : ''})?`"
      confirmLabel="Mark Paid"
      variant="info"
      @confirm="onMarkPaidConfirm"
      @cancel="showMarkPaidModal = false"
    />

    <ConfirmModal
      v-model:visible="showDeleteModal"
      title="Delete invoice?"
      :message="`Are you sure you want to delete ${invoice?.number}? This cannot be undone.`"
      confirmLabel="Delete"
      variant="danger"
      @confirm="onDeleteConfirm"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import {
  useInvoice,
  useInvoiceList,
  useUpdateInvoiceStatus,
  useMarkInvoicePaid,
  useGenerateDocument,
  useDeleteInvoice,
} from '../../api/invoices'
import { usePOList } from '../../api/purchaseOrders'
import { useConfigList } from '../../composables/useConfigList'
import StatusPopover from '../../components/documents/StatusPopover.vue'
import StatusBadge from '../../components/base/StatusBadge.vue'
import LineItemsTable from '../../components/documents/LineItemsTable.vue'
import TotalsCards from '../../components/documents/TotalsCards.vue'
import DocPreviewModal from '../../components/documents/DocPreviewModal.vue'
import AttachmentsCard from '../../components/documents/AttachmentsCard.vue'
import ConfirmModal from '../../components/base/ConfirmModal.vue'
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_VARIANTS,
  computeBalanceDue,
  computeDueDate,
  computeIsOverdue,
} from '../../types/invoice'
import type { InvoiceStatus } from '../../types/invoice'
import type { POListParams } from '../../types/purchaseOrder'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const invoiceIdParam = route.params.id as string
const idRef = ref(invoiceIdParam)
const { data: invoice, isLoading, isError } = useInvoice(idRef)

const counterpartyLabel = computed(() => (invoice.value?.direction === 'received' ? 'Contractor' : 'Client'))
const statusOptions = computed<InvoiceStatus[]>(() => INVOICE_STATUSES[invoice.value?.direction ?? 'issued'])

// ── Computed money fields ─────────────────────────────────────────────────────
const { items: paymentTermItems } = useConfigList('payment_terms')
function termDelay(label?: string): number {
  return label ? (paymentTermItems.value.find((i) => i.label === label)?.delay_days ?? 0) : 0
}
const dueDate = computed(() =>
  invoice.value?.date ? computeDueDate(invoice.value.date, termDelay(invoice.value.payment_terms)) : '',
)
const dueDateDisplay = computed(() =>
  dueDate.value ? new Date(dueDate.value + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
)
const balanceDue = computed(() => (invoice.value ? computeBalanceDue(invoice.value.total, invoice.value.payments_credits) : 0))
const isOverdue = computed(() => (invoice.value ? computeIsOverdue(invoice.value.status, dueDate.value) : false))

// ── Linked document numbers ───────────────────────────────────────────────────
const receivedPoParams = computed<POListParams>(() => ({ direction: 'received', page: 1, page_size: 1000 }))
const { data: receivedPoData } = usePOList(receivedPoParams)
const linkedClientPoNumber = computed(() =>
  receivedPoData.value?.items.find((p) => p.id === invoice.value?.linked_client_po_id)?.number ?? '',
)
const issuedInvoiceParams = computed(() => ({ direction: 'issued' as const, page: 1, page_size: 1000 }))
const { data: issuedInvoiceData } = useInvoiceList(issuedInvoiceParams)
const linkedOwnerInvoiceNumber = computed(() =>
  issuedInvoiceData.value?.items.find((i) => i.id === invoice.value?.linked_owner_invoice_id)?.number ?? '',
)
// Received (contractor) invoices whose engagement link points at this invoice
// — shown on the issued invoice they were tied to (§5.4).
const receivedInvoiceParams = computed(() => ({ direction: 'received' as const, page: 1, page_size: 1000 }))
const { data: receivedInvoiceData } = useInvoiceList(receivedInvoiceParams)
const referencingReceivedInvoices = computed(() =>
  (receivedInvoiceData.value?.items ?? []).filter((i) => i.linked_owner_invoice_id === invoice.value?.id),
)
const hasLinks = computed(() => !!(
  invoice.value?.po_id || invoice.value?.proposal_id ||
  invoice.value?.linked_client_po_id || invoice.value?.linked_owner_invoice_id
) || referencingReceivedInvoices.value.length > 0)

// ── Status / Mark Paid / Delete ───────────────────────────────────────────────
const { mutate: updateStatus } = useUpdateInvoiceStatus()
function onStatusChange(status: InvoiceStatus) {
  updateStatus({ id: invoiceIdParam, status })
}

const showMarkPaidModal = ref(false)
const { mutate: markPaid } = useMarkInvoicePaid()
function onMarkPaidConfirm() {
  showMarkPaidModal.value = false
  markPaid(invoiceIdParam)
}

const { mutateAsync: generateDoc } = useGenerateDocument()
async function handleGenerateDoc() {
  const blob = await generateDoc(invoiceIdParam)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${invoice.value?.number ?? invoiceIdParam}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

const showDeleteModal = ref(false)
const { mutate: deleteInvoice } = useDeleteInvoice()
function onDeleteConfirm() {
  showDeleteModal.value = false
  deleteInvoice(invoiceIdParam, { onSuccess: () => router.push({ name: 'invoices' }) })
}

const showPreview = ref(false)

function goBack() {
  router.push({ name: invoice.value?.direction === 'received' ? 'invoices-received' : 'invoices-issued' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
function hasRichContent(html?: string | null): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, '').length > 0
}

const DetailField = (props: { label: string; value?: string | null }) => {
  const v = props.value
  if (v === null || v === undefined || v === '') return null
  return h('div', { class: 'inv-detail__field' }, [
    h('span', { class: 'inv-detail__label' }, props.label),
    h('span', { class: 'inv-detail__value' }, v),
  ])
}
</script>

<style scoped>
.inv-detail { display: flex; flex-direction: column; gap: 20px; padding: 24px; }
.inv-detail__header {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
}
.inv-detail__header-left { display: flex; align-items: center; gap: 12px; }
.inv-detail__title { font-size: 20px; font-weight: 800; }
.inv-detail__header-actions { display: flex; align-items: center; gap: 8px; }
.inv-detail__delete { color: var(--color-error); }

.inv-detail__loading { display: flex; flex-direction: column; gap: 12px; }
.inv-detail__error { padding: 24px; color: var(--color-error); text-align: center; }

.inv-detail__section { display: flex; flex-direction: column; gap: 16px; }
.inv-detail__section-title {
  font-size: 14px; font-weight: 700; color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.inv-detail__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.inv-detail__tax-row { display: flex; gap: 32px; flex-wrap: wrap; }

.inv-detail__totals { display: flex; flex-direction: column; gap: 12px; align-items: flex-end; }
.inv-detail__extra-cards { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
.inv-detail__card {
  background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px;
  padding: 14px 20px; min-width: 130px; text-align: right;
}
.inv-detail__card--balance { border-color: var(--color-primary); background: rgba(29, 78, 216, 0.04); }
.inv-detail__card-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--color-text-subtle); margin-bottom: 4px;
}
.inv-detail__card-value { font-size: 18px; font-weight: 700; color: var(--color-text); font-variant-numeric: tabular-nums; }
.inv-detail__card--balance .inv-detail__card-value { color: var(--color-primary); }

.inv-detail__links { display: flex; flex-wrap: wrap; gap: 12px; }
.inv-detail__link {
  display: flex; flex-direction: column; gap: 2px; padding: 10px 14px;
  border: 1px solid var(--color-border); border-radius: 8px; text-decoration: none;
  background: var(--color-bg-subtle); transition: border-color 0.1s;
}
.inv-detail__link:hover { border-color: var(--color-primary); }
.inv-detail__link-kind {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-subtle);
}
.inv-detail__link-num { font-size: 14px; font-weight: 600; color: var(--color-primary); }

:deep(.inv-detail__field) { display: flex; flex-direction: column; gap: 4px; }
:deep(.inv-detail__label) {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-subtle);
}
:deep(.inv-detail__value) { font-size: 14px; color: var(--color-text); }

.inv-detail__rich-content {
  font-size: 14px; color: var(--color-text); line-height: 1.6; padding: 12px;
  background: var(--color-bg-subtle); border: 1px solid var(--color-border); border-radius: 6px;
}

@media (max-width: 700px) { .inv-detail { padding: 16px; } }
</style>
