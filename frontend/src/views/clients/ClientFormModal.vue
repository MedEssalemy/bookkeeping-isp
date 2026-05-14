<template>
  <Dialog
    :visible="visible"
    :header="isEdit ? 'Edit Client' : 'Add Client'"
    modal
    :draggable="false"
    :style="{ maxWidth: '720px', width: '92vw' }"
    @update:visible="onClose"
  >
    <form class="client-form" @submit.prevent="handleSubmit">
      <div class="client-form__hint">
        Required: Client Name and Business Name. Address fields are joined into
        a full mailing address on save.
      </div>

      <div class="client-form__grid">
        <BaseInput
          v-model="form.name"
          label="Client Name"
          required
          :error="errors.name"
          autofocus
        />

        <BaseInput
          v-model="form.business_name"
          label="Business Name"
          required
          :error="errors.business_name"
        />

        <BaseInput v-model="form.facility" label="Facility" />
        <BaseInput v-model="form.department" label="Department" />
        <BaseInput v-model="form.title" label="Title" />
        <BaseInput v-model="form.phone" label="Phone" />

        <BaseInput
          v-model="form.email"
          label="Email"
          type="email"
          :error="errors.email"
        />

        <!-- Address subgroup spans the full grid width -->
        <div class="client-form__group client-form__group--full">
          <h3 class="client-form__group-title">Address</h3>
          <div class="client-form__address-grid">
            <BaseInput
              v-model="form.address"
              label="Street Address"
              class="client-form__address-street"
            />
            <BaseInput v-model="form.city" label="City" />
            <BaseInput v-model="form.county" label="County" />
            <ComboSelect
              :modelValue="form.state"
              label="State"
              :options="STATE_OPTIONS"
              optionLabel="label"
              optionValue="value"
              placeholder="Select state…"
              searchable
              filterPlaceholder="Search states…"
              @update:modelValue="(v) => (form.state = (v as string) ?? '')"
            />
            <BaseInput v-model="form.zip" label="Zip" />
          </div>
          <p v-if="previewAddress" class="client-form__preview">
            <span class="client-form__preview-label">Preview:</span>
            {{ previewAddress }}
          </p>
        </div>
      </div>
    </form>

    <template #footer>
      <div class="client-form__actions">
        <button
          type="button"
          class="btn btn--secondary btn--sm"
          :disabled="isLoading"
          @click="onClose(false)"
        >Cancel</button>
        <button
          type="button"
          class="btn btn--primary btn--sm"
          :disabled="isLoading"
          @click="handleSubmit"
        >
          {{ isLoading ? 'Saving…' : (isEdit ? 'Save changes' : 'Save client') }}
        </button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import Dialog from 'primevue/dialog'
import BaseInput from '../../components/base/BaseInput.vue'
import ComboSelect from '../../components/base/ComboSelect.vue'
import {
  useAddContact,
  useUpdateContact,
  type ContactRow,
  type AddContactInput,
} from '../../api/clients'

const props = withDefaults(defineProps<{
  visible: boolean
  /**
   * When provided, the modal is in Edit mode and submitting updates this row.
   * When absent, the modal is in Add mode and submitting creates a new row.
   */
  contact?: ContactRow | null
  /** Optional pre-fill for Add mode (e.g. business prefilled from context). */
  initial?: Partial<AddContactInput>
}>(), {
  contact: null,
  initial: () => ({}),
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  /** Fires after a successful create with the new row. */
  created: [contact: ContactRow]
  /** Fires after a successful update with the saved row. */
  updated: [contact: ContactRow]
}>()

const isEdit = computed(() => !!props.contact)

// ── Form state ───────────────────────────────────────────────────────────────
function blankForm(): AddContactInput {
  return {
    name: '',
    business_name: '',
    facility: '',
    department: '',
    title: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    county: '',
    state: '',
    zip: '',
  }
}

function fromContact(c: ContactRow): AddContactInput {
  return {
    name: c.name ?? '',
    business_name: c.business_name ?? '',
    facility: c.facility ?? '',
    department: c.department ?? '',
    title: c.title ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    county: c.county ?? '',
    state: c.state ?? '',
    zip: c.zip ?? '',
  }
}

const form = reactive<AddContactInput>(blankForm())
const errors = reactive<{ name?: string; business_name?: string; email?: string }>({})

// Reset / pre-fill whenever the modal opens.
watch(() => props.visible, (open) => {
  if (!open) return
  Object.assign(
    form,
    blankForm(),
    props.contact ? fromContact(props.contact) : props.initial ?? {},
  )
  errors.name = errors.business_name = errors.email = undefined
})

// ── States dropdown ──────────────────────────────────────────────────────────
const STATE_OPTIONS = [
  { label: 'California (CA)', value: 'California' },
  { label: 'Nevada (NV)', value: 'Nevada' },
  { label: 'New York (NY)', value: 'New York' },
  { label: 'Texas (TX)', value: 'Texas' },
]

const STATE_ABBR: Record<string, string> = {
  California: 'CA', Nevada: 'NV', 'New York': 'NY', Texas: 'TX',
}

// ── Live preview of the joined address ───────────────────────────────────────
const previewAddress = computed(() => {
  const state = form.state ? (STATE_ABBR[form.state] ?? form.state) : ''
  const cityZip = [form.city, [state, form.zip].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  return [form.address, cityZip].filter(Boolean).join(', ').trim()
})

// ── Submit ───────────────────────────────────────────────────────────────────
const { mutateAsync: addContact, isPending: isAdding } = useAddContact()
const { mutateAsync: updateContact, isPending: isUpdating } = useUpdateContact()
const isLoading = computed(() => isAdding.value || isUpdating.value)

function validate(): boolean {
  errors.name = errors.business_name = errors.email = undefined
  let ok = true
  if (!(form.name ?? '').trim()) { errors.name = 'Required'; ok = false }
  if (!(form.business_name ?? '').trim()) { errors.business_name = 'Required'; ok = false }
  if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
    errors.email = 'Looks like an invalid email'
    ok = false
  }
  return ok
}

async function handleSubmit() {
  if (!validate()) return
  if (props.contact) {
    const saved = await updateContact({ id: props.contact.id, input: { ...form } })
    emit('updated', saved)
  } else {
    const saved = await addContact({ ...form })
    emit('created', saved)
  }
  onClose(false)
}

function onClose(open: boolean) {
  if (isLoading.value) return
  emit('update:visible', open)
}
</script>

<style scoped>
.client-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: var(--font-sans);
}

.client-form__hint {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.client-form__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.client-form__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.client-form__group--full {
  grid-column: 1 / -1;
}

.client-form__group-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
  margin: 4px 0 0;
}

.client-form__address-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 0.8fr;
  gap: 8px;
}

.client-form__preview {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
  padding: 6px 10px;
  background: var(--color-bg-subtle);
  border: 1px dashed var(--color-border);
  border-radius: 6px;
}

.client-form__preview-label {
  font-weight: 600;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.06em;
  margin-right: 6px;
}

.client-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 640px) {
  .client-form__grid {
    grid-template-columns: 1fr;
  }
  .client-form__address-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
