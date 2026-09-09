<template>
  <div class="po-detail">
    <!-- Header -->
    <div class="po-detail__header">
      <div class="po-detail__header-left">
        <button class="btn btn--ghost btn--sm" @click="goBack">← Back</button>
        <h1 class="po-detail__title">{{ po?.number ?? '…' }}</h1>
        <StatusBadge v-if="po" :label="directionLabel" variant="gray" />
        <StatusPopover
          v-if="po"
          :status="po.status"
          :options="PO_STATUSES"
          :variantMap="PO_STATUS_VARIANTS"
          @change="onStatusChange"
        />
      </div>
      <div v-if="po" class="po-detail__header-actions">
        <button v-if="auth.canEdit" class="btn btn--secondary btn--sm" @click="router.push({ name: 'po-edit', params: { id: po.id } })">Edit</button>
        <button v-if="auth.canEdit && po.direction === 'issued'" class="btn btn--secondary btn--sm" @click="handleGenerateDoc">Generate Document</button>
        <button v-if="auth.canEdit && po.direction === 'issued'" class="btn btn--secondary btn--sm" @click="showPreview = true">Preview Document</button>
        <button v-if="auth.canEdit" class="btn btn--secondary btn--sm po-detail__delete" @click="showDeleteModal = true">Delete</button>
      </div>
    </div>

    <div v-if="isLoading" class="po-detail__loading">
      <div v-for="i in 4" :key="i" class="skeleton" style="height:80px;border-radius:8px" />
    </div>

    <div v-else-if="isError || !po" class="po-detail__error">Purchase order not found or failed to load.</div>

    <template v-else>
      <!-- Header section -->
      <div class="po-detail__section card card--padded">
        <h2 class="po-detail__section-title">Header</h2>
        <div class="po-detail__grid">
          <DetailField label="Date" :value="formatDate(po.date)" />
          <DetailField label="PO #" :value="po.number" />
          <DetailField label="Status" :value="po.status" />
          <DetailField :label="`${counterpartyLabel} Name`" :value="po.client_name" />
          <DetailField label="Address" :value="po.address" />
          <DetailField label="Project No." :value="po.project_no" />
          <DetailField label="Agreement No." :value="po.agreement_no" />
          <DetailField label="Ship Date" :value="po.ship_date ? formatDate(po.ship_date) : ''" />
          <DetailField label="Ship To" :value="po.ship_to" />
          <DetailField label="Payment Terms" :value="po.payment_terms" />
        </div>
      </div>

      <!-- Linked documents -->
      <div v-if="hasLinks" class="po-detail__section card card--padded">
        <h2 class="po-detail__section-title">Linked Documents</h2>
        <div class="po-detail__links">
          <router-link
            v-if="po.proposal_id"
            class="po-detail__link"
            :to="{ name: 'proposal-detail', params: { id: po.proposal_id } }"
          >
            <span class="po-detail__link-kind">Proposal</span>
            <span class="po-detail__link-num">{{ po.proposal_number || 'View' }}</span>
          </router-link>
          <router-link
            v-if="po.linked_client_po_id"
            class="po-detail__link"
            :to="{ name: 'po-detail', params: { id: po.linked_client_po_id } }"
          >
            <span class="po-detail__link-kind">Client PO (engagement)</span>
            <span class="po-detail__link-num">{{ linkedClientPoNumber || 'View' }}</span>
          </router-link>
          <router-link
            v-for="inv in linkedInvoices"
            :key="inv.id"
            class="po-detail__link"
            :to="{ name: 'invoice-detail', params: { id: inv.id } }"
          >
            <span class="po-detail__link-kind">Invoice</span>
            <span class="po-detail__link-num">{{ inv.number }}</span>
          </router-link>
        </div>
      </div>

      <!-- Attachments (received documents only) -->
      <AttachmentsCard v-if="po.direction === 'received'" module="pos" :record-id="po.id" />

      <!-- Line items -->
      <div class="po-detail__section card card--padded">
        <h2 class="po-detail__section-title">Line Items</h2>
        <LineItemsTable :items="po.line_items as any" variant="Standard" :readonly="true" />
      </div>

      <!-- Tax & totals -->
      <div class="po-detail__section card card--padded">
        <h2 class="po-detail__section-title">Tax &amp; Totals</h2>
        <div class="po-detail__tax-row">
          <DetailField label="Taxable" :value="po.taxable ? 'Yes' : 'No'" />
          <DetailField label="Tax Rate" :value="(po.tax_rate * 100).toFixed(4) + '%'" />
        </div>
        <TotalsCards variant="Standard" :subtotal="po.subtotal" :salesTax="po.sales_tax" :taxRate="po.tax_rate" :total="po.total" />
      </div>

      <!-- Notes -->
      <div v-if="hasRichContent(po.notes)" class="po-detail__section card card--padded">
        <h2 class="po-detail__section-title">Notes</h2>
        <div class="po-detail__rich-content proposal-rich-content" v-html="po.notes" />
      </div>
    </template>

    <DocPreviewModal v-model:visible="showPreview" />

    <ConfirmModal
      v-model:visible="showDeleteModal"
      title="Delete purchase order?"
      :message="`Are you sure you want to delete ${po?.number}? This cannot be undone.`"
      confirmLabel="Delete"
      variant="danger"
      @confirm="onDeleteConfirm"
      @cancel="showDeleteModal = false"
    />

    <ConfirmModal
      v-model:visible="showLinkedWarn"
      title="Cannot delete purchase order"
      :message="linkedWarnMessage"
      confirmLabel="OK"
      cancelLabel=""
      variant="warning"
      @confirm="showLinkedWarn = false"
      @cancel="showLinkedWarn = false"
    />

    <!-- Cancel-with-linked-invoices warning (§7). Shown when moving to Canceled
         while invoices link to this PO; the mock cascade runs on confirm. -->
    <ConfirmModal
      v-model:visible="showCancelCascade"
      title="Cancel this purchase order?"
      :message="cancelCascadeMessage"
      confirmLabel="Cancel PO"
      cancelLabel="Keep open"
      variant="warning"
      @confirm="onCancelCascadeConfirm"
      @cancel="showCancelCascade = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import {
  usePO,
  usePOList,
  useUpdatePOStatus,
  useGenerateDocument,
  useDeletePO,
  usePOLinkedInvoiceIds,
} from '../../api/purchaseOrders'
import { useInvoiceList } from '../../api/invoices'
import StatusPopover from '../../components/documents/StatusPopover.vue'
import StatusBadge from '../../components/base/StatusBadge.vue'
import LineItemsTable from '../../components/documents/LineItemsTable.vue'
import TotalsCards from '../../components/documents/TotalsCards.vue'
import DocPreviewModal from '../../components/documents/DocPreviewModal.vue'
import AttachmentsCard from '../../components/documents/AttachmentsCard.vue'
import ConfirmModal from '../../components/base/ConfirmModal.vue'
import { PO_STATUSES, PO_STATUS_VARIANTS } from '../../types/purchaseOrder'
import type { POListParams, POStatus } from '../../types/purchaseOrder'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const poId = route.params.id as string
const idRef = ref(poId)
const { data: po, isLoading, isError } = usePO(idRef)

const counterpartyLabel = computed(() => (po.value?.direction === 'issued' ? 'Contractor' : 'Client'))
const directionLabel = computed(() => (po.value?.direction === 'issued' ? 'Issued' : 'Received'))

// Resolve the engagement-linked client PO number for display.
const receivedPoParams = computed<POListParams>(() => ({ direction: 'received', page: 1, page_size: 1000 }))
const { data: receivedPoData } = usePOList(receivedPoParams)
const linkedClientPoNumber = computed(() =>
  receivedPoData.value?.items.find((p) => p.id === po.value?.linked_client_po_id)?.number ?? '',
)
// Invoices that reference this PO (via po_id), across both directions.
const invIssuedParams = computed(() => ({ direction: 'issued' as const, page: 1, page_size: 1000 }))
const invReceivedParams = computed(() => ({ direction: 'received' as const, page: 1, page_size: 1000 }))
const { data: invIssued } = useInvoiceList(invIssuedParams)
const { data: invReceived } = useInvoiceList(invReceivedParams)
const linkedInvoices = computed(() =>
  [...(invIssued.value?.items ?? []), ...(invReceived.value?.items ?? [])].filter((inv) => inv.po_id === po.value?.id),
)
const hasLinks = computed(() => !!(po.value?.proposal_id || po.value?.linked_client_po_id) || linkedInvoices.value.length > 0)

// ── Status ────────────────────────────────────────────────────────────────────
const idForLinked = ref(poId)
const { data: linkedInvoiceIds } = usePOLinkedInvoiceIds(idForLinked)
const { mutate: updateStatus } = useUpdatePOStatus()

const showCancelCascade = ref(false)
const cancelCascadeMessage = ref('')
const pendingStatus = ref<POStatus | null>(null)

function onStatusChange(status: POStatus) {
  const linkedCount = linkedInvoiceIds.value?.length ?? 0
  if (status === 'Canceled' && linkedCount > 0) {
    pendingStatus.value = status
    cancelCascadeMessage.value =
      `${linkedCount} linked invoice${linkedCount === 1 ? '' : 's'} will be canceled along with this PO. Continue?`
    showCancelCascade.value = true
    return
  }
  updateStatus({ id: poId, status })
}

function onCancelCascadeConfirm() {
  showCancelCascade.value = false
  if (pendingStatus.value) updateStatus({ id: poId, status: pendingStatus.value })
  pendingStatus.value = null
}

// ── Generate doc ──────────────────────────────────────────────────────────────
const { mutateAsync: generateDoc } = useGenerateDocument()
async function handleGenerateDoc() {
  const blob = await generateDoc(poId)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${po.value?.number ?? poId}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Delete ────────────────────────────────────────────────────────────────────
const showDeleteModal = ref(false)
const showLinkedWarn = ref(false)
const linkedWarnMessage = ref('')
const { mutate: deletePO } = useDeletePO()

function onDeleteConfirm() {
  showDeleteModal.value = false
  deletePO(poId, {
    onSuccess: () => router.push({ name: 'pos' }),
    onError: (err: unknown) => {
      const e = err as { status?: number; linked?: string[] }
      if (e?.status === 409) {
        const n = e.linked?.length ?? 0
        linkedWarnMessage.value =
          `${po.value?.number} has ${n} linked invoice${n === 1 ? '' : 's'}. Remove the link before deleting.`
        showLinkedWarn.value = true
      }
    },
  })
}

const showPreview = ref(false)

function goBack() {
  router.push({ name: po.value?.direction === 'issued' ? 'pos-issued' : 'pos-received' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function hasRichContent(html?: string | null): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, '').length > 0
}

const DetailField = (props: { label: string; value?: string | null }) => {
  const v = props.value
  if (v === null || v === undefined || v === '') return null
  return h('div', { class: 'po-detail__field' }, [
    h('span', { class: 'po-detail__label' }, props.label),
    h('span', { class: 'po-detail__value' }, v),
  ])
}
</script>

<style scoped>
.po-detail { display: flex; flex-direction: column; gap: 20px; padding: 24px; }

.po-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.po-detail__header-left { display: flex; align-items: center; gap: 12px; }
.po-detail__title { font-size: 20px; font-weight: 800; }
.po-detail__header-actions { display: flex; align-items: center; gap: 8px; }
.po-detail__delete { color: var(--color-error); }

.po-detail__loading { display: flex; flex-direction: column; gap: 12px; }
.po-detail__error { padding: 24px; color: var(--color-error); text-align: center; }

.po-detail__section { display: flex; flex-direction: column; gap: 16px; }
.po-detail__section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.po-detail__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
.po-detail__tax-row { display: flex; gap: 32px; flex-wrap: wrap; }

.po-detail__links { display: flex; flex-wrap: wrap; gap: 12px; }
.po-detail__link {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  text-decoration: none;
  background: var(--color-bg-subtle);
  transition: border-color 0.1s;
}
.po-detail__link:hover { border-color: var(--color-primary); }
.po-detail__link-kind {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
}
.po-detail__link-num { font-size: 14px; font-weight: 600; color: var(--color-primary); }

:deep(.po-detail__field) { display: flex; flex-direction: column; gap: 4px; }
:deep(.po-detail__label) {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
}
:deep(.po-detail__value) { font-size: 14px; color: var(--color-text); }

.po-detail__rich-content {
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.6;
  padding: 12px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

@media (max-width: 700px) { .po-detail { padding: 16px; } }
</style>
