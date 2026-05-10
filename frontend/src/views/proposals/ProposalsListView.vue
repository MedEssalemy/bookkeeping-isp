<template>
  <div class="proposals-list">
    <!-- Page header -->
    <div class="proposals-list__header">
      <h1 class="proposals-list__title">Proposals</h1>
      <div class="proposals-list__header-actions">
        <button
          v-if="auth.canEdit"
          class="btn btn--secondary btn--sm"
          @click="handleExport"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
        <button
          v-if="auth.isAdmin"
          class="btn btn--secondary btn--sm"
          @click="handleImport"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Import
        </button>
        <button
          v-if="auth.canEdit"
          class="btn btn--primary btn--sm"
          @click="router.push({ name: 'proposal-new' })"
        >
          + New Proposal
        </button>
      </div>
    </div>

    <!-- Filter row -->
    <div class="proposals-list__filters">
      <!-- Status multi-select -->
      <MultiSelect
        v-model="filters.status"
        :options="STATUS_OPTIONS"
        placeholder="Status"
        display="chip"
        class="proposals-list__filter-select"
      />

      <!-- Type -->
      <Select
        v-model="filters.type"
        :options="TYPE_OPTIONS"
        optionLabel="label"
        optionValue="value"
        placeholder="Type"
        showClear
        class="proposals-list__filter-select"
      />

      <!-- Date from -->
      <DatePicker
        v-model="filterDateFrom"
        placeholder="From"
        dateFormat="mm/dd/yy"
        showIcon
        class="proposals-list__filter-date"
        @update:modelValue="onDateFromChange"
      />

      <!-- Date to -->
      <DatePicker
        v-model="filterDateTo"
        placeholder="To"
        dateFormat="mm/dd/yy"
        showIcon
        class="proposals-list__filter-date"
        @update:modelValue="onDateToChange"
      />

      <!-- Client / Project Location -->
      <input
        v-model="filters.client"
        class="field__input proposals-list__filter-input"
        type="text"
        placeholder="Client / location…"
      />

      <!-- Job Code multi-select -->
      <MultiSelect
        v-model="filters.job_code"
        :options="JOB_CODES"
        placeholder="Job Code"
        display="chip"
        :maxSelectedLabels="1"
        filter
        class="proposals-list__filter-select proposals-list__filter-select--wide"
      />

      <!-- Free-text search (Proposal #, Project Name) -->
      <input
        v-model="filters.q"
        class="field__input proposals-list__filter-input"
        type="text"
        placeholder="Search number or project…"
      />

      <!-- Clear all -->
      <button
        v-if="hasActiveFilters"
        class="btn btn--ghost btn--sm proposals-list__clear"
        @click="clearFilters"
      >
        Clear all
      </button>
    </div>

    <!-- Table -->
    <div class="proposals-list__table-wrap">
      <!-- Loading skeleton -->
      <template v-if="isLoading">
        <div v-for="i in 5" :key="i" class="skeleton skeleton--row" />
      </template>

      <!-- Error -->
      <div v-else-if="isError" class="proposals-list__error">
        Failed to load proposals. Please refresh.
      </div>

      <!-- Empty -->
      <EmptyState
        v-else-if="filteredItems.length === 0"
        heading="No proposals found"
        :subtext="hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first proposal to get started.'"
      >
        <template v-if="!hasActiveFilters && auth.canEdit" #cta>
          <button class="btn btn--primary btn--sm" @click="router.push({ name: 'proposal-new' })">
            + New Proposal
          </button>
        </template>
      </EmptyState>

      <!-- Table -->
      <table v-else class="table">
        <thead>
          <tr>
            <th @click="toggleSort('number')" class="proposals-list__sortable">
              Proposal # <SortIndicator :col="'number'" :sort="sort" />
            </th>
            <th @click="toggleSort('date')" class="proposals-list__sortable">
              Date <SortIndicator :col="'date'" :sort="sort" />
            </th>
            <th>Type</th>
            <th>Client / Project</th>
            <th>Project Name</th>
            <!-- Job Codes column with header-click filter -->
            <th class="proposals-list__jc-header" @click.stop="toggleJobCodePanel">
              <span class="proposals-list__jc-header-inner">
                Job Codes
                <span
                  v-if="filters.job_code.length"
                  class="proposals-list__jc-badge"
                >{{ filters.job_code.length }}</span>
                <svg
                  :class="['proposals-list__filter-icon', { 'is-active': filters.job_code.length }]"
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
              </span>
            </th>
            <th>Status</th>
            <th @click="toggleSort('total')" class="td--number proposals-list__sortable">
              Total <SortIndicator :col="'total'" :sort="sort" />
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in paginatedItems"
            :key="item.id"
            class="proposals-list__row"
            @click="router.push({ name: 'proposal-detail', params: { id: item.id } })"
          >
            <td class="proposals-list__number">{{ item.number }}</td>
            <td>{{ formatDate(item.date) }}</td>
            <td @click.stop>
              <StatusBadge
                :label="item.type"
                :variant="item.type === 'Standard' ? 'gray' : 'purple'"
              />
            </td>
            <td>{{ item.client_name || item.project_location || '—' }}</td>
            <td>
              <span
                v-if="item.project_name"
                v-tooltip="(item.project_name?.length ?? 0) > 40 ? item.project_name : ''"
                class="proposals-list__project-name"
              >
                {{ truncate(item.project_name, 40) }}
              </span>
              <span v-else>—</span>
            </td>
            <!-- Job Codes cell -->
            <td @click.stop>
              <div v-if="!item.job_codes.length" class="proposals-list__jc-empty">—</div>
              <div v-else class="proposals-list__jc-chips">
                <StatusBadge
                  v-for="code in item.job_codes.slice(0, 3)"
                  :key="code"
                  :label="code"
                  variant="light-gray"
                />
                <span
                  v-if="item.job_codes.length > 3"
                  v-tooltip="item.job_codes.slice(3).join('\n')"
                  class="proposals-list__jc-more"
                >
                  +{{ item.job_codes.length - 3 }}
                </span>
              </div>
            </td>
            <td @click.stop>
              <StatusPopover
                :status="item.status"
                :loading="updatingStatus === item.id"
                @change="(s) => onStatusChange(item.id, s)"
              />
            </td>
            <td class="td--number proposals-list__total">{{ formatCurrency(item.total) }}</td>
            <td @click.stop>
              <ActionButtons>
                <button
                  v-if="auth.canEdit"
                  class="action-btn"
                  title="Edit"
                  @click="router.push({ name: 'proposal-edit', params: { id: item.id } })"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  v-if="auth.canEdit"
                  class="action-btn"
                  title="Generate Document"
                  @click="handleGenerateDoc(item)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>
                <button
                  v-if="auth.canEdit"
                  class="action-btn action-btn--danger"
                  title="Delete"
                  @click="confirmDelete(item.id, item.number)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </ActionButtons>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="filteredItems.length > pageSize" class="proposals-list__pagination">
        <span class="proposals-list__pagination-info">
          {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, filteredItems.length) }}
          of {{ filteredItems.length }}
        </span>
        <div class="proposals-list__pagination-btns">
          <button class="btn btn--secondary btn--sm" :disabled="page <= 1" @click="page--">Prev</button>
          <button class="btn btn--secondary btn--sm" :disabled="page * pageSize >= filteredItems.length" @click="page++">Next</button>
        </div>
      </div>
    </div>

    <!-- Job Codes column-header filter popover -->
    <Popover ref="jobCodePanelRef" :dismissable="true">
      <div class="proposals-list__jc-panel">
        <div class="proposals-list__jc-panel-header">
          <span class="proposals-list__jc-panel-label">Filter by Job Code</span>
          <button
            v-if="filters.job_code.length"
            class="proposals-list__jc-panel-clear"
            @click.stop="filters.job_code = []"
          >Clear</button>
        </div>
        <div class="proposals-list__jc-panel-list">
          <label
            v-for="code in JOB_CODES"
            :key="code"
            class="proposals-list__jc-panel-item"
            @click.stop
          >
            <input
              type="checkbox"
              :value="code"
              :checked="filters.job_code.includes(code)"
              @change="toggleJobCode(code)"
            />
            {{ code }}
          </label>
        </div>
      </div>
    </Popover>

    <!-- Import dummy modal -->
    <ConfirmModal
      v-model:visible="showImportModal"
      title="Import proposals"
      message="Import is not yet implemented. This is a demo placeholder — full feature coming soon."
      confirmLabel="OK"
      cancelLabel=""
      variant="info"
      @confirm="showImportModal = false"
      @cancel="showImportModal = false"
    />

    <!-- Export dummy modal -->
    <ConfirmModal
      v-model:visible="showExportModal"
      title="Export proposals"
      message="Export is not yet implemented. This is a demo placeholder — full feature coming soon."
      confirmLabel="OK"
      cancelLabel=""
      variant="info"
      @confirm="showExportModal = false"
      @cancel="showExportModal = false"
    />

    <!-- Delete confirm modal -->
    <ConfirmModal
      v-model:visible="showDeleteModal"
      title="Delete proposal?"
      :message="`Are you sure you want to delete ${deleteTarget.number}? This cannot be undone.`"
      confirmLabel="Delete"
      variant="danger"
      @confirm="onDeleteConfirm"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { useRouter } from 'vue-router'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Popover from 'primevue/popover'
import { useAuthStore } from '../../stores/auth'
import {
  useProposalList,
  useUpdateProposalStatus,
  useDeleteProposal,
  useGenerateDocument,
} from '../../api/proposals'
import { JOB_CODES } from '../../mocks/jobCodes'
import StatusBadge from '../../components/base/StatusBadge.vue'
import EmptyState from '../../components/base/EmptyState.vue'
import ActionButtons from '../../components/base/ActionButtons.vue'
import ConfirmModal from '../../components/base/ConfirmModal.vue'
import StatusPopover from './components/StatusPopover.vue'
import type { ProposalListItem, ProposalStatus, ProposalType, JobCode } from '../../types/proposal'

const router = useRouter()
const auth = useAuthStore()

// ── Filters ───────────────────────────────────────────────────────────────────

const filters = ref<{
  q: string
  status: ProposalStatus[]
  type: ProposalType | null
  from: string
  to: string
  client: string
  job_code: JobCode[]
}>({
  q: '',
  status: [],
  type: null,
  from: '',
  to: '',
  client: '',
  job_code: [],
})

const filterDateFrom = ref<Date | null>(null)
const filterDateTo = ref<Date | null>(null)

function onDateFromChange(val: Date | Date[] | (Date | null)[] | null | undefined) {
  const d = val instanceof Date ? val : null
  filterDateFrom.value = d
  filters.value.from = d ? d.toISOString().slice(0, 10) : ''
}

function onDateToChange(val: Date | Date[] | (Date | null)[] | null | undefined) {
  const d = val instanceof Date ? val : null
  filterDateTo.value = d
  filters.value.to = d ? d.toISOString().slice(0, 10) : ''
}

const hasActiveFilters = computed(() =>
  !!filters.value.q ||
  filters.value.status.length > 0 ||
  !!filters.value.type ||
  !!filters.value.from ||
  !!filters.value.to ||
  !!filters.value.client ||
  filters.value.job_code.length > 0,
)

function clearFilters() {
  filters.value = { q: '', status: [], type: null, from: '', to: '', client: '', job_code: [] }
  filterDateFrom.value = null
  filterDateTo.value = null
  page.value = 1
}

const STATUS_OPTIONS: ProposalStatus[] = ['Draft', 'Sent', 'Accepted', 'Declined']
const TYPE_OPTIONS = [
  { label: 'Standard', value: 'Standard' },
  { label: 'MP', value: 'MP' },
]

// ── Job Codes column-header filter ────────────────────────────────────────────

const jobCodePanelRef = ref<InstanceType<typeof Popover> | null>(null)

function toggleJobCodePanel(e: MouseEvent) {
  jobCodePanelRef.value?.toggle(e)
}

function toggleJobCode(code: JobCode) {
  const codes = filters.value.job_code
  const idx = codes.indexOf(code)
  if (idx === -1) {
    filters.value.job_code = [...codes, code]
  } else {
    filters.value.job_code = codes.filter((c) => c !== code)
  }
}

// ── Data ──────────────────────────────────────────────────────────────────────

const queryParams = ref({ page: 1, page_size: 1000 })
const { data, isLoading, isError } = useProposalList(queryParams)

const allItems = computed<ProposalListItem[]>(() => data.value?.items ?? [])

// ── Client-side filtering ─────────────────────────────────────────────────────

const filteredItems = computed(() => {
  const f = filters.value
  return allItems.value.filter((item) => {
    if (f.q) {
      const q = f.q.toLowerCase()
      if (!item.number.toLowerCase().includes(q) && !(item.project_name ?? '').toLowerCase().includes(q)) return false
    }
    if (f.status.length && !f.status.includes(item.status)) return false
    if (f.type && item.type !== f.type) return false
    if (f.from && item.date < f.from) return false
    if (f.to && item.date > f.to) return false
    if (f.client) {
      const q = f.client.toLowerCase()
      if (!(item.client_name ?? '').toLowerCase().includes(q) && !(item.project_location ?? '').toLowerCase().includes(q)) return false
    }
    if (f.job_code.length) {
      if (!item.job_codes.some((c) => f.job_code.includes(c))) return false
    }
    return true
  })
})

watch(filters, () => { page.value = 1 }, { deep: true })

// ── Sort ──────────────────────────────────────────────────────────────────────

type SortCol = 'number' | 'date' | 'total'
const sort = ref<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'date', dir: 'desc' })

function toggleSort(col: SortCol) {
  if (sort.value.col === col) {
    sort.value.dir = sort.value.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value = { col, dir: 'asc' }
  }
}

const sortedItems = computed(() => {
  const arr = filteredItems.value.slice()
  const { col, dir } = sort.value
  arr.sort((a, b) => {
    let cmp = 0
    if (col === 'number') cmp = a.number.localeCompare(b.number)
    else if (col === 'date') cmp = a.date.localeCompare(b.date)
    else if (col === 'total') cmp = a.total - b.total
    return dir === 'asc' ? cmp : -cmp
  })
  return arr
})

// ── Pagination ────────────────────────────────────────────────────────────────

const page = ref(1)
const pageSize = 50

const paginatedItems = computed(() => {
  const start = (page.value - 1) * pageSize
  return sortedItems.value.slice(start, start + pageSize)
})

// ── Status update ─────────────────────────────────────────────────────────────

const updatingStatus = ref<string | null>(null)
const { mutate: updateStatus } = useUpdateProposalStatus()

function onStatusChange(id: string, status: ProposalStatus) {
  updatingStatus.value = id
  updateStatus({ id, status }, {
    onSettled: () => { updatingStatus.value = null },
  })
}

// ── Generate Document ─────────────────────────────────────────────────────────

const { mutateAsync: generateDoc } = useGenerateDocument()
async function handleGenerateDoc(item: ProposalListItem) {
  const blob = await generateDoc(item.id)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${item.number}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Import / Export (demo placeholders) ───────────────────────────────────────

const showExportModal = ref(false)
const showImportModal = ref(false)
function handleExport() { showExportModal.value = true }
function handleImport() { showImportModal.value = true }

// ── Delete ────────────────────────────────────────────────────────────────────

const showDeleteModal = ref(false)
const deleteTarget = ref({ id: '', number: '' })
const { mutate: deleteMutation } = useDeleteProposal()

function confirmDelete(id: string, number: string) {
  deleteTarget.value = { id, number }
  showDeleteModal.value = true
}

function onDeleteConfirm() {
  showDeleteModal.value = false
  deleteMutation(deleteTarget.value.id)
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function truncate(s: string | undefined, n: number) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

// ── Inline sort indicator ─────────────────────────────────────────────────────

const SortIndicator = (props: { col: SortCol; sort: { col: SortCol; dir: 'asc' | 'desc' } }) => {
  if (props.sort.col !== props.col) return h('span', { class: 'proposals-list__sort-icon proposals-list__sort-icon--inactive' }, '↕')
  return h('span', { class: 'proposals-list__sort-icon' }, props.sort.dir === 'asc' ? '↑' : '↓')
}
</script>

<style scoped>
.proposals-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
}

.proposals-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.proposals-list__title {
  font-size: 20px;
  font-weight: 800;
}

.proposals-list__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.proposals-list__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  position: sticky;
  top: 0;
  background: var(--color-bg-page, #f8fafc);
  padding: 8px 0;
  z-index: 5;
}

.proposals-list__filter-input {
  width: 180px;
  flex-shrink: 0;
}

.proposals-list__filter-select {
  width: 150px;
}

.proposals-list__filter-select--wide {
  width: 200px;
}

.proposals-list__filter-date {
  width: 140px;
}

.proposals-list__clear {
  color: var(--color-error);
  font-size: 12px;
}

.proposals-list__table-wrap {
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table thead th {
  padding: 10px 14px;
  background: var(--color-bg-subtle);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

.proposals-list__sortable {
  cursor: pointer;
  user-select: none;
}

.proposals-list__sortable:hover {
  background: var(--color-border);
}

:deep(.proposals-list__sort-icon) {
  margin-left: 4px;
  color: var(--color-primary);
}

:deep(.proposals-list__sort-icon--inactive) {
  color: var(--color-text-subtle);
  opacity: 0.5;
}

/* ── Job Codes column header ─────────────────────────────────────────────── */

.proposals-list__jc-header {
  cursor: pointer;
  user-select: none;
}

.proposals-list__jc-header:hover {
  background: var(--color-border);
}

.proposals-list__jc-header-inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.proposals-list__jc-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  color: #fff;
  border-radius: 9999px;
  font-size: 9px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
}

.proposals-list__filter-icon {
  color: var(--color-text-subtle);
  transition: color 0.15s;
}

.proposals-list__filter-icon.is-active {
  fill: var(--color-primary);
  color: var(--color-primary);
  stroke: var(--color-primary);
}

/* ── Job Codes header popover ────────────────────────────────────────────── */

.proposals-list__jc-panel {
  min-width: 220px;
  display: flex;
  flex-direction: column;
}

.proposals-list__jc-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.proposals-list__jc-panel-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.proposals-list__jc-panel-clear {
  font-size: 12px;
  color: var(--color-primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.proposals-list__jc-panel-list {
  overflow-y: auto;
  max-height: 280px;
  padding: 4px 0;
}

.proposals-list__jc-panel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
  color: var(--color-text);
}

.proposals-list__jc-panel-item:hover {
  background: var(--color-bg-subtle);
}

/* ── Job Codes cell ──────────────────────────────────────────────────────── */

.proposals-list__jc-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.proposals-list__jc-empty {
  color: var(--color-text-subtle);
}

.proposals-list__jc-more {
  font-size: 11px;
  color: var(--color-text-muted);
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  padding: 2px 7px;
  cursor: default;
  white-space: nowrap;
}

.table tbody td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  vertical-align: middle;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.proposals-list__row {
  cursor: pointer;
  transition: background 0.1s;
}

.proposals-list__row:hover {
  background: var(--color-bg-subtle);
}

.proposals-list__number {
  font-weight: 600;
  color: var(--color-primary);
}

.proposals-list__project-name {
  color: var(--color-text-muted);
}

.proposals-list__total {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.skeleton--row {
  height: 48px;
  border-radius: 0;
  border-bottom: 1px solid var(--color-border);
  display: block;
}

.proposals-list__error {
  padding: 24px;
  color: var(--color-error);
  font-size: 14px;
  text-align: center;
}

.proposals-list__pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-top: 1px solid var(--color-border);
}

.proposals-list__pagination-info {
  font-size: 13px;
  color: var(--color-text-muted);
}

.proposals-list__pagination-btns {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: background 0.1s, color 0.1s;
}

.action-btn:hover {
  background: var(--color-bg-subtle);
  color: var(--color-text);
}

.action-btn--danger:hover {
  background: rgba(220, 38, 38, 0.08);
  color: var(--color-error);
}

/* ── Responsive ──────────────────────────────────────────────────────────── */

@media (max-width: 900px) {
  .proposals-list {
    padding: 16px;
    gap: 14px;
  }

  .proposals-list__filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .proposals-list__filter-input,
  .proposals-list__filter-select,
  .proposals-list__filter-select--wide,
  .proposals-list__filter-date {
    width: 100%;
  }

  .proposals-list__clear {
    grid-column: 1 / -1;
  }
}

@media (max-width: 600px) {
  .proposals-list {
    padding: 12px;
  }

  .proposals-list__filters {
    grid-template-columns: 1fr;
  }

  /* Hide Type, Project Name, and Job Codes columns on mobile */
  .table thead th:nth-child(3),
  .table tbody td:nth-child(3),
  .table thead th:nth-child(5),
  .table tbody td:nth-child(5),
  .table thead th:nth-child(6),
  .table tbody td:nth-child(6) {
    display: none;
  }

  .proposals-list__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .proposals-list__header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
