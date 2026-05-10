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
          @change="(s) => onStatusChange(s)"
        />
      </div>
      <div v-if="proposal" class="proposal-detail__header-actions">
        <button
          v-if="auth.canEdit"
          class="btn btn--secondary btn--sm"
          @click="router.push({ name: 'proposal-edit', params: { id: proposal.id } })"
        >Edit</button>
        <button
          v-if="auth.canEdit"
          class="btn btn--secondary btn--sm"
          @click="handleGenerateDoc"
        >Generate Document</button>
        <button
          v-if="auth.canEdit"
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
      <div v-if="proposal.notes" class="proposal-detail__section card card--padded">
        <h2 class="proposal-detail__section-title">Notes</h2>
        <div class="proposal-detail__rich-content" v-html="proposal.notes" />
      </div>

      <!-- Services Provided (MP only) -->
      <div v-if="proposal.type === 'MP' && proposal.services_provided" class="proposal-detail__section card card--padded">
        <h2 class="proposal-detail__section-title">Services Provided</h2>
        <div class="proposal-detail__rich-content" v-html="proposal.services_provided" />
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
import { ref, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import {
  useProposal,
  useUpdateProposalStatus,
  useGenerateDocument,
  useDeleteProposal,
} from '../../api/proposals'
import StatusPopover from './components/StatusPopover.vue'
import StatusBadge from '../../components/base/StatusBadge.vue'
import LineItemsTable from './components/LineItemsTable.vue'
import TotalsCards from './components/TotalsCards.vue'
import DocPreviewModal from './components/DocPreviewModal.vue'
import ConfirmModal from '../../components/base/ConfirmModal.vue'
import type { ProposalStatus } from '../../types/proposal'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const proposalId = route.params.id as string
const idRef = ref(proposalId)

const { data: proposal, isLoading, isError } = useProposal(idRef)

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

// Lightweight inline field renderer
const DetailField = (props: { label: string; value?: string | null }) =>
  h('div', { class: 'proposal-detail__field' }, [
    h('span', { class: 'proposal-detail__label' }, props.label),
    h('span', { class: 'proposal-detail__value' }, props.value || '—'),
  ])
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
