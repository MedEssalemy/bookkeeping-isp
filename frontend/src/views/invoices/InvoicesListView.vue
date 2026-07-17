<template>
  <div class="inv-list">
    <!-- Page header -->
    <div class="inv-list__header">
      <h1 class="inv-list__title">Invoices</h1>
      <div class="inv-list__header-actions">
        <button v-if="auth.canEdit" class="btn btn--secondary btn--sm" @click="handleExport">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export
        </button>
        <button v-if="auth.canEdit" class="btn btn--primary btn--sm" @click="goNew">
          + New Invoice
        </button>
      </div>
    </div>

    <!-- Filter row -->
    <div class="inv-list__filters">
      <MultiSelect
        v-model="filters.status"
        :options="STATUS_OPTIONS"
        placeholder="All statuses"
        display="chip"
        class="inv-list__filter-select"
      />
      <DatePicker
        v-model="filterDateFrom"
        placeholder="From"
        dateFormat="mm/dd/yy"
        showIcon
        :maxDate="filterDateTo ?? undefined"
        class="inv-list__filter-date"
        @update:modelValue="onDateFromChange"
      />
      <DatePicker
        v-model="filterDateTo"
        placeholder="To"
        dateFormat="mm/dd/yy"
        showIcon
        :minDate="filterDateFrom ?? undefined"
        class="inv-list__filter-date"
        @update:modelValue="onDateToChange"
      />
      <div class="inv-list__search-wrap" :title="`Filter by ${counterpartyLabel.toLowerCase()} name`">
        <svg class="inv-list__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <input
          v-model="filters.client"
          class="field__input inv-list__filter-input inv-list__filter-input--with-icon"
          type="text"
          :placeholder="`${counterpartyLabel}…`"
        />
      </div>
      <MultiSelect
        v-model="filters.job_code"
        :options="jobCodeOptions"
        placeholder="All job codes"
        display="chip"
        :maxSelectedLabels="1"
        filter
        class="inv-list__filter-select inv-list__filter-select--wide"
      />
      <div class="inv-list__search-wrap" :title="'Search by invoice number or PO number'">
        <svg class="inv-list__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="filters.q"
          class="field__input inv-list__filter-input inv-list__filter-input--with-icon"
          type="text"
          placeholder="Search invoice # or PO…"
        />
      </div>
      <button v-if="hasActiveFilters" class="btn btn--ghost btn--sm inv-list__clear" @click="clearFilters">
        Clear all
      </button>
    </div>

    <!-- Table -->
    <div class="inv-list__table-wrap">
      <template v-if="isLoading">
        <div v-for="i in 5" :key="i" class="skeleton skeleton--row" />
      </template>

      <div v-else-if="isError" class="inv-list__error">Failed to load invoices. Please refresh.</div>

      <EmptyState
        v-else-if="filteredItems.length === 0"
        heading="No invoices found"
        :subtext="hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first invoice to get started.'"
      >
        <template v-if="!hasActiveFilters && auth.canEdit" #cta>
          <button class="btn btn--primary btn--sm" @click="goNew">+ New Invoice</button>
        </template>
      </EmptyState>

      <table v-else class="table">
        <thead>
          <tr>
            <th @click="toggleSort('number')" class="inv-list__sortable">Invoice # <SortIndicator :col="'number'" :sort="sort" /></th>
            <th @click="toggleSort('date')" class="inv-list__sortable">Date <SortIndicator :col="'date'" :sort="sort" /></th>
            <th @click="toggleSort('client')" class="inv-list__sortable">{{ counterpartyLabel }} <SortIndicator :col="'client'" :sort="sort" /></th>
            <th>PO #</th>
            <th>Job Codes</th>
            <th @click="toggleSort('status')" class="inv-list__sortable">Status <SortIndicator :col="'status'" :sort="sort" /></th>
            <th @click="toggleSort('total')" class="td--number inv-list__sortable">Total <SortIndicator :col="'total'" :sort="sort" /></th>
            <th @click="toggleSort('balance')" class="td--number inv-list__sortable">Balance <SortIndicator :col="'balance'" :sort="sort" /></th>
            <th class="td--actions"><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in paginatedItems"
            :key="item.id"
            class="inv-list__row"
            @click="router.push({ name: 'invoice-detail', params: { id: item.id } })"
          >
            <td class="inv-list__number">{{ item.number }}</td>
            <td>{{ formatDate(item.date) }}</td>
            <td>{{ item.client_name || '—' }}</td>
            <td @click.stop>
              <router-link
                v-if="item.po_id"
                class="inv-list__link"
                :to="{ name: 'po-detail', params: { id: item.po_id } }"
              >{{ item.po_number || 'View' }}</router-link>
              <span v-else>—</span>
            </td>
            <td @click.stop>
              <div v-if="!item.job_codes.length" class="inv-list__jc-empty">—</div>
              <div v-else class="inv-list__jc-chips">
                <StatusBadge
                  v-for="code in item.job_codes.slice(0, 3)"
                  :key="code"
                  :label="code"
                  variant="light-gray"
                />
                <span
                  v-if="item.job_codes.length > 3"
                  v-tooltip="item.job_codes.slice(3).join('\n')"
                  class="inv-list__jc-more"
                >+{{ item.job_codes.length - 3 }}</span>
              </div>
            </td>
            <td @click.stop>
              <div class="inv-list__status-cell">
                <StatusPopover
                  :status="item.status"
                  :options="statusOptionsFor(item.direction)"
                  :variantMap="INVOICE_STATUS_VARIANTS"
                  :loading="updatingStatus === item.id"
                  @change="(s) => onStatusChange(item, s)"
                />
                <StatusBadge v-if="item.is_overdue" label="Overdue" variant="red" />
              </div>
            </td>
            <td class="td--number inv-list__total">{{ formatCurrency(item.total) }}</td>
            <td class="td--number inv-list__balance">{{ item.status === 'Paid' ? '—' : formatCurrency(item.balance_due) }}</td>
            <td class="td--actions" @click.stop>
              <ActionButtons>
                <button
                  v-if="auth.canEdit"
                  class="action-btn"
                  title="Edit"
                  @click="router.push({ name: 'invoice-edit', params: { id: item.id } })"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  v-if="auth.canEdit && direction === 'issued'"
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
                  v-if="auth.canEdit && item.status !== 'Paid'"
                  class="action-btn"
                  title="Mark Paid"
                  @click="confirmMarkPaid(item)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                </button>
                <button
                  v-if="auth.canEdit"
                  class="action-btn action-btn--danger"
                  title="Delete"
                  @click="confirmDelete(item)"
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

      <div v-if="filteredItems.length > pageSize" class="inv-list__pagination">
        <span class="inv-list__pagination-info">
          {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, filteredItems.length) }}
          of {{ filteredItems.length }}
        </span>
        <div class="inv-list__pagination-btns">
          <button class="btn btn--secondary btn--sm" :disabled="page <= 1" @click="page--">Prev</button>
          <button class="btn btn--secondary btn--sm" :disabled="page * pageSize >= filteredItems.length" @click="page++">Next</button>
        </div>
      </div>
    </div>

    <!-- Mark Paid confirm -->
    <ConfirmModal
      v-model:visible="showMarkPaidModal"
      title="Mark invoice as paid?"
      :message="`Record ${markPaidTarget?.number} as fully paid (${markPaidTarget ? formatCurrency(markPaidTarget.total) : ''})?`"
      confirmLabel="Mark Paid"
      variant="info"
      @confirm="onMarkPaidConfirm"
      @cancel="showMarkPaidModal = false"
    />

    <!-- Delete confirm -->
    <ConfirmModal
      v-model:visible="showDeleteModal"
      title="Delete invoice?"
      :message="`Are you sure you want to delete ${deleteTarget?.number}? This cannot be undone.`"
      confirmLabel="Delete"
      variant="danger"
      @confirm="onDeleteConfirm"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import MultiSelect from 'primevue/multiselect'
import DatePicker from 'primevue/datepicker'
import { useAuthStore } from '../../stores/auth'
import {
  useInvoiceList,
  useUpdateInvoiceStatus,
  useMarkInvoicePaid,
  useDeleteInvoice,
  useGenerateDocument,
} from '../../api/invoices'
import { useConfigList } from '../../composables/useConfigList'
import { exportDocuments } from '../../utils/documentExport'
import StatusBadge from '../../components/base/StatusBadge.vue'
import EmptyState from '../../components/base/EmptyState.vue'
import ActionButtons from '../../components/base/ActionButtons.vue'
import ConfirmModal from '../../components/base/ConfirmModal.vue'
import StatusPopover from '../../components/documents/StatusPopover.vue'
import { INVOICE_STATUSES, INVOICE_STATUS_VARIANTS } from '../../types/invoice'
import type { InvoiceListItem, InvoiceListParams, InvoiceStatus } from '../../types/invoice'
import type { DocDirection } from '../../types/common'
import type { JobCode } from '../../types/proposal'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const direction = computed<DocDirection>(() => (route.meta.direction as DocDirection) ?? 'issued')
const counterpartyLabel = computed(() => (direction.value === 'issued' ? 'Client' : 'Contractor'))

// The status filter includes a virtual "Overdue" pseudo-status (§5.1).
type FilterStatus = InvoiceStatus | 'Overdue'

// ── Filters ───────────────────────────────────────────────────────────────────
const filters = ref<{
  q: string
  status: FilterStatus[]
  from: string
  to: string
  client: string
  job_code: JobCode[]
}>({ q: '', status: [], from: '', to: '', client: '', job_code: [] })

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
  !!filters.value.from ||
  !!filters.value.to ||
  !!filters.value.client ||
  filters.value.job_code.length > 0,
)

function clearFilters() {
  filters.value = { q: '', status: [], from: '', to: '', client: '', job_code: [] }
  filterDateFrom.value = null
  filterDateTo.value = null
  page.value = 1
}

const STATUS_OPTIONS = computed<FilterStatus[]>(() => [...INVOICE_STATUSES[direction.value], 'Overdue'])
function statusOptionsFor(dir: DocDirection): InvoiceStatus[] { return INVOICE_STATUSES[dir] }

// ── Data ──────────────────────────────────────────────────────────────────────
const queryParams = computed<InvoiceListParams>(() => ({ direction: direction.value, page: 1, page_size: 1000 }))
const { data, isLoading, isError } = useInvoiceList(queryParams)
const { options: jobCodeOptions } = useConfigList('job_codes')

const allItems = computed<InvoiceListItem[]>(() => data.value?.items ?? [])

const filteredItems = computed(() => {
  const f = filters.value
  const statusSet = f.status.filter((s) => s !== 'Overdue') as InvoiceStatus[]
  const overdueOnly = f.status.includes('Overdue')
  return allItems.value.filter((item) => {
    if (f.q) {
      const q = f.q.toLowerCase()
      if (!item.number.toLowerCase().includes(q) && !(item.po_number ?? '').toLowerCase().includes(q)) return false
    }
    // Status chips OR the Overdue flag (either match passes when both chosen).
    if (statusSet.length || overdueOnly) {
      const statusMatch = statusSet.includes(item.status)
      const overdueMatch = overdueOnly && item.is_overdue
      if (!statusMatch && !overdueMatch) return false
    }
    if (f.from && item.date < f.from) return false
    if (f.to && item.date > f.to) return false
    if (f.client && !item.client_name.toLowerCase().includes(f.client.toLowerCase())) return false
    if (f.job_code.length && !item.job_codes.some((c) => f.job_code.includes(c))) return false
    return true
  })
})

watch(filters, () => { page.value = 1 }, { deep: true })

// ── Sort ──────────────────────────────────────────────────────────────────────
type SortCol = 'number' | 'date' | 'client' | 'status' | 'total' | 'balance'
const sort = ref<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'date', dir: 'desc' })
function toggleSort(col: SortCol) {
  if (sort.value.col === col) sort.value.dir = sort.value.dir === 'asc' ? 'desc' : 'asc'
  else sort.value = { col, dir: 'asc' }
}
const STATUS_ORDER: Record<InvoiceStatus, number> = { Draft: 0, Unpaid: 1, 'Partially Paid': 2, Paid: 3 }
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

const sortedItems = computed(() => {
  const arr = filteredItems.value.slice()
  const { col, dir } = sort.value
  arr.sort((a, b) => {
    let cmp = 0
    if (col === 'number') cmp = collator.compare(a.number, b.number)
    else if (col === 'date') cmp = a.date.localeCompare(b.date)
    else if (col === 'client') cmp = collator.compare(a.client_name, b.client_name)
    else if (col === 'status') cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    else if (col === 'total') cmp = a.total - b.total
    else if (col === 'balance') cmp = a.balance_due - b.balance_due
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
const { mutate: updateStatus } = useUpdateInvoiceStatus()
function onStatusChange(item: InvoiceListItem, status: InvoiceStatus) {
  updatingStatus.value = item.id
  updateStatus({ id: item.id, status }, { onSettled: () => { updatingStatus.value = null } })
}

// ── Mark Paid ─────────────────────────────────────────────────────────────────
const showMarkPaidModal = ref(false)
const markPaidTarget = ref<InvoiceListItem | null>(null)
const { mutate: markPaid } = useMarkInvoicePaid()
function confirmMarkPaid(item: InvoiceListItem) {
  markPaidTarget.value = item
  showMarkPaidModal.value = true
}
function onMarkPaidConfirm() {
  const target = markPaidTarget.value
  showMarkPaidModal.value = false
  if (target) markPaid(target.id)
}

// ── Generate Document (issued only) ───────────────────────────────────────────
const { mutateAsync: generateDoc } = useGenerateDocument()
async function handleGenerateDoc(item: InvoiceListItem) {
  const blob = await generateDoc(item.id)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${item.number}.docx`
  a.click()
  URL.revokeObjectURL(url)
}

// ── New / Delete ──────────────────────────────────────────────────────────────
function goNew() {
  router.push({ name: 'invoice-new', query: { direction: direction.value } })
}

async function handleExport() {
  const stamp = new Date().toISOString().slice(0, 10)
  await exportDocuments('invoices', filteredItems.value.map((i) => i.id), `invoices-${direction.value}-${stamp}.csv`)
}

const showDeleteModal = ref(false)
const deleteTarget = ref<InvoiceListItem | null>(null)
const { mutate: deleteInvoice } = useDeleteInvoice()
function confirmDelete(item: InvoiceListItem) {
  deleteTarget.value = item
  showDeleteModal.value = true
}
function onDeleteConfirm() {
  const target = deleteTarget.value
  showDeleteModal.value = false
  if (target) deleteInvoice(target.id)
}

// ── Formatters ────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const SortIndicator = (props: { col: SortCol; sort: { col: SortCol; dir: 'asc' | 'desc' } }) => {
  if (props.sort.col !== props.col) return h('span', { class: 'inv-list__sort-icon inv-list__sort-icon--inactive' }, '↕')
  return h('span', { class: 'inv-list__sort-icon' }, props.sort.dir === 'asc' ? '↑' : '↓')
}
</script>

<style scoped>
.inv-list { display: flex; flex-direction: column; gap: 16px; height: 100%; min-height: 0; }
.inv-list__header, .inv-list__filters { flex-shrink: 0; }
.inv-list__header {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
}
.inv-list__title { font-size: 20px; font-weight: 800; }
.inv-list__header-actions { display: flex; align-items: center; gap: 8px; }

.inv-list__filters {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  padding: 12px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px;
}
.inv-list__filter-input { width: 180px; flex-shrink: 0; }
.inv-list__search-wrap {
  position: relative; display: flex; align-items: center;
  flex: 1 1 200px; min-width: 180px; max-width: 360px;
}
.inv-list__search-icon { position: absolute; left: 10px; color: var(--color-text-subtle); pointer-events: none; }
.inv-list__filter-input--with-icon { width: 100%; padding-left: 32px; }
.inv-list__filter-select { width: 150px; }
.inv-list__filter-select--wide { width: 200px; }
.inv-list__filter-date { width: 140px; }
.inv-list__clear { color: var(--color-text-muted); font-size: 12px; }
.inv-list__clear:hover { color: var(--color-text); background: var(--color-bg-subtle); }

.inv-list__table-wrap {
  display: flex; flex-direction: column;
  background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px;
  flex: 1; min-height: 0; min-width: 0; overflow: auto; -webkit-overflow-scrolling: touch;
}
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table thead th {
  padding: 10px 14px; background: var(--color-bg-subtle);
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--color-text-subtle); border-bottom: 1px solid var(--color-border);
  text-align: left; white-space: nowrap; position: sticky; top: 0; z-index: 3;
}
.inv-list__sortable { cursor: pointer; user-select: none; }
.inv-list__sortable:hover { background: var(--color-border); }
:deep(.inv-list__sort-icon) { margin-left: 4px; color: var(--color-primary); }
:deep(.inv-list__sort-icon--inactive) { color: var(--color-text-subtle); opacity: 0.5; }

.inv-list__status-cell { display: inline-flex; align-items: center; gap: 6px; }
.inv-list__jc-chips { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.inv-list__jc-empty { color: var(--color-text-subtle); }
.inv-list__jc-more {
  font-size: 11px; color: var(--color-text-muted); background: var(--color-bg-subtle);
  border: 1px solid var(--color-border); border-radius: 9999px; padding: 2px 7px; cursor: default; white-space: nowrap;
}
.inv-list__link { color: var(--color-primary); text-decoration: none; }
.inv-list__link:hover { text-decoration: underline; }

.table tbody td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: middle; }
.table tbody tr:last-child td { border-bottom: none; }

.td--actions {
  position: sticky; right: 0; z-index: 2; width: 1%; white-space: nowrap; text-align: right;
  background: var(--color-bg); box-shadow: -8px 0 8px -8px rgba(15, 23, 42, 0.12);
}
.table thead th.td--actions { background: var(--color-bg-subtle); z-index: 5; }

.inv-list__row { cursor: pointer; transition: background 0.1s; }
.inv-list__row:hover { background: var(--color-bg-subtle); }
.inv-list__row:hover .td--actions { background: var(--color-bg-subtle); }
.inv-list__number { font-weight: 600; color: var(--color-primary); }
.inv-list__total, .inv-list__balance { font-weight: 600; font-variant-numeric: tabular-nums; }

.skeleton--row { height: 48px; border-radius: 0; border-bottom: 1px solid var(--color-border); display: block; }
.inv-list__error { padding: 24px; color: var(--color-error); font-size: 14px; text-align: center; }

.inv-list__pagination {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-top: 1px solid var(--color-border);
}
.inv-list__pagination-info { font-size: 13px; color: var(--color-text-muted); }
.inv-list__pagination-btns { display: flex; gap: 8px; }

.action-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px; border: none; background: none; cursor: pointer;
  color: var(--color-text-muted); transition: background 0.1s, color 0.1s;
}
.action-btn:hover { background: var(--color-bg-subtle); color: var(--color-text); }
.action-btn--danger:hover { background: rgba(220, 38, 38, 0.08); color: var(--color-error); }

.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

@media (max-width: 900px) {
  .inv-list__filters { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px; }
  .inv-list__filter-input, .inv-list__filter-select, .inv-list__filter-select--wide,
  .inv-list__filter-date, .inv-list__search-wrap { width: 100%; max-width: none; min-width: 0; }
  .inv-list__clear { grid-column: 1 / -1; justify-self: start; }
}
@media (max-width: 600px) {
  .inv-list__filters { grid-template-columns: 1fr; }
  .inv-list__header { flex-direction: column; align-items: flex-start; }
  .inv-list__header-actions { width: 100%; justify-content: flex-end; flex-wrap: wrap; }
}
</style>
