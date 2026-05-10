<template>
  <div class="proposal-form">
    <!-- Header -->
    <div class="proposal-form__header">
      <div class="proposal-form__header-left">
        <button class="btn btn--ghost btn--sm" type="button" @click="handleCancel">← Back</button>
        <h1 class="proposal-form__title">{{ isEdit ? `Edit ${form.number.value || ''}` : 'New Proposal' }}</h1>
      </div>
      <div class="proposal-form__header-actions">
        <button class="btn btn--ghost btn--sm" type="button" @click="handleCancel">Cancel</button>
        <button
          class="btn btn--primary btn--sm"
          type="button"
          :disabled="saveLoading"
          @click="handleSave"
        >
          {{ saveLoading ? 'Saving…' : 'Save Proposal' }}
        </button>
      </div>
    </div>

    <!-- Form body -->
    <div class="proposal-form__body">

      <!-- ═══════════════════════════════════════════════════════════════════
           SECTION: Header fields
           ═══════════════════════════════════════════════════════════════════ -->
      <div class="proposal-form__section card card--padded">
        <h2 class="proposal-form__section-title">Header</h2>

        <div class="proposal-form__grid">
          <!-- Date -->
          <BaseDatePicker
            v-model="form.date.value"
            label="Date"
            required
            :error="form.errors.value.date"
          />

          <!-- Proposal # -->
          <BaseInput
            v-model="form.number.value"
            label="Proposal #"
            required
            :error="form.errors.value.number"
          />

          <!-- Type (locked after first save) -->
          <div class="field">
            <label class="field__label">Type <span class="field__required">*</span></label>
            <div class="proposal-form__type-toggle">
              <button
                type="button"
                :class="['btn btn--sm', form.type.value === 'Standard' ? 'btn--primary' : 'btn--secondary']"
                :disabled="form.typeLocked.value"
                :title="form.typeLocked.value ? 'Type cannot be changed after first save' : ''"
                @click="form.type.value = 'Standard'"
              >Standard</button>
              <button
                type="button"
                :class="['btn btn--sm', form.type.value === 'MP' ? 'btn--primary' : 'btn--secondary']"
                :disabled="form.typeLocked.value"
                :title="form.typeLocked.value ? 'Type cannot be changed after first save' : ''"
                @click="form.type.value = 'MP'"
              >MP</button>
            </div>
          </div>

          <!-- Status -->
          <BaseSelect
            v-model="form.status.value"
            label="Status"
            :options="STATUS_OPTIONS"
          />
        </div>

        <!-- ── Standard-specific fields ───────────────────────────────────── -->
        <template v-if="form.type.value === 'Standard'">
          <div class="proposal-form__grid">
            <!-- Client Name (combobox) -->
            <div class="field proposal-form__client-field">
              <label class="field__label">Client Name <span class="field__required">*</span></label>
              <div class="proposal-form__autocomplete">
                <input
                  v-model="form.clientName.value"
                  class="field__input"
                  :class="{ 'field__input--error': form.errors.value.clientName }"
                  type="text"
                  placeholder="Type client name…"
                  @input="onClientNameInput"
                  @focus="showClientDropdown = clientNameResults.length > 0"
                  @blur="onClientNameBlur"
                />
                <div v-if="clientNameResults.length && showClientDropdown" class="proposal-form__dropdown">
                  <div
                    v-for="n in clientNameResults"
                    :key="n"
                    class="proposal-form__dropdown-item"
                    @mousedown.prevent="onPickClientName(n)"
                  >{{ n }}</div>
                </div>
              </div>
              <span v-if="form.errors.value.clientName" class="field__error">{{ form.errors.value.clientName }}</span>
            </div>

            <!-- Address (combobox: dropdown if >1 row, free input otherwise) -->
            <div class="field">
              <label class="field__label">Address <span class="field__required">*</span></label>
              <template v-if="form.clientContactOptions.value.length > 1">
                <select
                  class="field__select"
                  :class="{ 'field__input--error': form.errors.value.address }"
                  :value="form.address.value"
                  @change="onAddressSelect($event)"
                >
                  <option value="">Select address…</option>
                  <option
                    v-for="c in form.clientContactOptions.value"
                    :key="c.address"
                    :value="c.address"
                  >{{ c.address }}{{ c.city ? `, ${c.city}` : '' }}{{ c.state ? `, ${c.state}` : '' }}</option>
                </select>
              </template>
              <template v-else>
                <input
                  v-model="form.address.value"
                  class="field__input"
                  :class="{ 'field__input--error': form.errors.value.address }"
                  type="text"
                  placeholder="Address"
                />
              </template>
              <span v-if="form.errors.value.address" class="field__error">{{ form.errors.value.address }}</span>
            </div>

            <!-- Title -->
            <BaseInput v-model="form.title.value" label="Title" />

            <!-- Business Name -->
            <BaseInput v-model="form.businessName.value" label="Business Name" />

            <!-- Department -->
            <BaseInput v-model="form.department.value" label="Department" />

            <!-- Phone -->
            <BaseInput v-model="form.phone.value" label="Phone" />

            <!-- Email -->
            <BaseInput
              v-model="form.email.value"
              label="Email"
              type="email"
              :error="form.errors.value.email"
            />

            <!-- Project No -->
            <BaseInput v-model="form.projectNo.value" label="Project No." />

            <!-- Project Name -->
            <BaseInput v-model="form.projectName.value" label="Project Name" />

            <!-- Agreement No -->
            <BaseInput v-model="form.agreementNo.value" label="Agreement No." />

            <!-- Proposal Valid Till -->
            <BaseDatePicker v-model="form.proposalValidTill.value" label="Proposal Valid Till" />
          </div>
        </template>

        <!-- ── MP-specific fields ──────────────────────────────────────────── -->
        <template v-else>
          <div class="proposal-form__grid">
            <!-- Reference -->
            <BaseInput v-model="form.reference.value" label="Reference" />

            <!-- Project Location (select from mp_destinations) -->
            <div class="field">
              <label class="field__label">Project Location</label>
              <select
                class="field__select"
                :value="form.projectLocation.value"
                @change="onDestinationSelect($event)"
              >
                <option value="">Select location…</option>
                <option
                  v-for="dest in mpDestinations"
                  :key="dest.id"
                  :value="dest.final_destination"
                >{{ dest.final_destination }}</option>
              </select>
            </div>

            <!-- Address (auto-filled from selected location, editable) -->
            <BaseInput v-model="form.address.value" label="Address" />

            <!-- Project Type -->
            <BaseInput v-model="form.projectType.value" label="Project Type" />

            <!-- Project Name -->
            <BaseInput v-model="form.projectName.value" label="Project Name" />
          </div>
        </template>
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════
           SECTION: Line Items
           ═══════════════════════════════════════════════════════════════════ -->
      <div class="proposal-form__section card card--padded">
        <h2 class="proposal-form__section-title">Line Items</h2>
        <span v-if="form.errors.value.lineItems" class="field__error">{{ form.errors.value.lineItems }}</span>

        <LineItemsTable
          v-if="form.type.value === 'Standard'"
          :items="form.computedStandardItems.value"
          variant="Standard"
          @add="form.addStandardItem()"
          @remove="form.removeStandardItem"
        />
        <LineItemsTable
          v-else
          :items="form.computedMPItems.value"
          variant="MP"
          @add="form.addMPItem()"
          @remove="form.removeMPItem"
        />
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════
           SECTION: Tax & Totals
           ═══════════════════════════════════════════════════════════════════ -->
      <div class="proposal-form__section card card--padded">
        <h2 class="proposal-form__section-title">Tax &amp; Totals</h2>

        <div class="proposal-form__tax-row">
          <!-- Taxable toggle -->
          <label class="proposal-form__toggle">
            <input
              type="checkbox"
              :checked="form.taxable.value"
              @change="form.onTaxableToggle(($event.target as HTMLInputElement).checked)"
            />
            <span>Taxable</span>
          </label>

          <!-- Tax Rate -->
          <div class="field proposal-form__tax-rate">
            <label class="field__label">Tax Rate (%)</label>
            <input
              class="field__input"
              :class="{ 'field__input--error': form.errors.value.taxRate }"
              type="number"
              step="0.0001"
              min="0"
              :disabled="!form.taxable.value"
              :value="form.taxRate.value * 100"
              @input="onTaxRateInput($event)"
            />
            <span v-if="form.errors.value.taxRate" class="field__error">{{ form.errors.value.taxRate }}</span>
          </div>
        </div>

        <TotalsCards
          :variant="form.type.value"
          :subtotal="form.subtotal.value"
          :salesTax="form.salesTax.value"
          :taxRate="form.taxRate.value"
          :total="form.total.value"
        />
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════
           SECTION: Notes (both variants)
           ═══════════════════════════════════════════════════════════════════ -->
      <div class="proposal-form__section card card--padded">
        <h2 class="proposal-form__section-title">Notes</h2>
        <RichTextEditor v-model="form.notes.value" />
      </div>

      <!-- ═══════════════════════════════════════════════════════════════════
           SECTION: Services Provided (MP only)
           ═══════════════════════════════════════════════════════════════════ -->
      <div v-if="form.type.value === 'MP'" class="proposal-form__section card card--padded">
        <h2 class="proposal-form__section-title">Services Provided</h2>
        <RichTextEditor v-model="form.servicesProvided.value" />
      </div>

    </div>

    <!-- Cancel dirty-form confirm -->
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
      title="Proposal number exists"
      :message="`A proposal with number ${form.number.value} already exists. Replace it?`"
      confirmLabel="Replace"
      cancelLabel="Cancel"
      variant="danger"
      @confirm="onDuplicateReplace"
      @cancel="showDuplicateConfirm = false"
    />

    <!-- Accepted-status PO prompt -->
    <ConfirmModal
      v-model:visible="showAcceptedPrompt"
      title="Create a linked PO?"
      message="This proposal is being marked Accepted. Create a linked Purchase Order from it?"
      confirmLabel="Create PO"
      cancelLabel="Just save"
      variant="info"
      @confirm="onAcceptedCreatePO"
      @cancel="onAcceptedJustSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProposalForm } from '../../composables/useProposalForm'
import {
  useProposal,
  useCreateProposal,
  useUpdateProposal,
  useNextProposalNumber,
} from '../../api/proposals'
import { useMPDestinations } from '../../api/mpDestinations'
import { useClientNameSearch, useClientLookup } from '../../api/clients'
import { useTaxRateLookup } from '../../api/taxRates'
import BaseInput from '../../components/base/BaseInput.vue'
import BaseSelect from '../../components/base/BaseSelect.vue'
import BaseDatePicker from '../../components/base/BaseDatePicker.vue'
import RichTextEditor from '../../components/base/RichTextEditor.vue'
import ConfirmModal from '../../components/base/ConfirmModal.vue'
import LineItemsTable from './components/LineItemsTable.vue'
import TotalsCards from './components/TotalsCards.vue'
import type { MPDestination, ProposalType } from '../../types/proposal'

const router = useRouter()
const route = useRoute()

const isEdit = !!route.params.id
const proposalId = ref<string>(route.params.id as string || '')

const form = useProposalForm()

// ── MP Destinations ───────────────────────────────────────────────────────────
const { data: mpDestData } = useMPDestinations()
const mpDestinations = ref<MPDestination[]>([])
watch(mpDestData, (v) => { if (v) mpDestinations.value = v }, { immediate: true })

function onDestinationSelect(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  const dest = mpDestinations.value.find((d) => d.final_destination === val)
  if (dest) form.onDestinationSelected(dest)
}

// ── Next proposal number (preview only, prefilled on create) ──────────────────
const typeRef = computed<ProposalType>(() => form.type.value)
const { data: nextNumber } = useNextProposalNumber(typeRef)
watch(nextNumber, (v) => {
  if (v && !isEdit && !form.number.value) {
    form.number.value = v
  }
}, { immediate: true })

// ── Load existing proposal for edit ──────────────────────────────────────────
const { data: existingProposal } = useProposal(proposalId)

watch(existingProposal, (p) => {
  if (p && isEdit) {
    form.loadProposal(p as Parameters<typeof form.loadProposal>[0])
  }
}, { immediate: true })

// ── Client name search ────────────────────────────────────────────────────────

const clientNameQuery = ref('')
const showClientDropdown = ref(false)
const { data: clientNamesData } = useClientNameSearch(clientNameQuery)
const clientNameResults = computed<string[]>(() => clientNamesData.value ?? [])

let searchTimeout: ReturnType<typeof setTimeout> | null = null
function onClientNameInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    clientNameQuery.value = form.clientName.value.trim()
    showClientDropdown.value = !!clientNameQuery.value
  }, 150)
}
function onClientNameBlur() {
  // Slight delay so a click on the dropdown can register
  setTimeout(() => { showClientDropdown.value = false }, 100)
}

// ── Client lookup (on selection) ──────────────────────────────────────────────
const selectedClientName = ref('')
const { data: clientContactsData } = useClientLookup(selectedClientName)
watch(clientContactsData, (rows) => {
  if (rows) form.onClientContactsLoaded(rows)
})

function onPickClientName(name: string) {
  form.clientName.value = name
  selectedClientName.value = name
  showClientDropdown.value = false
}

function onAddressSelect(e: Event) {
  form.onAddressSelected((e.target as HTMLSelectElement).value)
}

// ── Tax-rate lookup (driven by lookupCity / lookupState) ─────────────────────
const { data: taxRateData } = useTaxRateLookup(form.lookupCity, form.lookupState)
watch(taxRateData, (v) => {
  if (typeof v === 'number') form.onTaxRateLoaded(v)
})

function onTaxRateInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  // Field shows %; store as decimal
  form.onTaxRateUserEdit(isNaN(v) ? 0 : v / 100)
}

// ── Status options ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { label: 'Draft', value: 'Draft' },
  { label: 'Sent', value: 'Sent' },
  { label: 'Accepted', value: 'Accepted' },
  { label: 'Declined', value: 'Declined' },
]

// ── Save ──────────────────────────────────────────────────────────────────────
const saveLoading = ref(false)
const showDuplicateConfirm = ref(false)
const showCancelConfirm = ref(false)
const showAcceptedPrompt = ref(false)
const pendingSavedId = ref<string>('')

const { mutateAsync: createProposal } = useCreateProposal()
const { mutateAsync: updateProposal } = useUpdateProposal()

async function handleSave() {
  if (!form.validate()) return
  await doSave()
}

async function doSave() {
  saveLoading.value = true
  try {
    const payload = form.buildPayload()
    let savedId: string
    let savedNumber: string
    if (isEdit) {
      const updated = await updateProposal({ id: proposalId.value, payload })
      savedId = updated.id
      savedNumber = updated.number
    } else {
      const created = await createProposal(payload)
      savedId = created.id
      savedNumber = created.number
    }
    form.isDirty.value = false
    pendingSavedId.value = savedId
    void savedNumber

    // Accepted-status prompt (spec §4.9)
    if (payload.status === 'Accepted') {
      showAcceptedPrompt.value = true
      return
    }
    router.push({ name: 'proposal-detail', params: { id: savedId } })
  } catch (err: unknown) {
    const e = err as { status?: number }
    if (e?.status === 409) {
      showDuplicateConfirm.value = true
    }
  } finally {
    saveLoading.value = false
  }
}

function onDuplicateReplace() {
  showDuplicateConfirm.value = false
  // In a real backend the server would PATCH the existing record by number;
  // for the UI shell we just re-issue the save and the backend handles it.
  doSave()
}

function onAcceptedCreatePO() {
  showAcceptedPrompt.value = false
  router.push(`/purchase-orders/new?from_proposal=${pendingSavedId.value}`)
}

function onAcceptedJustSave() {
  showAcceptedPrompt.value = false
  router.push({ name: 'proposal-detail', params: { id: pendingSavedId.value } })
}

// ── Cancel ────────────────────────────────────────────────────────────────────
function handleCancel() {
  if (form.isDirty.value) {
    showCancelConfirm.value = true
  } else {
    router.back()
  }
}
</script>

<style scoped>
.proposal-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
}

.proposal-form__header {
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

.proposal-form__header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.proposal-form__title {
  font-size: 20px;
  font-weight: 800;
}

.proposal-form__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.proposal-form__body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.proposal-form__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.proposal-form__section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.proposal-form__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  align-items: start;
}

.proposal-form__type-toggle {
  display: flex;
  gap: 4px;
}

.proposal-form__tax-row {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  flex-wrap: wrap;
}

.proposal-form__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding-bottom: 8px;
}

.proposal-form__tax-rate {
  width: 180px;
}

.proposal-form__client-field {
  position: relative;
}

.proposal-form__autocomplete {
  position: relative;
}

.proposal-form__dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: var(--shadow-card);
  z-index: 20;
  overflow: hidden;
  max-height: 220px;
  overflow-y: auto;
}

.proposal-form__dropdown-item {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
}

.proposal-form__dropdown-item:hover {
  background: var(--color-bg-subtle);
}

.field__required {
  color: var(--color-error);
}

@media (max-width: 700px) {
  .proposal-form {
    padding: 16px;
  }
}
</style>
