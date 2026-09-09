<template>
  <div class="inv-form">
    <!-- Header -->
    <div class="inv-form__header">
      <div class="inv-form__header-left">
        <button class="btn btn--ghost btn--sm" type="button" @click="handleCancel">← Back</button>
        <h1 class="inv-form__title">{{ isEdit ? `Edit ${number || ''}` : 'New Invoice' }}</h1>
        <span class="inv-form__direction-chip">{{ isReceived ? 'Received (Contractor)' : 'Issued (Client)' }}</span>
      </div>
      <div class="inv-form__header-actions">
        <button class="btn btn--ghost btn--sm" type="button" @click="handleCancel">Cancel</button>
        <button class="btn btn--primary btn--sm" type="button" :disabled="saveLoading" @click="handleSave">
          {{ saveLoading ? 'Saving…' : 'Save Invoice' }}
        </button>
      </div>
    </div>

    <div class="inv-form__body">
      <!-- Header fields -->
      <div class="inv-form__section card card--padded">
        <h2 class="inv-form__section-title">Header</h2>
        <div class="inv-form__grid">
          <BaseDatePicker v-model="date" label="Date" required :error="errors.date" />
          <BaseInput
            v-model="number"
            label="Invoice #"
            required
            :error="errors.number"
            :placeholder="isReceived ? 'Contractor\'s invoice number' : 'INV-260000'"
          />
          <ComboSelect
            v-model="status"
            label="Status"
            :options="statusOptions"
            optionLabel="label"
            optionValue="value"
          />
          <ComboSelect
            :modelValue="selectedPoId"
            label="PO #"
            :options="poOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Link a PO…"
            searchable
            showClear
            filterPlaceholder="Search POs…"
            @update:modelValue="onPoPicked"
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
          <ComboSelect
            v-model="paymentTerms"
            label="Payment Terms"
            :options="paymentTermsOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select terms…"
            showClear
          />
          <div class="field">
            <label class="field__label">Due Date</label>
            <input class="field__input" type="text" :value="dueDateDisplay" disabled />
          </div>
        </div>
      </div>

      <!-- Engagement link (received only, at least one required) -->
      <div v-if="isReceived" class="inv-form__section card card--padded">
        <h2 class="inv-form__section-title">Engagement Link <span class="inv-form__required-tag">(one required)</span></h2>
        <p class="inv-form__hint">Link this contractor invoice to a Client PO or one of your Invoices.</p>
        <span v-if="errors.engagement" class="field__error">{{ errors.engagement }}</span>
        <div class="inv-form__grid">
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
          <ComboSelect
            v-model="linkedOwnerInvoiceId"
            label="Owner Invoice"
            :options="ownerInvoiceOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select one of your Invoices…"
            searchable
            showClear
            filterPlaceholder="Search your invoices…"
          />
        </div>
      </div>

      <!-- Line items -->
      <div class="inv-form__section card card--padded">
        <h2 class="inv-form__section-title">Line Items</h2>
        <span v-if="errors.lineItems" class="field__error">{{ errors.lineItems }}</span>
        <LineItemsTable :items="lineItems" variant="Standard" @add="addLineItem" @remove="removeLineItem" />
      </div>

      <!-- Tax & totals -->
      <div class="inv-form__section card card--padded">
        <h2 class="inv-form__section-title">Tax &amp; Totals</h2>
        <div class="inv-form__tax-row">
          <label class="inv-form__toggle">
            <input type="checkbox" :checked="taxable" @change="onTaxableToggle(($event.target as HTMLInputElement).checked)" />
            <span>Taxable</span>
          </label>
          <div class="field inv-form__tax-rate">
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
          <div class="field inv-form__payments">
            <label class="field__label">Payments / Credits</label>
            <input
              class="field__input"
              type="number"
              step="0.01"
              min="0"
              :value="paymentsCredits"
              @input="onPaymentsInput($event)"
            />
          </div>
        </div>

        <div class="inv-form__totals">
          <TotalsCards variant="Standard" :subtotal="subtotal" :salesTax="salesTax" :taxRate="taxRate" :total="total" />
          <div class="inv-form__extra-cards">
            <div class="inv-form__card">
              <div class="inv-form__card-label">Payments / Credits</div>
              <div class="inv-form__card-value">{{ formatCurrency(paymentsCredits) }}</div>
            </div>
            <div class="inv-form__card inv-form__card--balance">
              <div class="inv-form__card-label">Balance Due</div>
              <div class="inv-form__card-value">{{ formatCurrency(balanceDue) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="inv-form__section card card--padded">
        <h2 class="inv-form__section-title">Notes</h2>
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
      title="Invoice number exists"
      :message="`An invoice with number ${number} already exists. Replace it?`"
      confirmLabel="Replace"
      cancelLabel="Cancel"
      variant="danger"
      @confirm="onDuplicateReplace"
      @cancel="showDuplicateConfirm = false"
    />

    <!-- PO autofill overwrite confirm -->
    <ConfirmModal
      v-model:visible="showAutofillConfirm"
      title="Replace form with PO data?"
      message="Selecting this PO will overwrite the header fields and line items you've entered. Continue?"
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
import { useProposalList } from '../../api/proposals'
import { usePOList, usePO } from '../../api/purchaseOrders'
import {
  useInvoice,
  useInvoiceList,
  useCreateInvoice,
  useUpdateInvoice,
  useNextInvoiceNumber,
} from '../../api/invoices'
import { useAllContacts, type ContactRow } from '../../api/clients'
import { useAllContractors } from '../../api/contractors'
import { useConfigList } from '../../composables/useConfigList'
import {
  INVOICE_STATUSES,
  defaultInvoiceStatus,
  computeBalanceDue,
  computeDueDate,
  suggestStatus,
} from '../../types/invoice'
import type { InvoiceLineItem, InvoicePayload, InvoiceStatus } from '../../types/invoice'
import type { POListParams, PurchaseOrder } from '../../types/purchaseOrder'
import type { DocDirection } from '../../types/common'
import type { ProposalListParams } from '../../types/proposal'
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
const invoiceId = ref<string>((route.params.id as string) || '')

// Direction: create → ?direction= (default issued, the clients-side flow);
// edit → restored from the record (locked). Issued = clients side.
const direction = ref<DocDirection>(route.query.direction === 'received' ? 'received' : 'issued')
const isReceived = computed(() => direction.value === 'received')
const counterpartyLabel = computed(() => (isReceived.value ? 'Contractor' : 'Client'))

// ── Form state ────────────────────────────────────────────────────────────────
const date = ref<string>(new Date().toISOString().slice(0, 10))
const number = ref<string>('')
const status = ref<InvoiceStatus>(defaultInvoiceStatus(direction.value))
const clientName = ref<string>('')
const address = ref<string>('')
const projectNo = ref<string>('')
const agreementNo = ref<string>('')
const shipDate = ref<string>('')
const paymentTerms = ref<string>('')
const taxable = ref<boolean>(true)
const taxRate = ref<number>(0)
const paymentsCredits = ref<number>(0)
const notes = ref<string>('')
const linkedClientPoId = ref<string>('')
const linkedOwnerInvoiceId = ref<string>('')

const poId = ref<string>('')
const poNumber = ref<string>('')
const proposalId = ref<string>('')
const proposalNumber = ref<string>('')
const selectedPoId = ref<string | null>(null)
const selectedProposalId = ref<string | null>(null)

function newLineItem(): InvoiceLineItem {
  return { id: Math.random().toString(36).slice(2), job_code: null, description: '', qty: null, rate: 0, amount: 0 }
}
const lineItems = ref<InvoiceLineItem[]>([newLineItem()])

const statusOptions = computed(() => INVOICE_STATUSES[direction.value].map((s) => ({ label: s, value: s })))

// ── Dirty tracking ────────────────────────────────────────────────────────────
const isDirty = ref(false)
let suppressDirty = false
function markClean() { suppressDirty = true; queueMicrotask(() => { isDirty.value = false; suppressDirty = false }) }

watch(
  [date, number, status, clientName, address, projectNo, agreementNo, shipDate, paymentTerms,
    taxable, taxRate, paymentsCredits, notes, linkedClientPoId, linkedOwnerInvoiceId, lineItems],
  () => { if (!suppressDirty) isDirty.value = true },
  { deep: true },
)

// ── Line items ────────────────────────────────────────────────────────────────
function addLineItem() { lineItems.value.push(newLineItem()) }
function removeLineItem(id: string) { lineItems.value = lineItems.value.filter((i) => i.id !== id) }
function computeAmount(qty: number | null, rate: number): number {
  return qty === null || qty === undefined ? rate : qty * rate
}
function isRowTouched(i: InvoiceLineItem): boolean {
  return !!(i.description.trim() || i.job_code || i.qty !== null || i.rate !== 0)
}
const subtotal = computed(() => lineItems.value.reduce((s, i) => s + computeAmount(i.qty, i.rate), 0))
const salesTax = computed(() => (taxable.value ? subtotal.value * taxRate.value : 0))
const total = computed(() => subtotal.value + salesTax.value)
const balanceDue = computed(() => computeBalanceDue(total.value, paymentsCredits.value))

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

// ── Payments/Credits → status suggestion (§13.3, advisory) ────────────────────
function onPaymentsInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  const v = Number(raw)
  paymentsCredits.value = isNaN(v) ? 0 : v
  // Suggest a status but let the user override afterwards. Never override a
  // manually-picked Draft on an issued invoice with no payment yet.
  if (!(status.value === 'Draft' && paymentsCredits.value <= 0)) {
    status.value = suggestStatus(paymentsCredits.value, total.value, direction.value)
  }
}

// ── Payment terms + due date ──────────────────────────────────────────────────
const { items: paymentTermItems } = useConfigList('payment_terms')
const paymentTermsOptions = computed(() => paymentTermItems.value.map((i) => ({ label: i.label, value: i.label })))
function termDelay(label: string): number {
  return paymentTermItems.value.find((i) => i.label === label)?.delay_days ?? 0
}
const dueDate = computed(() => (date.value && paymentTerms.value ? computeDueDate(date.value, termDelay(paymentTerms.value)) : date.value))
const dueDateDisplay = computed(() => (dueDate.value ? new Date(dueDate.value + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'))

// ── Counterparty picker ───────────────────────────────────────────────────────
const { data: allContactsData } = useAllContacts()
const { data: allContractorsData } = useAllContractors()
const allContacts = computed<ContactRow[]>(() =>
  (isReceived.value ? allContractorsData.value : allContactsData.value) ?? [],
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

// ── PO link + autofill (§5.3) ─────────────────────────────────────────────────
// Options: issued invoice → received POs; received invoice → issued POs.
const poListParams = computed<POListParams>(() => ({
  direction: isReceived.value ? 'issued' : 'received', page: 1, page_size: 1000,
}))
const { data: poListData } = usePOList(poListParams)
const poOptions = computed(() => (poListData.value?.items ?? []).map((p) => ({ value: p.id, label: p.number })))

const autofillPoId = ref<string>('')
const { data: autofillPo } = usePO(autofillPoId)
const pendingPoId = ref<string | null>(null)
const showAutofillConfirm = ref(false)

function onPoPicked(val: unknown) {
  const id = (val as string | null | undefined) ?? null
  if (!id) {
    selectedPoId.value = null
    poId.value = ''
    poNumber.value = ''
    return
  }
  const hasEntries = lineItems.value.some(isRowTouched) || !!clientName.value || !!address.value
  if (hasEntries && isDirty.value) {
    pendingPoId.value = id
    showAutofillConfirm.value = true
  } else {
    applyPoSelection(id)
  }
}
function applyPoSelection(id: string) {
  const opt = poOptions.value.find((o) => o.value === id)
  selectedPoId.value = id
  poId.value = id
  poNumber.value = opt?.label ?? ''
  autofillPoId.value = id
}
watch(autofillPo, (p) => {
  if (p && autofillPoId.value === p.id) applyAutofill(p as PurchaseOrder)
})
function applyAutofill(p: PurchaseOrder) {
  proposalId.value = p.proposal_id ?? ''
  proposalNumber.value = p.proposal_number ?? ''
  selectedProposalId.value = p.proposal_id ?? null
  clientName.value = p.client_name
  address.value = p.address ?? ''
  projectNo.value = p.project_no ?? ''
  agreementNo.value = p.agreement_no ?? ''
  shipDate.value = p.ship_date ?? ''
  paymentTerms.value = p.payment_terms ?? ''
  taxable.value = p.taxable
  taxRate.value = p.tax_rate
  notes.value = p.notes ?? ''
  lineItems.value = p.line_items.length
    ? p.line_items.map((li) => ({
        id: Math.random().toString(36).slice(2),
        job_code: li.job_code,
        description: li.description,
        qty: li.qty,
        rate: li.rate,
        amount: 0,
      }))
    : [newLineItem()]
  selectedContactId.value = null
}
function onAutofillConfirm() {
  showAutofillConfirm.value = false
  if (pendingPoId.value) applyPoSelection(pendingPoId.value)
  pendingPoId.value = null
}
function onAutofillCancel() {
  showAutofillConfirm.value = false
  pendingPoId.value = null
}

// ── Proposal link (manual, when no PO) ────────────────────────────────────────
const proposalListParams = computed<ProposalListParams>(() => ({
  direction: isReceived.value ? 'received' : 'issued', page: 1, page_size: 1000,
}))
const { data: proposalListData } = useProposalList(proposalListParams)
const proposalOptions = computed(() =>
  (proposalListData.value?.items ?? []).map((p) => ({ value: p.id, label: p.number })),
)
function onProposalPicked(val: unknown) {
  const id = (val as string | null | undefined) ?? null
  selectedProposalId.value = id
  if (!id) { proposalId.value = ''; proposalNumber.value = ''; return }
  const opt = proposalOptions.value.find((o) => o.value === id)
  proposalId.value = id
  proposalNumber.value = opt?.label ?? ''
}

// ── Engagement-link options (received) ────────────────────────────────────────
const receivedPoParams = computed<POListParams>(() => ({ direction: 'received', page: 1, page_size: 1000 }))
const { data: receivedPoData } = usePOList(receivedPoParams)
const clientPoOptions = computed(() =>
  (receivedPoData.value?.items ?? []).map((po) => ({ value: po.id, label: `${po.number} — ${po.client_name}` })),
)
const issuedInvoiceParams = computed(() => ({ direction: 'issued' as DocDirection, page: 1, page_size: 1000 }))
const { data: issuedInvoiceData } = useInvoiceList(issuedInvoiceParams)
const ownerInvoiceOptions = computed(() =>
  (issuedInvoiceData.value?.items ?? [])
    .filter((inv) => inv.id !== invoiceId.value)
    .map((inv) => ({ value: inv.id, label: `${inv.number} — ${inv.client_name}` })),
)

// ── Next invoice number (issued, create only) ─────────────────────────────────
const { data: nextNumber } = useNextInvoiceNumber()
watch(nextNumber, (v) => {
  if (v && !isEdit && !isReceived.value && !number.value) {
    number.value = v
    markClean()
  }
}, { immediate: true })

// ── Load existing invoice for edit ────────────────────────────────────────────
const { data: existingInvoice } = useInvoice(invoiceId)
watch(existingInvoice, (inv) => {
  if (!inv || !isEdit) return
  direction.value = inv.direction
  date.value = inv.date
  number.value = inv.number
  status.value = inv.status
  clientName.value = inv.client_name
  address.value = inv.address ?? ''
  projectNo.value = inv.project_no ?? ''
  agreementNo.value = inv.agreement_no ?? ''
  shipDate.value = inv.ship_date ?? ''
  paymentTerms.value = inv.payment_terms ?? ''
  taxable.value = inv.taxable
  taxRate.value = inv.tax_rate
  paymentsCredits.value = inv.payments_credits
  notes.value = inv.notes ?? ''
  linkedClientPoId.value = inv.linked_client_po_id ?? ''
  linkedOwnerInvoiceId.value = inv.linked_owner_invoice_id ?? ''
  poId.value = inv.po_id ?? ''
  poNumber.value = inv.po_number ?? ''
  selectedPoId.value = inv.po_id ?? null
  proposalId.value = inv.proposal_id ?? ''
  proposalNumber.value = inv.proposal_number ?? ''
  selectedProposalId.value = inv.proposal_id ?? null
  lineItems.value = inv.line_items.length ? inv.line_items.map((li) => ({ ...li })) : [newLineItem()]
  markClean()
}, { immediate: true })

// ── Mount-time autofill from ?from_po (§5.3) ──────────────────────────────────
if (!isEdit && typeof route.query.from_po === 'string' && route.query.from_po) {
  applyPoSelection(route.query.from_po)
}

// ── Validation ────────────────────────────────────────────────────────────────
const errors = ref<Record<string, string>>({})
function validate(): boolean {
  const e: Record<string, string> = {}
  if (!date.value) e.date = 'Date is required'
  if (!number.value.trim()) e.number = 'Invoice # is required'
  if (!clientName.value.trim()) e.clientName = `${counterpartyLabel.value} Name is required`
  if (!address.value.trim()) e.address = 'Address is required'
  const touched = lineItems.value.filter(isRowTouched)
  if (!touched.length) e.lineItems = 'Add at least one line item'
  else if (touched.some((i) => !i.description.trim())) e.lineItems = 'Every line item needs a description'
  // Received invoices: at least one engagement link (§5.2).
  if (isReceived.value && !linkedClientPoId.value && !linkedOwnerInvoiceId.value) {
    e.engagement = 'Link this contractor invoice to a Client PO or one of your Invoices.'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

// ── Save ──────────────────────────────────────────────────────────────────────
const saveLoading = ref(false)
const showCancelConfirm = ref(false)
const showDuplicateConfirm = ref(false)
const { mutateAsync: createInvoice } = useCreateInvoice()
const { mutateAsync: updateInvoice } = useUpdateInvoice()

function buildPayload(): InvoicePayload {
  return {
    number: number.value,
    direction: direction.value,
    status: status.value,
    date: date.value,
    po_id: poId.value || undefined,
    po_number: poNumber.value || undefined,
    proposal_id: proposalId.value || undefined,
    proposal_number: proposalNumber.value || undefined,
    client_name: clientName.value,
    address: address.value || undefined,
    project_no: projectNo.value || undefined,
    agreement_no: agreementNo.value || undefined,
    ship_date: shipDate.value || undefined,
    payment_terms: paymentTerms.value || undefined,
    taxable: taxable.value,
    tax_rate: taxable.value ? taxRate.value : 0,
    payments_credits: paymentsCredits.value || 0,
    line_items: lineItems.value.filter(isRowTouched).map(({ id: _id, amount: _a, ...rest }) => rest),
    notes: notes.value || undefined,
    // Engagement links apply to received invoices (at least one required).
    ...(direction.value === 'received'
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
      ? await updateInvoice({ id: invoiceId.value, payload })
      : await createInvoice(payload)
    isDirty.value = false
    router.push({ name: 'invoice-detail', params: { id: saved.id } })
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
</script>

<style scoped>
.inv-form { display: flex; flex-direction: column; gap: 20px; padding: 24px; }
.inv-form__header {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
  position: sticky; top: 0; background: var(--color-bg-page, #f8fafc); padding-bottom: 8px; z-index: 10;
}
.inv-form__header-left { display: flex; align-items: center; gap: 12px; }
.inv-form__title { font-size: 20px; font-weight: 800; }
.inv-form__direction-chip {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--color-text-muted); background: var(--color-bg-subtle);
  border: 1px solid var(--color-border); border-radius: 9999px; padding: 3px 10px;
}
.inv-form__header-actions { display: flex; align-items: center; gap: 8px; }

.inv-form__body { display: flex; flex-direction: column; gap: 20px; }
.inv-form__section { display: flex; flex-direction: column; gap: 16px; }
.inv-form__section-title {
  font-size: 14px; font-weight: 700; color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: 0.06em;
}
.inv-form__grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; align-items: start;
}
.inv-form__tax-row { display: flex; align-items: flex-end; gap: 24px; flex-wrap: wrap; }
.inv-form__toggle { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; cursor: pointer; padding-bottom: 8px; }
.inv-form__tax-rate, .inv-form__payments { width: 180px; }
.inv-form__required-tag { font-weight: 500; text-transform: none; letter-spacing: 0; color: var(--color-error); }
.inv-form__hint { font-size: 12.5px; color: var(--color-text-subtle); margin: -4px 0 0; }

.inv-form__totals { display: flex; flex-direction: column; gap: 12px; align-items: flex-end; }
.inv-form__extra-cards { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
.inv-form__card {
  background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px;
  padding: 14px 20px; min-width: 130px; text-align: right;
}
.inv-form__card--balance { border-color: var(--color-primary); background: rgba(29, 78, 216, 0.04); }
.inv-form__card-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--color-text-subtle); margin-bottom: 4px;
}
.inv-form__card-value { font-size: 18px; font-weight: 700; color: var(--color-text); font-variant-numeric: tabular-nums; }
.inv-form__card--balance .inv-form__card-value { color: var(--color-primary); }

.contact-option { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.contact-option__primary {
  font-size: 13px; font-weight: 500; color: var(--color-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.contact-option__secondary {
  font-size: 11.5px; color: var(--color-text-subtle);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

@media (max-width: 700px) { .inv-form { padding: 16px; } }
</style>
