<template>
  <div class="proposal-detail">
    <!-- Header -->
    <div class="proposal-detail__header">
      <div class="proposal-detail__header-left">
        <button class="btn btn--ghost btn--sm" @click="router.push({ name: 'proposals' })">← Back</button>
        <h1 class="proposal-detail__title">{{ proposal?.number ?? '…' }}</h1>
        <StatusBadge
          v-if="proposal"
          :label="proposal.type"
          :variant="proposal.type === 'Standard' ? 'gray' : 'purple'"
        />
        <StatusPopover
          v-if="proposal"
          :status="proposal.status"
          :direction="proposal.direction"
          @change="(s) => onStatusChange(s)"
        />
      </div>
      <div v-if="proposal" class="proposal-detail__header-actions">
        <button
          v-if="auth.canEdit"
          class="btn btn--secondary btn--sm"
          @click="router.push({ name: 'proposal-edit', params: { id: proposal.id } })"
        >Edit</button>
        <!-- Received documents have nothing to generate — hide (spec §0.2). -->
        <button
          v-if="auth.canEdit && proposal.direction === 'issued'"
          class="btn btn--secondary btn--sm"
          @click="handleGenerateDoc"
        >Generate Document</button>
        <button
          v-if="auth.canEdit && proposal.direction === 'issued'"
          class="btn btn--secondary btn--sm"
          @click="showPreview = true"
        >Preview Document</button>
        <button
          v-if="auth.canEdit"
          class="btn btn--secondary btn--sm proposal-detail__delete"
          @click="showDeleteModal = true"
        >Delete</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="proposal-detail__loading">
      <div v-for="i in 4" :key="i" class="skeleton" style="height:80px;border-radius:8px" />
    </div>

    <!-- Error -->
    <div v-else-if="isError || !proposal" class="proposal-detail__error">
      Proposal not found or failed to load.
    </div>

    <!-- Content -->
    <template v-else>

      <!-- Header section -->
      <div class="proposal-detail__section card card--padded">
        <h2 class="proposal-detail__section-title">Header</h2>
        <div class="proposal-detail__grid">
          <DetailField label="Date" :value="formatDate(proposal.date)" />
          <DetailField label="Proposal #" :value="proposal.number" />
          <DetailField label="Type" :value="proposal.type" />
          <DetailField label="Status" :value="proposal.status" />

          <template v-if="proposal.type === 'Standard'">
            <DetailField label="Client Name" :value="proposal.client_name" />
            <DetailField label="Address" :value="proposal.address" />
            <DetailField label="Title" :value="proposal.title" />
            <DetailField label="Business Name" :value="proposal.business_name" />
            <DetailField label="Department" :value="proposal.department" />
            <DetailField label="Phone" :value="proposal.phone" />
            <DetailField label="Email" :value="proposal.email" />
            <DetailField label="Project No." :value="proposal.project_no" />
            <DetailField label="Project Name" :value="proposal.project_name" />
            <DetailField label="Agreement No." :value="proposal.agreement_no" />
            <DetailField label="Proposal Valid Till" :value="proposal.proposal_valid_till ? formatDate(proposal.proposal_valid_till) : ''" />
          </template>

          <template v-else>
            <DetailField label="Reference" :value="proposal.reference" />
            <DetailField label="Project Location" :value="proposal.project_location" />
            <DetailField label="Address" :value="proposal.address" />
            <DetailField label="Project Type" :value="proposal.project_type" />
            <DetailField label="Project Name" :value="proposal.project_name" />
          </template>
        </div>
      </div>

      <!-- Linked documents (§7): documents generated from this proposal, plus
           engagement links on received proposals. -->
      <div v-if="linkedDocs.length" class="proposal-detail__section card card--padded">
        <h2 class="proposal-detail__section-title">Linked Documents</h2>
        <div class="proposal-detail__links">
          <router-link
            v-for="link in linkedDocs"
            :key="link.kind + link.id"
            class="proposal-detail__link"
            :to="link.to"
          >
            <span class="proposal-detail__link-kind">{{ link.kind }}</span>
            <span class="proposal-detail__link-num">{{ link.label }}</span>
          </router-link>
        </div>
      </div>

      <!-- Attachments (received documents only) -->
      <AttachmentsCard v-if="proposal.direction === 'received'" module="proposals" :record-id="proposal.id" />

      <!-- Line items -->
      <div class="proposal-detail__section card card--padded">
        <h2 class="proposal-detail__section-title">Line Items</h2>
        <LineItemsTable
          :items="proposal.line_items as any"
          :variant="proposal.type"
          :readonly="true"
        />
      </div>

      <!-- Tax & Totals -->
      <div class="proposal-detail__section card card--padded">
        <h2 class="proposal-detail__section-title">Tax &amp; Totals</h2>
        <div class="proposal-detail__tax-row">
          <DetailField label="Taxable" :value="proposal.taxable ? 'Yes' : 'No'" />
          <DetailField label="Tax Rate" :value="(proposal.tax_rate * 100).toFixed(4) + '%'" />
        </div>
        <TotalsCards
          :variant="proposal.type"
          :subtotal="proposal.subtotal"
          :salesTax="proposal.sales_tax"
          :taxRate="proposal.tax_rate"
          :total="proposal.total"
        />
      </div>

      <!-- Notes -->
      <div v-if="hasRichContent(proposal.notes)" class="proposal-detail__section card card--padded">
        <h2 class="proposal-detail__section-title">Notes</h2>
        <div class="proposal-detail__rich-content proposal-rich-content" v-html="proposal.notes" />
      </div>

      <!-- Services Provided (MP only) -->
      <div v-if="proposal.type === 'MP' && hasRichContent(proposal.services_provided)" class="proposal-detail__section card card--padded">
        <h2 class="proposal-detail__section-title">Services Provided</h2>
        <div class="proposal-detail__rich-content proposal-rich-content" v-html="proposal.services_provided" />
      </div>

    </template>

    <!-- Doc preview modal -->
    <DocPreviewModal v-model:visible="showPreview" />

    <!-- Delete confirm -->
    <ConfirmModal
      v-model:visible="showDeleteModal"
      title="Delete proposal?"
      :message="`Are you sure you want to delete ${proposal?.number}? This cannot be undone.`"
      confirmLabel="Delete"
      variant="danger"
      @confirm="onDeleteConfirm"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRouter, useRoute, type RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import {
  useProposal,
  useUpdateProposalStatus,
  useGenerateDocument,
  useDeleteProposal,
} from '../../api/proposals'
import { usePOList } from '../../api/purchaseOrders'
import { useInvoiceList } from '../../api/invoices'
import StatusPopover from '../../components/documents/StatusPopover.vue'
import StatusBadge from '../../components/base/StatusBadge.vue'
import LineItemsTable from '../../components/documents/LineItemsTable.vue'
import TotalsCards from '../../components/documents/TotalsCards.vue'
import DocPreviewModal from '../../components/documents/DocPreviewModal.vue'
import AttachmentsCard from '../../components/documents/AttachmentsCard.vue'
import ConfirmModal from '../../components/base/ConfirmModal.vue'
import type { ProposalStatus } from '../../types/proposal'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const proposalId = route.params.id as string
const idRef = ref(proposalId)

const { data: proposal, isLoading, isError } = useProposal(idRef)

// ── Linked documents (§7) ─────────────────────────────────────────────────────
// Documents generated from this proposal (POs/invoices carrying its id), plus
// the engagement links stored on a received proposal.
const posIssuedParams = computed(() => ({ direction: 'issued' as const, page: 1, page_size: 1000 }))
const posReceivedParams = computed(() => ({ direction: 'received' as const, page: 1, page_size: 1000 }))
const invIssuedParams = computed(() => ({ direction: 'issued' as const, page: 1, page_size: 1000 }))
const invReceivedParams = computed(() => ({ direction: 'received' as const, page: 1, page_size: 1000 }))
const { data: posIssued } = usePOList(posIssuedParams)
const { data: posReceived } = usePOList(posReceivedParams)
const { data: invIssued } = useInvoiceList(invIssuedParams)
const { data: invReceived } = useInvoiceList(invReceivedParams)

interface LinkedDoc { kind: string; id: string; label: string; to: RouteLocationRaw }

const linkedDocs = computed<LinkedDoc[]>(() => {
  const p = proposal.value
  if (!p) return []
  const links: LinkedDoc[] = []
  const allPos = [...(posIssued.value?.items ?? []), ...(posReceived.value?.items ?? [])]
  const allInv = [...(invIssued.value?.items ?? []), ...(invReceived.value?.items ?? [])]

  // Documents that reference this proposal.
  for (const po of allPos) {
    if (po.proposal_id === p.id) {
      links.push({ kind: 'Purchase Order', id: po.id, label: po.number, to: { name: 'po-detail', params: { id: po.id } } })
    }
  }
  for (const inv of allInv) {
    if (inv.proposal_id === p.id) {
      links.push({ kind: 'Invoice', id: inv.id, label: inv.number, to: { name: 'invoice-detail', params: { id: inv.id } } })
    }
  }

  // Engagement links on a received proposal.
  if (p.linked_client_po_id) {
    const po = allPos.find((x) => x.id === p.linked_client_po_id)
    links.push({ kind: 'Client PO (engagement)', id: p.linked_client_po_id, label: po?.number ?? 'View', to: { name: 'po-detail', params: { id: p.linked_client_po_id } } })
  }
  if (p.linked_owner_invoice_id) {
    const inv = allInv.find((x) => x.id === p.linked_owner_invoice_id)
    links.push({ kind: 'Owner Invoice (engagement)', id: p.linked_owner_invoice_id, label: inv?.number ?? 'View', to: { name: 'invoice-detail', params: { id: p.linked_owner_invoice_id } } })
  }
  return links
})

// Status update
const { mutate: updateStatus } = useUpdateProposalStatus()
function onStatusChange(status: ProposalStatus) {
  updateStatus({ id: proposalId, status })
}

// Generate doc
const { mutateAsync: generateDoc } = useGenerateDocument()
async function handleGenerateDoc() {
  const blob = await generateDoc(proposalId)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${proposal.value?.number ?? proposalId}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

// Delete
const showDeleteModal = ref(false)
const { mutate: deleteMutation } = useDeleteProposal()
function onDeleteConfirm() {
  showDeleteModal.value = false
  deleteMutation(proposalId, {
    onSuccess: () => router.push({ name: 'proposals' }),
  })
}

const showPreview = ref(false)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/**
 * True when a TipTap rich-text field has visible content.
 *
 * The editor stores HTML even when "empty": typing then deleting produces
 * `<p></p>`, hitting Enter then deleting gives `<p><br></p>`, etc. A plain
 * truthiness check lets those through and renders an empty Notes section.
 * Strip tags + entities + whitespace and check what's actually visible.
 */
function hasRichContent(html?: string | null): boolean {
  if (!html) return false
  const stripped = html
    .replace(/<[^>]*>/g, '')        // tags
    .replace(/&nbsp;/gi, ' ')       // non-breaking spaces
    .replace(/\s+/g, '')            // all whitespace
  return stripped.length > 0
}

// Lightweight inline field renderer.
// Empty fields (null, undefined, or '') don't render at all — the detail page
// acts as a read-only preview, so blank rows are noise. Sections that have
// every field blank just collapse to a smaller grid.
const DetailField = (props: { label: string; value?: string | null }) => {
  const v = props.value
  if (v === null || v === undefined || v === '') return null
  return h('div', { class: 'proposal-detail__field' }, [
    h('span', { class: 'proposal-detail__label' }, props.label),
    h('span', { class: 'proposal-detail__value' }, v),
  ])
}
</script>

<style scoped>
.proposal-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
}

.proposal-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.proposal-detail__header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.proposal-detail__title {
  font-size: 20px;
  font-weight: 800;
}

.proposal-detail__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.proposal-detail__delete {
  color: var(--color-error);
}

.proposal-detail__loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.proposal-detail__error {
  padding: 24px;
  color: var(--color-error);
  text-align: center;
}

.proposal-detail__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.proposal-detail__section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.proposal-detail__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.proposal-detail__tax-row {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}

.proposal-detail__links {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.proposal-detail__link {
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

.proposal-detail__link:hover {
  border-color: var(--color-primary);
}

.proposal-detail__link-kind {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
}

.proposal-detail__link-num {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

:deep(.proposal-detail__field) {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:deep(.proposal-detail__label) {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
}

:deep(.proposal-detail__value) {
  font-size: 14px;
  color: var(--color-text);
}

.proposal-detail__rich-content {
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.6;
  padding: 12px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

@media (max-width: 700px) {
  .proposal-detail {
    padding: 16px;
  }
}
</style>
