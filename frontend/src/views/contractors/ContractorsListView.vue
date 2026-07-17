<template>
  <div class="contractors-list">
    <!-- Header -->
    <div class="contractors-list__header">
      <h1 class="contractors-list__title">Contractors</h1>
      <div class="contractors-list__header-actions">
        <button v-if="auth.canEdit" class="btn btn--primary btn--sm" @click="openAddModal">+ Add Contractor</button>

        <div ref="exportMenuRef" class="contractors-list__split">
          <button class="btn btn--secondary btn--sm" :aria-expanded="exportMenuOpen" @click="exportMenuOpen = !exportMenuOpen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <Transition name="cl-menu">
            <div v-if="exportMenuOpen" class="contractors-list__menu">
              <button type="button" class="contractors-list__menu-item" @click="handleExport('xlsx')">Excel (.xlsx)</button>
              <button type="button" class="contractors-list__menu-item" @click="handleExport('csv')">CSV (.csv)</button>
            </div>
          </Transition>
        </div>

        <button v-if="auth.isAdmin" class="btn btn--secondary btn--sm" @click="handleImportClick">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Import
        </button>
        <input
          ref="fileInput"
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          class="visually-hidden"
          @change="handleImportFile"
        />
      </div>
    </div>

    <div v-if="banner" :class="['contractors-list__banner', `contractors-list__banner--${banner.kind}`]">
      {{ banner.text }}
    </div>

    <div class="contractors-list__filters">
      <div class="contractors-list__search-wrap">
        <svg class="contractors-list__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="search"
          class="field__input contractors-list__filter-input"
          type="text"
          placeholder="Search name, business, facility, address, email…"
        />
      </div>
      <div class="contractors-list__total">
        {{ filteredRows.length }} of {{ rows.length }} contractor name{{ rows.length === 1 ? '' : 's' }}
        · {{ businessCount }} business{{ businessCount === 1 ? '' : 'es' }}
      </div>
    </div>

    <div class="contractors-list__table-wrap">
      <div v-if="isLoading" class="contractors-list__skeletons">
        <div v-for="i in 5" :key="i" class="skeleton skeleton--row" />
      </div>

      <EmptyState
        v-else-if="!filteredRows.length"
        heading="No contractor names found"
        :subtext="search
          ? 'Try a different search, or clear the filter.'
          : 'No contractors in the database yet — add one or import a CSV/Excel file to get started.'"
      />

      <table v-else class="table contractors-table">
        <thead>
          <tr>
            <th>Contractor Name</th>
            <th>Facility</th>
            <th>Department</th>
            <th>Title</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Address</th>
            <th v-if="auth.canEdit" class="contractors-table__actions-col" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groupedRows" :key="group.business">
            <tr class="contractors-table__group">
              <td :colspan="auth.canEdit ? 8 : 7" class="contractors-table__group-cell">
                <div class="contractors-table__group-inner">
                  <span class="contractors-table__group-name">{{ group.business }}</span>
                  <span class="contractors-table__group-count">
                    {{ group.rows.length }} contractor name{{ group.rows.length === 1 ? '' : 's' }}
                  </span>
                </div>
              </td>
            </tr>
            <tr v-for="r in group.rows" :key="r.id" class="contractors-table__row" @click="openEditModal(r)">
              <td class="contractors-table__name">{{ r.name || '—' }}</td>
              <td>{{ r.facility || '—' }}</td>
              <td>{{ r.department || '—' }}</td>
              <td>{{ r.title || '—' }}</td>
              <td class="contractors-table__nowrap">{{ r.phone || '—' }}</td>
              <td>
                <a v-if="r.email" :href="`mailto:${cleanEmail(r.email)}`" @click.stop>{{ cleanEmail(r.email) }}</a>
                <span v-else>—</span>
              </td>
              <td class="contractors-table__addr">{{ formatAddress(r) }}</td>
              <td v-if="auth.canEdit" class="contractors-table__actions" @click.stop>
                <button
                  type="button"
                  class="action-btn action-btn--danger"
                  title="Delete contractor"
                  :aria-label="`Delete ${r.name}`"
                  @click="askDelete(r)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <ContractorFormModal
      v-model:visible="formModalOpen"
      :contact="editingContact"
      @created="onContactCreated"
      @updated="onContactUpdated"
    />

    <ConfirmModal
      v-model:visible="deleteConfirmOpen"
      title="Delete this contractor name?"
      :message="deleteConfirmMessage"
      confirmLabel="Delete"
      variant="danger"
      @confirm="onDeleteConfirm"
      @cancel="deleteConfirmOpen = false"
    />

    <ImportPreviewModal
      v-model:visible="importModalOpen"
      :plan="importPlan"
      :parse-result="parseResult"
      :is-committing="isCommittingImport"
      @confirm="onImportConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  useAllContractors,
  useDeleteContractor,
  useCommitContractorImport,
  planContractorImport,
  type ContractorRow,
} from '../../api/contractors'
import type { ImportPlan } from '../../mocks/clients'
import { contractorsIO, type ParseResult } from '../../utils/partyIO'
import EmptyState from '../../components/base/EmptyState.vue'
import ContractorFormModal from './ContractorFormModal.vue'
import ConfirmModal from '../../components/base/ConfirmModal.vue'
import ImportPreviewModal from '../clients/ImportPreviewModal.vue'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()

const { data, isLoading } = useAllContractors()
const rows = computed<ContractorRow[]>(() => data.value ?? [])

// ── Search + group ──────────────────────────────────────────────────────────
const search = ref('')

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) =>
    [r.name, r.business_name, r.facility, r.department, r.title, r.phone, r.email, r.address, r.city, r.state, r.zip, r.address_full]
      .some((v) => (v ?? '').toLowerCase().includes(q)),
  )
})

interface Group { business: string; rows: ContractorRow[] }
const groupedRows = computed<Group[]>(() => {
  const map = new Map<string, ContractorRow[]>()
  for (const r of filteredRows.value) {
    const biz = (r.business_name ?? '').trim() || '(Unspecified)'
    let list = map.get(biz)
    if (!list) { list = []; map.set(biz, list) }
    list.push(r)
  }
  const sortedBiz = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return sortedBiz.map((business) => ({
    business,
    rows: (map.get(business) ?? []).slice().sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })),
  }))
})
const businessCount = computed(() => groupedRows.value.length)

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATE_ABBR: Record<string, string> = { California: 'CA', Texas: 'TX', 'New York': 'NY', Nevada: 'NV' }
function formatAddress(r: ContractorRow): string {
  if (r.address_full) return r.address_full
  const state = r.state ? (STATE_ABBR[r.state.trim()] ?? r.state.trim()) : ''
  const cityZip = [r.city, [state, r.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  return [r.address, cityZip].filter(Boolean).join(', ') || '—'
}
function cleanEmail(e: string): string { return e.replace(/[<>]/g, '').trim() }

// ── Banner ──────────────────────────────────────────────────────────────────
const banner = ref<{ kind: 'info' | 'error' | 'success'; text: string } | null>(null)
let bannerTimer: ReturnType<typeof setTimeout> | null = null
function showBanner(text: string, kind: 'info' | 'error' | 'success' = 'success') {
  if (bannerTimer) clearTimeout(bannerTimer)
  banner.value = { kind, text }
  bannerTimer = setTimeout(() => { banner.value = null }, 5000)
}

// ── Add / Edit modal ────────────────────────────────────────────────────────
const formModalOpen = ref(false)
const editingContact = ref<ContractorRow | null>(null)
function openAddModal() { editingContact.value = null; formModalOpen.value = true }
function openEditModal(c: ContractorRow) {
  if (!auth.canEdit) return
  editingContact.value = c
  formModalOpen.value = true
}
function onContactCreated(c: ContractorRow) { showBanner(`Added ${c.name}${c.business_name ? ` at ${c.business_name}` : ''}.`) }
function onContactUpdated(c: ContractorRow) { showBanner(`Updated ${c.name}.`) }

// ── Delete (with document-reference guard) ────────────────────────────────────
const deleteConfirmOpen = ref(false)
const pendingDelete = ref<ContractorRow | null>(null)
const { mutateAsync: deleteContractor } = useDeleteContractor()

const deleteConfirmMessage = computed(() => {
  const c = pendingDelete.value
  if (!c) return ''
  const where = c.business_name ? ` at ${c.business_name}` : ''
  const facility = c.facility ? ` (${c.facility})` : ''
  return `Delete ${c.name}${where}${facility}? This can't be undone.`
})

function askDelete(c: ContractorRow) { pendingDelete.value = c; deleteConfirmOpen.value = true }

async function onDeleteConfirm() {
  const c = pendingDelete.value
  if (!c) return
  deleteConfirmOpen.value = false
  try {
    await deleteContractor(c.id)
    showBanner(`Deleted ${c.name}.`)
  } catch (err: unknown) {
    const e = err as { status?: number; count?: number }
    if (e?.status === 409) {
      const n = e.count ?? 0
      showBanner(`Can't delete ${c.name}: referenced by ${n} document${n === 1 ? '' : 's'}. Remove those links first.`, 'error')
    } else {
      showBanner(`Failed to delete ${c.name}.`, 'error')
    }
  }
  pendingDelete.value = null
}

// ── Export ──────────────────────────────────────────────────────────────────
const exportMenuOpen = ref(false)
const exportMenuRef = ref<HTMLElement | null>(null)
function handleClickOutside(e: MouseEvent) {
  if (!exportMenuOpen.value) return
  if (exportMenuRef.value && !exportMenuRef.value.contains(e.target as Node)) exportMenuOpen.value = false
}
onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))

function handleExport(format: 'csv' | 'xlsx') {
  exportMenuOpen.value = false
  const all = rows.value
  if (!all.length) { showBanner('No contractor names to export.', 'error'); return }
  const stamp = new Date().toISOString().slice(0, 10)
  if (format === 'xlsx') contractorsIO.exportContactsAsXLSX(all, `contractors-${stamp}.xlsx`)
  else contractorsIO.exportContactsAsCSV(all, `contractors-${stamp}.csv`)
  showBanner(`Exported ${all.length} contractor name${all.length === 1 ? '' : 's'} to ${format.toUpperCase()}.`)
}

// ── Import ──────────────────────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const importModalOpen = ref(false)
const importPlan = ref<ImportPlan | null>(null)
const parseResult = ref<ParseResult | null>(null)
const { mutateAsync: commitImport, isPending: isCommittingImport } = useCommitContractorImport()

function handleImportClick() { fileInput.value?.click() }

async function handleImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const parsed = await contractorsIO.parseFile(file)
    parseResult.value = parsed
    if (parsed.rows.length === 0) {
      showBanner(`Couldn't read any rows from "${file.name}". Check the sheet has the expected columns.`, 'error')
      return
    }
    importPlan.value = planContractorImport(parsed.rows)
    importModalOpen.value = true
  } catch (err) {
    showBanner(`Failed to read "${file.name}". Is it a valid CSV or Excel file?`, 'error')
    // eslint-disable-next-line no-console
    console.error('Contractor import parse error', err)
  }
}

async function onImportConfirm() {
  const plan = importPlan.value
  if (!plan) return
  const committed = await commitImport(plan)
  importModalOpen.value = false
  showBanner(`Imported ${committed.newCount} new and ${committed.updateCount} updated contractor name${committed.newCount + committed.updateCount === 1 ? '' : 's'}.`)
  importPlan.value = null
  parseResult.value = null
}
</script>

<style scoped>
.contractors-list { display: flex; flex-direction: column; gap: 16px; height: 100%; min-height: 0; }
.contractors-list__header, .contractors-list__filters, .contractors-list__banner { flex-shrink: 0; }
.contractors-list__header {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
}
.contractors-list__title { font-size: 20px; font-weight: 800; }
.contractors-list__header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.contractors-list__banner { padding: 10px 14px; border-radius: 8px; font-size: 13px; border: 1px solid; }
.contractors-list__banner--info, .contractors-list__banner--success {
  background: rgba(29, 78, 216, 0.06); border-color: rgba(29, 78, 216, 0.25); color: var(--color-primary);
}
.contractors-list__banner--error {
  background: rgba(220, 38, 38, 0.06); border-color: rgba(220, 38, 38, 0.25); color: var(--color-error);
}

.contractors-list__filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.contractors-list__search-wrap { position: relative; display: flex; align-items: center; flex: 1 1 280px; max-width: 420px; }
.contractors-list__search-icon { position: absolute; left: 10px; color: var(--color-text-subtle); pointer-events: none; }
.contractors-list__filter-input { width: 100%; padding-left: 32px; }
.contractors-list__total { font-size: 12px; color: var(--color-text-muted); margin-left: auto; }

.contractors-list__table-wrap {
  background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 8px;
  flex: 1; min-height: 0; min-width: 0; overflow: auto;
}
.contractors-list__skeletons { display: flex; flex-direction: column; padding: 0; }

.contractors-list__split { position: relative; }
.contractors-list__menu {
  position: absolute; top: calc(100% + 4px); right: 0; min-width: 160px;
  background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 6px;
  box-shadow: var(--shadow-card); padding: 4px; display: flex; flex-direction: column; gap: 1px; z-index: 30;
}
.contractors-list__menu-item {
  padding: 8px 10px; border: none; background: none; border-radius: 4px; cursor: pointer;
  font-size: 13px; color: var(--color-text); font-family: var(--font-sans); text-align: left;
}
.contractors-list__menu-item:hover { background: var(--color-bg-subtle); }
.cl-menu-enter-active, .cl-menu-leave-active { transition: opacity 0.1s, transform 0.1s; }
.cl-menu-enter-from, .cl-menu-leave-to { opacity: 0; transform: translateY(-4px); }

.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table thead th {
  padding: 10px 14px; background: var(--color-bg-subtle); font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-subtle);
  border-bottom: 1px solid var(--color-border); text-align: left; white-space: nowrap;
  position: sticky; top: 0; z-index: 4;
}
.table tbody td { padding: 11px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: top; }
.contractors-table__row { cursor: pointer; transition: background 0.1s; }
.contractors-table__row:hover { background: var(--color-bg-subtle); }
.contractors-table__name { font-weight: 600; color: var(--color-primary); white-space: nowrap; }
.contractors-table__nowrap { white-space: nowrap; }
.contractors-table__addr { font-size: 12px; color: var(--color-text-muted); white-space: nowrap; }

.contractors-table__group td {
  background: var(--color-bg-subtle); padding: 0; border-bottom: 1px solid var(--color-border);
  border-top: 2px solid var(--color-border); position: sticky; top: 36px; z-index: 2;
}
.contractors-table__group:first-child td { border-top: none; }
.contractors-table__group-cell { padding: 0; }
.contractors-table__group-inner {
  position: sticky; left: 0; display: inline-flex; align-items: baseline; gap: 10px; padding: 8px 14px;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted);
}
.contractors-table__group-name { color: var(--color-text); letter-spacing: 0.04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.contractors-table__group-count { font-weight: 500; font-size: 10.5px; text-transform: none; letter-spacing: 0; color: var(--color-text-subtle); flex-shrink: 0; }

.contractors-table__actions-col { width: 1%; }
.contractors-table__actions { text-align: right; white-space: nowrap; }
.action-btn {
  display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  border-radius: 6px; border: none; background: none; cursor: pointer; color: var(--color-text-muted);
  transition: background 0.1s, color 0.1s;
}
.action-btn:hover { background: var(--color-bg-subtle); color: var(--color-text); }
.action-btn--danger:hover { background: rgba(220, 38, 38, 0.08); color: var(--color-error); }

.skeleton--row { height: 48px; border-radius: 0; border-bottom: 1px solid var(--color-border); display: block; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
@media (max-width: 700px) { .contractors-list__total { margin-left: 0; } }
</style>
