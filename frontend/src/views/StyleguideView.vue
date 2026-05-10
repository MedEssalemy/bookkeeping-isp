<template>
  <div class="sg">
    <h1 class="sg__title">Component Styleguide</h1>

    <!-- StatusBadge -->
    <section class="sg__section">
      <h2 class="sg__heading">StatusBadge</h2>
      <div class="sg__row">
        <StatusBadge label="Draft" variant="gray" />
        <StatusBadge label="Sent" variant="blue" />
        <StatusBadge label="Accepted" variant="green" />
        <StatusBadge label="Declined" variant="red" />
        <StatusBadge label="Pending" variant="amber" />
        <StatusBadge label="Issued" variant="purple" />
        <StatusBadge label="Light" variant="light-gray" />
      </div>
    </section>

    <!-- BaseInput -->
    <section class="sg__section">
      <h2 class="sg__heading">BaseInput</h2>
      <div class="sg__grid">
        <BaseInput label="Text field" placeholder="Placeholder text" v-model="demoText" />
        <BaseInput label="Required field" placeholder="Required" required v-model="demoText" />
        <BaseInput label="Email" type="email" placeholder="you@example.com" v-model="demoEmail" />
        <BaseInput label="Number" type="number" placeholder="0" v-model="demoNumber" />
        <BaseInput label="With error" placeholder="Error state" error="This field is required" v-model="demoErr" />
        <BaseInput label="Disabled" placeholder="Disabled" disabled v-model="demoText" />
      </div>
    </section>

    <!-- BaseTextarea -->
    <section class="sg__section">
      <h2 class="sg__heading">BaseTextarea</h2>
      <div class="sg__grid">
        <BaseTextarea label="Notes" placeholder="Enter notes..." v-model="demoArea" />
        <BaseTextarea label="With error" error="Cannot be empty" v-model="demoArea" />
        <BaseTextarea label="Disabled" disabled v-model="demoArea" />
      </div>
    </section>

    <!-- BaseSelect -->
    <section class="sg__section">
      <h2 class="sg__heading">BaseSelect</h2>
      <div class="sg__grid">
        <BaseSelect
          label="Select"
          placeholder="Choose one"
          :options="[{label:'Option A',value:'a'},{label:'Option B',value:'b'}]"
          v-model="demoSelect"
        />
        <BaseSelect
          label="Searchable"
          placeholder="Search…"
          searchable
          :options="[{label:'Option A',value:'a'},{label:'Option B',value:'b'},{label:'Option C',value:'c'}]"
          v-model="demoSelect"
        />
        <BaseSelect
          label="With error"
          error="Selection required"
          :options="[{label:'Option A',value:'a'}]"
          v-model="demoSelect"
        />
      </div>
    </section>

    <!-- BaseDatePicker -->
    <section class="sg__section">
      <h2 class="sg__heading">BaseDatePicker</h2>
      <div class="sg__grid">
        <BaseDatePicker label="Date" v-model="demoDate" />
        <BaseDatePicker label="Required" required v-model="demoDate" />
        <BaseDatePicker label="With error" error="Date is required" v-model="demoDate" />
        <BaseDatePicker label="Disabled" disabled v-model="demoDate" />
      </div>
    </section>

    <!-- RichTextEditor -->
    <section class="sg__section">
      <h2 class="sg__heading">RichTextEditor (Tier 1 — bold, italic, underline, break, bullets only)</h2>
      <RichTextEditor
        label="Content"
        v-model="demoRich"
        style="max-width: 600px"
      />
      <p style="font-size:12px;color:var(--color-text-muted);margin-top:8px">
        Output HTML: <code>{{ demoRich }}</code>
      </p>
    </section>

    <!-- ConfirmModal -->
    <section class="sg__section">
      <h2 class="sg__heading">ConfirmModal</h2>
      <div class="sg__row">
        <button class="btn btn--danger btn--sm" @click="showDanger = true">Danger modal</button>
        <button class="btn btn--secondary btn--sm" @click="showWarning = true">Warning modal</button>
        <button class="btn btn--primary btn--sm" @click="showInfo = true">Info modal</button>
      </div>
      <ConfirmModal
        v-model:visible="showDanger"
        title="Delete proposal?"
        message="This action cannot be undone. The proposal and all its line items will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        @confirm="showDanger = false"
        @cancel="showDanger = false"
      />
      <ConfirmModal
        v-model:visible="showWarning"
        title="Unsaved changes"
        message="You have unsaved changes. Are you sure you want to leave?"
        confirmLabel="Leave"
        variant="warning"
        @confirm="showWarning = false"
        @cancel="showWarning = false"
      />
      <ConfirmModal
        v-model:visible="showInfo"
        title="Confirm action"
        message="Are you sure you want to proceed with this action?"
        @confirm="showInfo = false"
        @cancel="showInfo = false"
      />
    </section>

    <!-- EmptyState -->
    <section class="sg__section">
      <h2 class="sg__heading">EmptyState</h2>
      <div style="border:1px solid var(--color-border);border-radius:8px;overflow:hidden">
        <EmptyState
          heading="No proposals yet"
          subtext="Create your first proposal to get started."
        >
          <template #cta>
            <button class="btn btn--primary btn--sm">+ New Proposal</button>
          </template>
        </EmptyState>
      </div>
    </section>

    <!-- ActionButtons -->
    <section class="sg__section">
      <h2 class="sg__heading">ActionButtons (hidden for Viewer role)</h2>
      <ActionButtons>
        <button class="btn btn--ghost btn--sm">Edit</button>
        <button class="btn btn--ghost btn--sm" style="color:var(--color-error)">Delete</button>
      </ActionButtons>
      <p style="font-size:12px;color:var(--color-text-muted);margin-top:6px">
        Current role: <strong>{{ authStore.role }}</strong>
        — buttons above are hidden for "viewer" role.
      </p>
    </section>

    <!-- DataTable -->
    <section class="sg__section">
      <h2 class="sg__heading">DataTable</h2>
      <DataTable :value="tableRows" :total="tableRows.length" :page="1" :page-size="10">
        <Column field="number" header="Number" />
        <Column field="client" header="Client" />
        <Column field="status" header="Status">
          <template #body="{ data }">
            <StatusBadge :label="data.status" :variant="statusVariant(data.status)" />
          </template>
        </Column>
      </DataTable>
    </section>

    <!-- DataTable loading -->
    <section class="sg__section">
      <h2 class="sg__heading">DataTable — loading state</h2>
      <DataTable :value="[]" :loading="true" :total="0" :page="1" :page-size="5">
        <Column field="number" header="Number" />
        <Column field="client" header="Client" />
        <Column field="status" header="Status" />
      </DataTable>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Column from 'primevue/column'
import StatusBadge from '../components/base/StatusBadge.vue'
import BaseInput from '../components/base/BaseInput.vue'
import BaseTextarea from '../components/base/BaseTextarea.vue'
import BaseSelect from '../components/base/BaseSelect.vue'
import BaseDatePicker from '../components/base/BaseDatePicker.vue'
import RichTextEditor from '../components/base/RichTextEditor.vue'
import ConfirmModal from '../components/base/ConfirmModal.vue'
import EmptyState from '../components/base/EmptyState.vue'
import ActionButtons from '../components/base/ActionButtons.vue'
import DataTable from '../components/base/DataTable.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const demoText = ref('Sample text')
const demoEmail = ref('')
const demoNumber = ref('')
const demoErr = ref('')
const demoArea = ref('Multi-line\ncontent here')
const demoSelect = ref(null)
const demoDate = ref<string | null>(null)
const demoRich = ref('<p>Hello <strong>world</strong></p>')
const showDanger = ref(false)
const showWarning = ref(false)
const showInfo = ref(false)

const tableRows = [
  { number: 'P-001', client: 'Acme Corp', status: 'Draft' },
  { number: 'P-002', client: 'Beta LLC', status: 'Sent' },
  { number: 'P-003', client: 'Gamma Inc', status: 'Accepted' },
  { number: 'P-004', client: 'Delta Co', status: 'Declined' },
]

function statusVariant(status: string) {
  const map: Record<string, 'gray' | 'blue' | 'green' | 'red' | 'amber' | 'purple'> = {
    Draft: 'gray',
    Sent: 'blue',
    Accepted: 'green',
    Declined: 'red',
  }
  return map[status] ?? 'gray'
}
</script>

<style scoped>
.sg {
  padding: 32px;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.sg__title {
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text);
}

.sg__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sg__heading {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 8px;
}

.sg__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.sg__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
</style>
