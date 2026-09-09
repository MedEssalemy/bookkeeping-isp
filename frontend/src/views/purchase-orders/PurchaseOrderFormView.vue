<template>
  <div class="po-form">
    <!-- Header -->
    <div class="po-form__header">
      <div class="po-form__header-left">
        <button class="btn btn--ghost btn--sm" type="button" @click="handleCancel">← Back</button>
        <h1 class="po-form__title">{{ isEdit ? `Edit ${number || ''}` : 'New Purchase Order' }}</h1>
        <span class="po-form__direction-chip">{{ isReceived ? 'Received (Client)' : 'Issued (Contractor)' }}</span>
      </div>
      <div class="po-form__header-actions">
        <button class="btn btn--ghost btn--sm" type="button" @click="handleCancel">Cancel</button>
        <button class="btn btn--primary btn--sm" type="button" :disabled="saveLoading" @click="handleSave">
          {{ saveLoading ? 'Saving…' : 'Save Purchase Order' }}
        </button>
      </div>
    </div>

    <div class="po-form__body">
      <!-- Header fields -->
      <div class="po-form__section card card--padded">
        <h2 class="po-form__section-title">Header</h2>
        <div class="po-form__grid">
          <BaseDatePicker v-model="date" label="Date" required :error="errors.date" />

          <BaseInput
            v-model="number"
            label="PO #"
            required
            :error="errors.number"
            :placeholder="isReceived ? 'Client\'s PO number' : 'PO-260000'"
          />

          <ComboSelect
            v-model="status"
            label="Status"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
          />

          <ComboSelect
            :modelValue="selectedProposalId"
            label="Proposal #"
            :options="proposalOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Link a proposal…"
            searchable
            showClear
            filterPlaceholder="Search proposals…"
            @update:modelValue="onProposalPicked"
          />

          <ComboSelect
            :modelValue="selectedContactId"
            :label="`${counterpartyLabel} Name`"
            required
            :options="contactOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select a contact…"
            searchable
            showClear
            filterPlaceholder="Search name, business, address…"
            :error="errors.clientName"
            @update:modelValue="onContactPicked"
          >
            <template #option="{ option }">
              <div class="contact-option">
                <div class="contact-option__primary">{{ option.primary }}</div>
                <div class="contact-option__secondary">{{ option.secondary }}</div>
              </div>
            </template>
          </ComboSelect>

          <BaseInput v-model="clientName" label="Name (as entered)" :error="errors.clientName" />
          <BaseInput v-model="address" label="Address" required :error="errors.address" />
          <BaseInput v-model="projectNo" label="Project No." />
          <BaseInput v-model="agreementNo" label="Agreement No." />
          <BaseDatePicker v-model="shipDate" label="Ship Date" />
          <BaseInput v-model="shipTo" label="Ship To" />

          <ComboSelect
            v-model="paymentTerms"
            label="Payment Terms"
            :options="paymentTermsOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select terms…"
            showClear
          />
        </div>
      </div>

      <!-- Engagement link (issued only) -->
      <div v-if="!isReceived" class="po-form__section card card--padded">
        <h2 class="po-form__section-title">Engagement Link <span class="po-form__optional">(optional)</span></h2>
        <p class="po-form__hint">Tie this contractor PO to a Client PO or one of your Invoices.</p>
        <div class="po-form__grid">
          <ComboSelect
            v-model="linkedClientPoId"
            label="Client PO"
            :options="clientPoOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select a Client PO…"
            searchable
            showClear
            filterPlaceholder="Search client POs…"
          />
          <!-- Owner Invoice: enabled once the Invoices module lands (Phase 7). -->
          <ComboSelect
            v-model="linkedOwnerInvoiceId"
            label="Owner Invoice"
            :options="[]"
            placeholder="Available once Invoices land"
            disabled
          />
        </div>
      </div>

      <!-- Line items -->
      <div class="po-form__section card card--padded">
        <h2 class="po-form__section-title">Line Items</h2>
        <span v-if="errors.lineItems" class="field__error">{{ errors.lineItems }}</span>
        <LineItemsTable
          :items="lineItems"
          variant="Standard"
          @add="addLineItem"
          @remove="removeLineItem"
        />
      </div>

      <!-- Tax & totals -->
      <div class="po-form__section card card--padded">
        <h2 class="po-form__section-title">Tax &amp; Totals</h2>
        <div class="po-form__tax-row">
          <label class="po-form__toggle">
            <input type="checkbox" :checked="taxable" @change="onTaxableToggle(($event.target as HTMLInputElement).checked)" />
            <span>Taxable</span>
          </label>
          <div class="field po-form__tax-rate">
            <label class="field__label">Tax Rate (%)</label>
            <input
              class="field__input"
              type="number"
              step="0.001"
              min="0"
              :disabled="!taxable"
              :value="taxRatePercentDisplay"
              @input="onTaxRateInput($event)"
            />
          </div>
        </div>
        <TotalsCards variant="Standard" :subtotal="subtotal" :salesTax="salesTax" :taxRate="taxRate" :total="total" />
      </div>

      <!-- Notes -->
      <div class="po-form__section card card--padded">
        <h2 class="po-form__section-title">Notes</h2>
        <RichTextEditor v-model="notes" />
      </div>
    </div>

    <!-- Cancel dirty confirm -->
    <ConfirmModal
      v-model:visible="showCancelConfirm"
      title="Discard unsaved changes?"
      message="You have unsaved changes. Are you sure you want to leave?"
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      variant="warning"
      @confirm="router.back()"
      @cancel="showCancelConfirm = false"
    />

    <!-- Duplicate number confirm -->
    <ConfirmModal
      v-model:visible="showDuplicateConfirm"
      title="PO number exists"
      :message="`A purchase order with number ${number} already exists. Replace it?`"
      confirmLabel="Replace"
      cancelLabel="Cancel"
      variant="danger"
      @confirm="onDuplicateReplace"
      @cancel="showDuplicateConfirm = false"
    />

    <!-- Autofill overwrite confirm -->
    <ConfirmModal
      v-model:visible="showAutofillConfirm"
      title="Replace form with proposal data?"
      message="Selecting this proposal will overwrite the header fields and line items you've entered. Continue?"
      confirmLabel="Replace"
      cancelLabel="Keep my entries"
      variant="warning"
      @confirm="onAutofillConfirm"
      @cancel="onAutofillCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProposalList, useProposal } from '../../api/proposals'
import {
  usePO,
  usePOList,
  useCreatePO,
  useUpdatePO,
  useNextPONumber,
} from '../../api/purchaseOrders'
import { useAllContacts, type ContactRow } from '../../api/clients'
import { useAllContractors } from '../../api/contractors'
import { useConfigList } from '../../composables/useConfigList'
import { PO_STATUSES } from '../../types/purchaseOrder'
import type { POLineItem, POListParams, POPayload, POStatus } from '../../types/purchaseOrder'
import type { DocDirection } from '../../types/common'
import type { Proposal, StandardLineItem, MPLineItem, ProposalListParams } from '../../types/proposal'
import BaseInput from '../../components/base/BaseInput.vue'
import ComboSelect from '../../components/base/ComboSelect.vue'
import BaseDatePicker from '../../components/base/BaseDatePicker.vue'
import RichTextEditor from '../../components/base/RichTextEditor.vue'
import ConfirmModal from '../../components/base/ConfirmModal.vue'
import LineItemsTable from '../../components/documents/LineItemsTable.vue'
import TotalsCards from '../../components/documents/TotalsCards.vue'

const router = useRouter()
const route = useRoute()

const isEdit = !!route.params.id
const poId = ref<string>((route.params.id as string) || '')

// Direction: create → from ?direction= (default received, the primary clients-side
// flow); edit → restored from the loaded record (locked). Received = clients side.
const direction = ref<DocDirection>(route.query.direction === 'issued' ? 'issued' : 'received')
const isReceived = computed(() => direction.value === 'received')
const counterpartyLabel = computed(() => (isReceived.value ? 'Client' : 'Contractor'))

// ── Form state ────────────────────────────────────────────────────────────────
const date = ref<string>(new Date().toISOString().slice(0, 10))
const number = ref<string>('')
const status = ref<POStatus>('Open')
const clientName = ref<string>('')
const address = ref<string>('')
const projectNo = ref<string>('')
const agreementNo = ref<string>('')
const shipDate = ref<string>('')
const shipTo = ref<string>('')
const paymentTerms = ref<string>('')
const taxable = ref<boolean>(true)
const taxRate = ref<number>(0)
const notes = ref<string>('')
const linkedClientPoId = ref<string>('')
const linkedOwnerInvoiceId = ref<string>('')

const proposalId = ref<string>('')
const proposalNumber = ref<string>('')
const selectedProposalId = ref<string | null>(null)

function newLineItem(): POLineItem {
  return { id: Math.random().toString(36).slice(2), job_code: null, description: '', qty: null, rate: 0, amount: 0 }
}
const lineItems = ref<POLineItem[]>([newLineItem()])

const statusOptions = PO_STATUSES.map((s) => ({ label: s, value: s }))

// ── Dirty tracking ────────────────────────────────────────────────────────────
const isDirty = ref(false)
let suppressDirty = false
function markClean() { suppressDirty = true; queueMicrotask(() => { isDirty.value = false; suppressDirty = false }) }

watch(
  [date, number, status, clientName, address, projectNo, agreementNo, shipDate, shipTo,
    paymentTerms, taxable, taxRate, notes, linkedClientPoId, linkedOwnerInvoiceId, lineItems],
  () => { if (!suppressDirty) isDirty.value = true },
  { deep: true },
)

// ── Line item helpers ─────────────────────────────────────────────────────────
function addLineItem() { lineItems.value.push(newLineItem()) }
function removeLineItem(id: string) { lineItems.value = lineItems.value.filter((i) => i.id !== id) }

function computeAmount(qty: number | null, rate: number): number {
  return qty === null || qty === undefined ? rate : qty * rate
}
function isRowTouched(i: POLineItem): boolean {
  return !!(i.description.trim() || i.job_code || i.qty !== null || i.rate !== 0)
}
const subtotal = computed(() => lineItems.value.reduce((s, i) => s + computeAmount(i.qty, i.rate), 0))
const salesTax = computed(() => (taxable.value ? subtotal.value * taxRate.value : 0))
const total = computed(() => subtotal.value + salesTax.value)

// ── Tax rate percent display ──────────────────────────────────────────────────
const taxRatePercentDisplay = ref<string>('0')
watch(taxRate, (v) => {
  const pct = v * 100
  const current = Number(taxRatePercentDisplay.value)
  if (taxRatePercentDisplay.value === '' || !Number.isFinite(current) || Math.abs(current - pct) > 1e-6) {
    taxRatePercentDisplay.value = pct === 0 ? '0' : (Math.round(pct * 1000) / 1000).toString()
  }
}, { immediate: true })

function onTaxRateInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  taxRatePercentDisplay.value = raw
  const v = Number(raw)
  taxRate.value = isNaN(v) ? 0 : Math.round((v / 100) * 100000) / 100000
}
function onTaxableToggle(v: boolean) {
  taxable.value = v
  if (!v) taxRate.value = 0
}

// ── Payment terms (config list) ───────────────────────────────────────────────
const { items: paymentTermItems } = useConfigList('payment_terms')
const paymentTermsOptions = computed(() => paymentTermItems.value.map((i) => ({ label: i.label, value: i.label })))

// ── Counterparty picker ───────────────────────────────────────────────────────
const { data: allContactsData } = useAllContacts()
const { data: allContractorsData } = useAllContractors()
const allContacts = computed<ContactRow[]>(() =>
  (isReceived.value ? allContactsData.value : allContractorsData.value) ?? [],
)
const selectedContactId = ref<string | null>(null)

function contactPrimary(c: ContactRow): string {
  const parts = [c.name, c.business_name].filter(Boolean)
  return parts.length ? parts.join(' — ') : (c.facility || c.address || '(unnamed contact)')
}
function contactSecondary(c: ContactRow): string {
  const parts: string[] = []
  if (c.facility) parts.push(c.facility)
  const addr = c.address_full || [c.address, c.city, c.state].filter(Boolean).join(', ')
  if (addr) parts.push(addr)
  return parts.join(' · ')
}
const contactOptions = computed(() =>
  allContacts.value.map((c) => {
    const primary = contactPrimary(c)
    const secondary = contactSecondary(c)
    return { value: c.id, primary, secondary, label: [primary, secondary, c.department, c.title].filter(Boolean).join(' ') }
  }),
)

function onContactPicked(val: unknown) {
  const id = (val as string | null | undefined) ?? null
  selectedContactId.value = id
  if (!id) { clientName.value = ''; address.value = ''; return }
  const c = allContacts.value.find((x) => x.id === id)
  if (!c) return
  clientName.value = c.name ?? ''
  address.value = c.address_full ?? c.address ?? ''
}

// Rehydrate picker selection on edit-load (match by name + address).
watch(
  [allContacts, clientName, address],
  ([rows, name, addr]) => {
    if (selectedContactId.value) return
    if (!rows.length || !name) return
    const match = rows.find((c) => c.name === name && (!addr || c.address_full === addr || c.address === addr))
    if (match) selectedContactId.value = match.id
  },
  { immediate: true },
)

// ── Proposal link + autofill (§4.4) ───────────────────────────────────────────
// Options: received PO → issued proposals; issued PO → received proposals.
const proposalListParams = computed<ProposalListParams>(() => ({
  direction: isReceived.value ? 'issued' : 'received',
  page: 1,
  page_size: 1000,
}))
const { data: proposalListData } = useProposalList(proposalListParams)
const proposalOptions = computed(() =>
  (proposalListData.value?.items ?? []).map((p) => ({ value: p.id, label: p.number })),
)

// Full proposal fetch drives autofill once the user confirms.
const autofillProposalId = ref<string>('')
const { data: autofillProposal } = useProposal(autofillProposalId)
const pendingProposalId = ref<string | null>(null)
const showAutofillConfirm = ref(false)

function onProposalPicked(val: unknown) {
  const id = (val as string | null | undefined) ?? null
  if (!id) {
    selectedProposalId.value = null
    proposalId.value = ''
    proposalNumber.value = ''
    return
  }
  const hasEntries = lineItems.value.some(isRowTouched) || !!clientName.value || !!address.value
  if (hasEntries && isDirty.value) {
    pendingProposalId.value = id
    showAutofillConfirm.value = true
  } else {
    applyProposalSelection(id)
  }
}

function applyProposalSelection(id: string) {
  const opt = proposalOptions.value.find((o) => o.value === id)
  selectedProposalId.value = id
  proposalId.value = id
  proposalNumber.value = opt?.label ?? ''
  autofillProposalId.value = id  // triggers the full fetch → watcher autofills
}

watch(autofillProposal, (p) => {
  if (p && autofillProposalId.value === p.id) applyAutofill(p as Proposal)
})

function applyAutofill(p: Proposal) {
  // Capture the number straight from the record — the option list that
  // applyProposalSelection reads may not be loaded yet on a ?from_proposal mount.
  proposalId.value = p.id
  proposalNumber.value = p.number
  selectedProposalId.value = p.id
  // Standard copies client name; MP has no client — user fills it manually.
  if (p.type === 'Standard') {
    clientName.value = p.client_name ?? ''
    address.value = p.address ?? ''
    projectNo.value = p.project_no ?? ''
    agreementNo.value = p.agreement_no ?? ''
  } else {
    address.value = p.address ?? ''
    projectNo.value = p.project_no ?? ''
  }
  taxable.value = p.taxable
  taxRate.value = p.tax_rate
  notes.value = p.notes ?? ''

  if (p.type === 'Standard') {
    lineItems.value = (p.line_items as StandardLineItem[]).map((li) => ({
      id: Math.random().toString(36).slice(2),
      job_code: li.job_code,
      description: li.description,
      qty: li.qty,
      rate: li.rate,
      amount: 0,
    }))
  } else {
    lineItems.value = (p.line_items as MPLineItem[]).map((li) => ({
      id: Math.random().toString(36).slice(2),
      job_code: 'Medical Physics Services',
      description: li.services,
      qty: li.hours_estimated,
      rate: li.hourly_rate ?? 0,
      amount: 0,
    }))
  }
  if (!lineItems.value.length) lineItems.value = [newLineItem()]
  // Re-sync picker to the autofilled counterparty.
  selectedContactId.value = null
}

function onAutofillConfirm() {
  showAutofillConfirm.value = false
  if (pendingProposalId.value) applyProposalSelection(pendingProposalId.value)
  pendingProposalId.value = null
}
function onAutofillCancel() {
  showAutofillConfirm.value = false
  pendingProposalId.value = null
}

// ── Client PO options (issued engagement link) ────────────────────────────────
const clientPoParams = computed<POListParams>(() => ({
  direction: 'received', page: 1, page_size: 1000,
}))
const { data: clientPoData } = usePOList(clientPoParams)
const clientPoOptions = computed(() =>
  (clientPoData.value?.items ?? []).map((po) => ({ value: po.id, label: `${po.number} — ${po.client_name}` })),
)

// ── Next PO number (issued, create only) ──────────────────────────────────────
const { data: nextNumber } = useNextPONumber()
watch(nextNumber, (v) => {
  if (v && !isEdit && !isReceived.value && !number.value) {
    number.value = v
    markClean()
  }
}, { immediate: true })

// ── Load existing PO for edit ─────────────────────────────────────────────────
const { data: existingPO } = usePO(poId)
watch(existingPO, (p) => {
  if (!p || !isEdit) return
  direction.value = p.direction
  date.value = p.date
  number.value = p.number
  status.value = p.status
  clientName.value = p.client_name
  address.value = p.address ?? ''
  projectNo.value = p.project_no ?? ''
  agreementNo.value = p.agreement_no ?? ''
  shipDate.value = p.ship_date ?? ''
  shipTo.value = p.ship_to ?? ''
  paymentTerms.value = p.payment_terms ?? ''
  taxable.value = p.taxable
  taxRate.value = p.tax_rate
  notes.value = p.notes ?? ''
  linkedClientPoId.value = p.linked_client_po_id ?? ''
  linkedOwnerInvoiceId.value = p.linked_owner_invoice_id ?? ''
  proposalId.value = p.proposal_id ?? ''
  proposalNumber.value = p.proposal_number ?? ''
  selectedProposalId.value = p.proposal_id ?? null
  lineItems.value = p.line_items.length
    ? p.line_items.map((li) => ({ ...li }))
    : [newLineItem()]
  markClean()
}, { immediate: true })

// ── Mount-time autofill from ?from_proposal (accepted-proposal prompt, §4.4) ───
if (!isEdit && typeof route.query.from_proposal === 'string' && route.query.from_proposal) {
  applyProposalSelection(route.query.from_proposal)
}

// ── Validation ────────────────────────────────────────────────────────────────
const errors = ref<Record<string, string>>({})
function validate(): boolean {
  const e: Record<string, string> = {}
  if (!date.value) e.date = 'Date is required'
  if (!number.value.trim()) e.number = 'PO # is required'
  if (!clientName.value.trim()) e.clientName = `${counterpartyLabel.value} Name is required`
  if (!address.value.trim()) e.address = 'Address is required'
  const touched = lineItems.value.filter(isRowTouched)
  if (!touched.length) e.lineItems = 'Add at least one line item'
  else if (touched.some((i) => !i.description.trim())) e.lineItems = 'Every line item needs a description'
  errors.value = e
  return Object.keys(e).length === 0
}

// ── Save ──────────────────────────────────────────────────────────────────────
const saveLoading = ref(false)
const showCancelConfirm = ref(false)
const showDuplicateConfirm = ref(false)
const { mutateAsync: createPO } = useCreatePO()
const { mutateAsync: updatePO } = useUpdatePO()

function buildPayload(): POPayload {
  return {
    number: number.value,
    direction: direction.value,
    status: status.value,
    date: date.value,
    proposal_id: proposalId.value || undefined,
    proposal_number: proposalNumber.value || undefined,
    client_name: clientName.value,
    address: address.value || undefined,
    project_no: projectNo.value || undefined,
    agreement_no: agreementNo.value || undefined,
    ship_date: shipDate.value || undefined,
    ship_to: shipTo.value || undefined,
    payment_terms: paymentTerms.value || undefined,
    taxable: taxable.value,
    tax_rate: taxable.value ? taxRate.value : 0,
    line_items: lineItems.value
      .filter(isRowTouched)
      .map(({ id: _id, amount: _a, ...rest }) => rest),
    notes: notes.value || undefined,
    // Engagement links apply to issued POs only (both optional).
    ...(direction.value === 'issued'
      ? {
          linked_client_po_id: linkedClientPoId.value || undefined,
          linked_owner_invoice_id: linkedOwnerInvoiceId.value || undefined,
        }
      : {}),
  }
}

async function handleSave() {
  if (!validate()) return
  await doSave()
}

async function doSave() {
  saveLoading.value = true
  try {
    const payload = buildPayload()
    const saved = isEdit
      ? await updatePO({ id: poId.value, payload })
      : await createPO(payload)
    isDirty.value = false
    router.push({ name: 'po-detail', params: { id: saved.id } })
  } catch (err: unknown) {
    const e = err as { status?: number }
    if (e?.status === 409) showDuplicateConfirm.value = true
  } finally {
    saveLoading.value = false
  }
}

function onDuplicateReplace() {
  showDuplicateConfirm.value = false
  doSave()
}

function handleCancel() {
  if (isDirty.value) showCancelConfirm.value = true
  else router.back()
}
</script>

<style scoped>
.po-form { display: flex; flex-direction: column; gap: 20px; padding: 24px; }

.po-form__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  position: sticky;
  top: 0;
  background: var(--color-bg-page, #f8fafc);
  padding-bottom: 8px;
  z-index: 10;
}
.po-form__header-left { display: flex; align-items: center; gap: 12px; }
.po-form__title { font-size: 20px; font-weight: 800; }
.po-form__direction-chip {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  padding: 3px 10px;
}
.po-form__header-actions { display: flex; align-items: center; gap: 8px; }

.po-form__body { display: flex; flex-direction: column; gap: 20px; }
.po-form__section { display: flex; flex-direction: column; gap: 16px; }
.po-form__section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.po-form__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  align-items: start;
}
.po-form__tax-row { display: flex; align-items: flex-end; gap: 24px; flex-wrap: wrap; }
.po-form__toggle { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; cursor: pointer; padding-bottom: 8px; }
.po-form__tax-rate { width: 180px; }
.po-form__optional { font-weight: 500; text-transform: none; letter-spacing: 0; color: var(--color-text-subtle); }
.po-form__hint { font-size: 12.5px; color: var(--color-text-subtle); margin: -4px 0 0; }

.contact-option { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.contact-option__primary {
  font-size: 13px; font-weight: 500; color: var(--color-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.contact-option__secondary {
  font-size: 11.5px; color: var(--color-text-subtle);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

@media (max-width: 700px) { .po-form { padding: 16px; } }
</style>
