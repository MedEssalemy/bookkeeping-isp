<template>
  <div class="clients-list">
    <!-- Header -->
    <div class="clients-list__header">
      <h1 class="clients-list__title">Clients</h1>
      <div class="clients-list__header-actions">
        <button class="btn btn--secondary btn--sm" @click="handleExport">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
        <button
          v-if="auth.isAdmin"
          class="btn btn--secondary btn--sm"
          @click="handleImportClick"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Import CSV
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".csv,text/csv"
          class="visually-hidden"
          @change="handleImportFile"
        />
      </div>
    </div>

    <!-- Banner: shown after import attempt (stubbed) -->
    <div v-if="banner" :class="['clients-list__banner', `clients-list__banner--${banner.kind}`]">
      {{ banner.text }}
    </div>

    <!-- Filter row -->
    <div class="clients-list__filters">
      <div class="clients-list__search-wrap">
        <svg class="clients-list__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="search"
          class="field__input clients-list__filter-input"
          type="text"
          placeholder="Search by business name…"
        />
      </div>
      <div class="clients-list__total">
        {{ filteredBusinesses.length }} {{ filteredBusinesses.length === 1 ? 'business' : 'businesses' }}
        · {{ totalContacts }} client name{{ totalContacts === 1 ? '' : 's' }}
      </div>
    </div>

    <!-- Table -->
    <div class="clients-list__table-wrap">
      <template v-if="isLoading">
        <div v-for="i in 5" :key="i" class="skeleton skeleton--row" />
      </template>

      <EmptyState
        v-else-if="!filteredBusinesses.length"
        heading="No businesses found"
        :subtext="search ? 'Try a different search.' : 'No clients in the database yet — import a CSV to get started.'"
      />

      <table v-else class="table">
        <thead>
          <tr>
            <th @click="toggleSort('business_name')" class="clients-list__sortable">
              Business <SortIndicator col="business_name" :sort="sort" />
            </th>
            <th @click="toggleSort('contact_count')" class="td--number clients-list__sortable">
              Client Names <SortIndicator col="contact_count" :sort="sort" />
            </th>
            <th @click="toggleSort('facility_count')" class="td--number clients-list__sortable">
              Facilities <SortIndicator col="facility_count" :sort="sort" />
            </th>
            <th @click="toggleSort('row_count')" class="td--number clients-list__sortable">
              Rows <SortIndicator col="row_count" :sort="sort" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="b in filteredBusinesses"
            :key="b.business_name"
            class="clients-list__row"
            @click="goDetail(b)"
          >
            <td class="clients-list__biz">{{ b.business_name }}</td>
            <td class="td--number">{{ b.contact_count }}</td>
            <td class="td--number">{{ b.facility_count }}</td>
            <td class="td--number clients-list__rows">{{ b.row_count }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useRouter } from 'vue-router'
import { useBusinesses, type BusinessSummary } from '../../api/clients'
import { getAllContacts } from '../../mocks/clients'
import { exportContactsAsCSV } from './clientsCsv'
import EmptyState from '../../components/base/EmptyState.vue'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const { data, isLoading } = useBusinesses()
const businesses = computed<BusinessSummary[]>(() => data.value ?? [])

const totalContacts = computed(() => businesses.value.reduce((s, b) => s + b.row_count, 0))

// ── Search ────────────────────────────────────────────────────────────────────
const search = ref('')

// ── Sort ──────────────────────────────────────────────────────────────────────
type SortCol = 'business_name' | 'contact_count' | 'facility_count' | 'row_count'
const sort = ref<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'business_name', dir: 'asc' })

function toggleSort(col: SortCol) {
  if (sort.value.col === col) {
    sort.value.dir = sort.value.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value = { col, dir: col === 'business_name' ? 'asc' : 'desc' }
  }
}

const SortIndicator = (props: { col: SortCol; sort: { col: SortCol; dir: 'asc' | 'desc' } }) => {
  if (props.sort.col !== props.col) {
    return h('span', { class: 'clients-list__sort-icon clients-list__sort-icon--inactive' }, '↕')
  }
  return h('span', { class: 'clients-list__sort-icon' }, props.sort.dir === 'asc' ? '↑' : '↓')
}

// ── Filter + sort pipeline ────────────────────────────────────────────────────
const filteredBusinesses = computed(() => {
  const q = search.value.trim().toLowerCase()
  let arr = q
    ? businesses.value.filter((b) => b.business_name.toLowerCase().includes(q))
    : businesses.value.slice()
  const { col, dir } = sort.value
  arr.sort((a, b) => {
    let cmp = 0
    if (col === 'business_name') cmp = a.business_name.localeCompare(b.business_name)
    else cmp = (a[col] as number) - (b[col] as number)
    return dir === 'asc' ? cmp : -cmp
  })
  return arr
})

function goDetail(b: BusinessSummary) {
  router.push({ name: 'client-detail', params: { business: b.business_name } })
}

// ── Export / Import ──────────────────────────────────────────────────────────
const banner = ref<{ kind: 'info' | 'error'; text: string } | null>(null)
let bannerTimer: ReturnType<typeof setTimeout> | null = null
function showBanner(text: string, kind: 'info' | 'error' = 'info') {
  if (bannerTimer) clearTimeout(bannerTimer)
  banner.value = { kind, text }
  bannerTimer = setTimeout(() => { banner.value = null }, 5000)
}

function handleExport() {
  const all = getAllContacts()
  if (!all.length) {
    showBanner('No client names to export.', 'error')
    return
  }
  exportContactsAsCSV(all, `clients-${new Date().toISOString().slice(0, 10)}.csv`)
  showBanner(`Exported ${all.length} client name${all.length === 1 ? '' : 's'} to CSV.`)
}

const fileInput = ref<HTMLInputElement | null>(null)
function handleImportClick() {
  fileInput.value?.click()
}
function handleImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  // TODO(backend): POST the CSV (or parsed JSON) to /clients/import. For now
  // we just acknowledge the action — actual ingestion lands when the backend
  // is wired.
  // eslint-disable-next-line no-console
  console.info('[stub] Would import CSV', file.name, file.size, 'bytes')
  showBanner(
    `"${file.name}" selected — import will be wired up once the backend endpoint lands.`,
  )
  input.value = ''
}
</script>

<style scoped>
.clients-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.clients-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.clients-list__title {
  font-size: 20px;
  font-weight: 800;
}

.clients-list__header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clients-list__banner {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  border: 1px solid;
}

.clients-list__banner--info {
  background: rgba(29, 78, 216, 0.06);
  border-color: rgba(29, 78, 216, 0.25);
  color: var(--color-primary);
}

.clients-list__banner--error {
  background: rgba(220, 38, 38, 0.06);
  border-color: rgba(220, 38, 38, 0.25);
  color: var(--color-error);
}

.clients-list__filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.clients-list__search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 240px;
  max-width: 360px;
}

.clients-list__search-icon {
  position: absolute;
  left: 10px;
  color: var(--color-text-subtle);
  pointer-events: none;
}

.clients-list__filter-input {
  width: 100%;
  padding-left: 32px;
}

.clients-list__total {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-left: auto;
}

.clients-list__table-wrap {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  min-width: 0;
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

.table .td--number,
.table thead th.td--number {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.table tbody td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
}

.table tbody tr:last-child td { border-bottom: none; }

.clients-list__sortable { cursor: pointer; user-select: none; }
.clients-list__sortable:hover { background: var(--color-border); }

:deep(.clients-list__sort-icon) {
  margin-left: 4px;
  color: var(--color-primary);
}
:deep(.clients-list__sort-icon--inactive) {
  color: var(--color-text-subtle);
  opacity: 0.5;
}

.clients-list__row {
  cursor: pointer;
  transition: background 0.1s;
}

.clients-list__row:hover { background: var(--color-bg-subtle); }

.clients-list__biz {
  font-weight: 600;
  color: var(--color-primary);
}

.clients-list__rows {
  color: var(--color-text-muted);
}

.skeleton--row {
  height: 48px;
  border-radius: 0;
  border-bottom: 1px solid var(--color-border);
  display: block;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 700px) {
  .clients-list__total { margin-left: 0; }
}
</style>
