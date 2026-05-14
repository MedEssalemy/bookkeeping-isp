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

          <!-- Status: choice list. Built-in values (Draft / Sent / Accepted /
               Declined) cannot be deleted in config, but extra statuses can be
               added later from /settings. -->
          <ComboSelect
            v-model="form.status.value"
            label="Status"
            :options="STATUS_OPTIONS"
            optionLabel="label"
            optionValue="value"
            addNewLabel="Add new status…"
            :addNewTo="{ name: 'settings', query: { section: 'proposal-statuses' } }"
          />
        </div>

        <!-- ── Standard-specific fields ───────────────────────────────────── -->
        <template v-if="form.type.value === 'Standard'">
          <div class="proposal-form__grid">
            <!-- Client Name: unified contact picker. One row per facility, so
                 picking immediately fills every downstream contact field.
                 Downstream fields are locked — they only ever come from the
                 selected contact. To add a contact, use "Add new contact…"
                 which routes to the Clients page. -->
            <ComboSelect
              :modelValue="selectedContactId"
              label="Client Name"
              required
              :options="contactOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select a contact…"
              searchable
              showClear
              filterPlaceholder="Search name, business, facility, address…"
              :error="form.errors.value.clientName"
              addNewLabel="Add new contact…"
              :addNewTo="{ name: 'clients' }"
              @update:modelValue="onContactPicked"
            >
              <template #option="{ option }">
                <div class="contact-option">
                  <div class="contact-option__primary">{{ option.primary }}</div>
                  <div class="contact-option__secondary">{{ option.secondary }}</div>
                </div>
              </template>
              <template #value="{ value, placeholder }">
                <template v-if="value === null || value === undefined">
                  <span class="contact-option__placeholder">{{ placeholder }}</span>
                </template>
                <template v-else>
                  <div class="contact-option contact-option--trigger">
                    <div class="contact-option__primary">{{ selectedContactLabel.primary }}</div>
                    <div class="contact-option__secondary">{{ selectedContactLabel.secondary }}</div>
                  </div>
                </template>
              </template>
            </ComboSelect>

            <!-- Address: locked / autofilled from the picked contact. No
                 asterisk — it isn't a user-input field anymore. -->
            <BaseInput v-model="form.address.value" label="Address" disabled />

            <!-- Title (locked) -->
            <BaseInput v-model="form.title.value" label="Title" disabled />

            <!-- Business Name (locked) -->
            <BaseInput v-model="form.businessName.value" label="Business Name" disabled />

            <!-- Department (locked) -->
            <BaseInput v-model="form.department.value" label="Department" disabled />

            <!-- Phone (locked) -->
            <BaseInput v-model="form.phone.value" label="Phone" disabled />

            <!-- Email (locked) -->
            <BaseInput
              v-model="form.email.value"
              label="Email"
              type="email"
              disabled
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
            <!-- Reference: choice list with override (editable) + "Add new"
                 footer that routes to the config page. Presets are local for
                 now; the API will supply them in a later phase. -->
            <ComboSelect
              v-model="form.reference.value"
              label="Reference"
              :options="REFERENCE_OPTIONS"
              optionLabel="label"
              optionValue="value"
              placeholder="Select or type a reference…"
              editable
              addNewLabel="Add new reference…"
              :addNewTo="{ name: 'settings', query: { section: 'references' } }"
            />

            <!-- Project Location: choice list backed by mp_destinations.
                 Users can also type a custom location. "Add new" jumps to the
                 config page where destinations are managed. -->
            <ComboSelect
              :modelValue="form.projectLocation.value"
              label="Project Location"
              :options="mpDestinationOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select or type a location…"
              editable
              searchable
              filterPlaceholder="Search locations…"
              addNewLabel="Add new location…"
              :addNewTo="{ name: 'settings', query: { section: 'mp-destinations' } }"
              @update:modelValue="onDestinationPicked"
            />

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
          :items="form.standardItems.value"
          variant="Standard"
          @add="form.addStandardItem()"
          @remove="form.removeStandardItem"
        />
        <LineItemsTable
          v-else
          :items="form.mpItems.value"
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
              step="0.001"
              min="0"
              :disabled="!form.taxable.value"
              :value="taxRatePercentDisplay"
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
import { useAllContacts, type ContactRow } from '../../api/clients'
import { useTaxRateLookup } from '../../api/taxRates'
import BaseInput from '../../components/base/BaseInput.vue'
import ComboSelect from '../../components/base/ComboSelect.vue'
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

const mpDestinationOptions = computed(() =>
  mpDestinations.value.map((d) => ({ label: d.final_destination, value: d.final_destination }))
)

function onDestinationPicked(val: unknown) {
  const value = (val ?? '') as string
  form.projectLocation.value = value
  // Address autofill only applies when the user picked a known destination.
  // For a custom typed value, we leave the address field as-is.
  const dest = mpDestinations.value.find((d) => d.final_destination === value)
  if (dest) form.onDestinationSelected(dest)
}

// ── Next proposal number (preview only, prefilled on create) ──────────────────
const typeRef = computed<ProposalType>(() => form.type.value)
const { data: nextNumber } = useNextProposalNumber(typeRef)
watch(nextNumber, (v) => {
  if (v && !isEdit && !form.number.value) {
    form.number.value = v
    form.markFromNumberAutofill()
  }
}, { immediate: true })

// ── Load existing proposal for edit ──────────────────────────────────────────
const { data: existingProposal } = useProposal(proposalId)

watch(existingProposal, (p) => {
  if (p && isEdit) {
    form.loadProposal(p as Parameters<typeof form.loadProposal>[0])
  }
}, { immediate: true })

// ── Contacts (unified Client Name picker) ─────────────────────────────────────
// We load every contact row once and let the ComboSelect filter in-place.
// 85 rows is well within what PrimeVue's filter handles smoothly; if the table
// grows, swap this for a server-side search endpoint.

const { data: allContactsData } = useAllContacts()
const allContacts = computed<ContactRow[]>(() => allContactsData.value ?? [])

const selectedContactId = ref<string | null>(null)

function contactPrimaryLabel(c: ContactRow): string {
  // "Person — Business" is the most useful identifier line; falls back if
  // either is missing.
  const parts = [c.name, c.business_name].filter(Boolean)
  return parts.length ? parts.join(' — ') : (c.facility || c.address || '(unnamed contact)')
}

function contactSecondaryLabel(c: ContactRow): string {
  const parts: string[] = []
  if (c.facility) parts.push(c.facility)
  const addr = [c.address, c.city, c.state].filter(Boolean).join(', ')
  if (addr) parts.push(addr)
  return parts.join(' · ')
}

const contactOptions = computed(() =>
  allContacts.value.map((c) => {
    const primary = contactPrimaryLabel(c)
    const secondary = contactSecondaryLabel(c)
    return {
      value: c.id,
      primary,
      secondary,
      // Flat label powers PrimeVue Select's built-in text filter — match on
      // name, business, facility, dept, and address all at once.
      label: [primary, secondary, c.department, c.title].filter(Boolean).join(' '),
    }
  }),
)

const selectedContactLabel = computed(() => {
  const id = selectedContactId.value
  if (!id) return { primary: '', secondary: '' }
  const c = allContacts.value.find((x) => x.id === id)
  if (!c) return { primary: '', secondary: '' }
  return { primary: contactPrimaryLabel(c), secondary: contactSecondaryLabel(c) }
})

function onContactPicked(val: unknown) {
  const id = (val as string | null | undefined) ?? null
  selectedContactId.value = id
  if (!id) {
    form.clearContactSelection()
    return
  }
  const contact = allContacts.value.find((c) => c.id === id)
  if (!contact) return
  // Peer rows for the same person — keeps composable state consistent with
  // the older "list of contacts for the picked person" model.
  const peers = allContacts.value.filter((c) => c.name === contact.name)
  form.onContactRowSelected(contact, peers)
}

// When loading an existing proposal in edit mode, sync the picker selection
// to the saved data — match by clientName + address + facility.
watch(
  [allContacts, () => form.clientName.value, () => form.address.value],
  ([rows, name, address]) => {
    if (selectedContactId.value) return // user has already picked
    if (!rows.length || !name) return
    const match = rows.find(
      (c) => c.name === name && (!address || c.address === address),
    )
    if (match) selectedContactId.value = match.id
  },
  { immediate: true },
)

// ── Tax-rate lookup (driven by lookupCity / lookupState) ─────────────────────
const { data: taxRateData } = useTaxRateLookup(form.lookupCity, form.lookupState)
watch(taxRateData, (v) => {
  if (typeof v === 'number') form.onTaxRateLoaded(v)
})

// Tax rate displayed as a percent string so user input doesn't round-trip
// through `decimal * 100` float math (which renders e.g. 8.25 as 8.249999…).
// Supports up to 3 decimal digits on the percent (i.e. 5 decimals on the
// stored decimal value).
const taxRatePercentDisplay = ref<string>('')

watch(() => form.taxRate.value, (v) => {
  const pct = v * 100
  const current = Number(taxRatePercentDisplay.value)
  // Only resync display when the underlying value changed from outside (load,
  // lookup, taxable toggle). If the user is typing, leave the string alone.
  if (taxRatePercentDisplay.value === '' || !Number.isFinite(current) || Math.abs(current - pct) > 1e-6) {
    taxRatePercentDisplay.value = pct === 0 ? '0' : (Math.round(pct * 1000) / 1000).toString()
  }
}, { immediate: true })

function onTaxRateInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  taxRatePercentDisplay.value = raw
  const v = Number(raw)
  // Field shows %; store as decimal (round to 5 places to avoid float drift)
  const decimal = isNaN(v) ? 0 : Math.round((v / 100) * 100000) / 100000
  form.onTaxRateUserEdit(decimal)
}

// ── Status options ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { label: 'Draft', value: 'Draft' },
  { label: 'Sent', value: 'Sent' },
  { label: 'Accepted', value: 'Accepted' },
  { label: 'Declined', value: 'Declined' },
]

// ── Reference presets (MP only) ───────────────────────────────────────────────
// Hard-coded until the API ships. Users can also type a custom value.
const REFERENCE_OPTIONS = [
  {
    label: 'Proposal for Medical Physicist Professional Services',
    value: 'Proposal for Medical Physicist Professional Services',
  },
  {
    label: 'Proposal for Medical Physicist',
    value: 'Proposal for Medical Physicist',
  },
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

.field__required {
  color: var(--color-error);
}

/* ── Contact picker option rows ──────────────────────────────────────────── */
.contact-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.contact-option__primary {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contact-option__secondary {
  font-size: 11.5px;
  color: var(--color-text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Trigger variant: tighter, single visible line on the field itself. */
.contact-option--trigger {
  gap: 0;
}

.contact-option--trigger .contact-option__secondary {
  font-size: 11px;
  margin-top: -1px;
}

.contact-option__placeholder {
  color: var(--color-text-subtle);
}

@media (max-width: 700px) {
  .proposal-form {
    padding: 16px;
  }
}
</style>
