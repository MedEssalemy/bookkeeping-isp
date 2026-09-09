<template>
  <div class="cfg-editor card card--padded">
    <div class="cfg-editor__head">
      <h3 class="cfg-editor__title">{{ title }}</h3>
      <div class="cfg-editor__head-right">
        <span class="cfg-editor__count">{{ activeCount }} active · {{ items.length }} total</span>
        <button class="btn btn--ghost btn--xs" @click="exportCsv">Export CSV</button>
      </div>
    </div>
    <p class="cfg-editor__hint">
      Renaming a value never changes documents already saved — they keep the label as entered.
      Deactivated values stay on old documents but can't be picked on new ones.
    </p>

    <div v-if="error" class="cfg-editor__banner cfg-editor__banner--error">{{ error }}</div>

    <table class="cfg-editor__table">
      <thead>
        <tr>
          <th>{{ labelHeader }}</th>
          <th v-for="f in fields" :key="f.key">{{ f.label }}</th>
          <th class="cfg-editor__num">Usage</th>
          <th>Status</th>
          <th class="cfg-editor__actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in items" :key="row.id" :class="{ 'is-inactive': row.active === false }">
          <td>
            <input v-model="drafts[row.id].label" class="field__input cfg-editor__input" type="text" />
          </td>
          <td v-for="f in fields" :key="f.key">
            <input
              v-model="drafts[row.id][f.key]"
              class="field__input cfg-editor__input"
              :type="f.type === 'number' ? 'number' : 'text'"
              :min="f.type === 'number' ? 0 : undefined"
            />
          </td>
          <td class="cfg-editor__num">{{ usage[row.label] ?? 0 }}</td>
          <td>
            <span :class="['cfg-editor__badge', row.active === false ? 'is-off' : 'is-on']">
              {{ row.active === false ? 'Inactive' : 'Active' }}
            </span>
          </td>
          <td class="cfg-editor__actions">
            <button v-if="isDirty(row)" class="btn btn--primary btn--xs" @click="save(row)">Save</button>
            <button class="btn btn--ghost btn--xs" @click="toggle(row)">
              {{ row.active === false ? 'Reactivate' : 'Deactivate' }}
            </button>
            <button
              v-if="(usage[row.label] ?? 0) === 0"
              class="btn btn--ghost btn--xs cfg-editor__del"
              @click="askDelete(row)"
            >Delete</button>
            <span v-else class="cfg-editor__used" :title="`Used in ${usage[row.label]} document(s)`">
              in use ({{ usage[row.label] }})
            </span>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="cfg-editor__add-row">
          <td>
            <input
              v-model="newItem.label"
              class="field__input cfg-editor__input"
              type="text"
              :placeholder="`Add ${labelHeader.toLowerCase()}…`"
              @keydown.enter="add"
            />
          </td>
          <td v-for="f in fields" :key="f.key">
            <input
              v-model="newItem.extras[f.key]"
              class="field__input cfg-editor__input"
              :type="f.type === 'number' ? 'number' : 'text'"
              :min="f.type === 'number' ? 0 : undefined"
              :placeholder="f.label"
            />
          </td>
          <td></td>
          <td></td>
          <td class="cfg-editor__actions">
            <button class="btn btn--secondary btn--xs" :disabled="!newItem.label.trim()" @click="add">+ Add</button>
          </td>
        </tr>
      </tfoot>
    </table>

    <ConfirmModal
      v-model:visible="deleteOpen"
      title="Delete this value?"
      :message="`Delete “${pendingDelete?.label}”? It isn't used by any document, so this is safe.`"
      confirmLabel="Delete"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useConfigList } from '../../composables/useConfigList'
import {
  useConfigListUsage,
  useAddListItem,
  useUpdateListItem,
  useToggleListItem,
  useDeleteListItem,
  type ConfigListItem,
  type ConfigListName,
  type ListItemExtras,
} from '../../api/configLists'
import ConfirmModal from '../base/ConfirmModal.vue'

type ExtraKey = keyof ListItemExtras
interface FieldDef { key: ExtraKey; label: string; type?: 'text' | 'number' }

const props = withDefaults(defineProps<{
  name: ConfigListName
  title: string
  labelHeader?: string
  fields?: FieldDef[]
}>(), {
  labelHeader: 'Label',
  fields: () => [],
})

const nameRef = computed(() => props.name)

// includeInactive so the editor can show + reactivate deactivated rows.
const { items } = useConfigList(props.name, { includeInactive: true })
const { data: usageData } = useConfigListUsage(nameRef)
const usage = computed<Record<string, number>>(() => usageData.value ?? {})

const activeCount = computed(() => items.value.filter((i) => i.active !== false).length)

// ── Per-row editable drafts ───────────────────────────────────────────────────
type Draft = { label: string } & Record<string, string | number | undefined>
const drafts = reactive<Record<string, Draft>>({})

watch(items, (list) => {
  for (const item of list) {
    const d: Draft = { label: item.label }
    for (const f of props.fields) d[f.key] = item[f.key] as string | number | undefined
    // Only (re)seed rows we aren't currently editing to avoid clobbering input.
    if (!drafts[item.id] || !isDirtyDraft(item, drafts[item.id])) drafts[item.id] = d
  }
}, { immediate: true, deep: true })

function isDirtyDraft(item: ConfigListItem, d?: Draft): boolean {
  if (!d) return false
  if ((d.label ?? '').trim() !== item.label) return true
  for (const f of props.fields) {
    const orig = item[f.key]
    const cur = d[f.key]
    if (f.type === 'number') {
      if (Number(cur ?? 0) !== Number(orig ?? 0)) return true
    } else if ((cur ?? '') !== (orig ?? '')) return true
  }
  return false
}
function isDirty(item: ConfigListItem): boolean {
  return isDirtyDraft(item, drafts[item.id])
}

// ── Mutations ─────────────────────────────────────────────────────────────────
const error = ref('')
const { mutateAsync: addItem } = useAddListItem()
const { mutateAsync: updateItem } = useUpdateListItem()
const { mutateAsync: toggleItem } = useToggleListItem()
const { mutateAsync: deleteItem } = useDeleteListItem()

function extrasFromDraft(d: Draft): ListItemExtras {
  const extras: Record<string, string | number> = {}
  for (const f of props.fields) {
    const v = d[f.key]
    extras[f.key] = f.type === 'number' ? (v === '' || v === undefined ? 0 : Number(v)) : String(v ?? '')
  }
  return extras as ListItemExtras
}

async function save(row: ConfigListItem) {
  error.value = ''
  const d = drafts[row.id]
  try {
    await updateItem({ name: props.name, id: row.id, patch: { label: d.label.trim(), ...extrasFromDraft(d) } })
  } catch (e) { error.value = errMessage(e) }
}

async function toggle(row: ConfigListItem) {
  error.value = ''
  try {
    await toggleItem({ name: props.name, id: row.id, active: row.active === false })
  } catch (e) { error.value = errMessage(e) }
}

// ── Add ───────────────────────────────────────────────────────────────────────
const newItem = reactive<{ label: string; extras: Record<string, string | number | undefined> }>({ label: '', extras: {} })

async function add() {
  if (!newItem.label.trim()) return
  error.value = ''
  const extras: Record<string, string | number> = {}
  for (const f of props.fields) {
    const v = newItem.extras[f.key]
    extras[f.key] = f.type === 'number' ? (v === '' || v === undefined ? 0 : Number(v)) : String(v ?? '')
  }
  try {
    await addItem({ name: props.name, label: newItem.label.trim(), extras: extras as ListItemExtras })
    newItem.label = ''
    newItem.extras = {}
  } catch (e) { error.value = errMessage(e) }
}

// ── Delete ────────────────────────────────────────────────────────────────────
const deleteOpen = ref(false)
const pendingDelete = ref<ConfigListItem | null>(null)
function askDelete(row: ConfigListItem) { pendingDelete.value = row; deleteOpen.value = true }
async function confirmDelete() {
  const row = pendingDelete.value
  deleteOpen.value = false
  if (!row) return
  error.value = ''
  try {
    await deleteItem({ name: props.name, id: row.id })
  } catch (e) { error.value = errMessage(e) }
  pendingDelete.value = null
}

// ── Export ────────────────────────────────────────────────────────────────────
function exportCsv() {
  const cols = [props.labelHeader, ...props.fields.map((f) => f.label), 'Active', 'Usage']
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const lines = [cols.map(esc).join(',')]
  for (const row of items.value) {
    const cells = [
      row.label,
      ...props.fields.map((f) => String(row[f.key] ?? '')),
      row.active === false ? 'No' : 'Yes',
      String(usage.value[row.label] ?? 0),
    ]
    lines.push(cells.map(esc).join(','))
  }
  const blob = new Blob(['﻿', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.name}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function errMessage(e: unknown): string {
  const err = e as { message?: string; count?: number }
  if (err?.count) return `${err.message} (used in ${err.count} document(s)).`
  return err?.message ?? 'Something went wrong.'
}
</script>

<style scoped>
.cfg-editor { display: flex; flex-direction: column; gap: 12px; }
.cfg-editor__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.cfg-editor__head-right { display: flex; align-items: baseline; gap: 12px; }
.cfg-editor__title { font-size: 15px; font-weight: 700; }
.cfg-editor__count { font-size: 12px; color: var(--color-text-subtle); }
.cfg-editor__hint { font-size: 12px; color: var(--color-text-muted); margin: 0; line-height: 1.5; }

.cfg-editor__banner { padding: 8px 12px; border-radius: 6px; font-size: 13px; }
.cfg-editor__banner--error { background: rgba(220, 38, 38, 0.06); border: 1px solid rgba(220, 38, 38, 0.25); color: var(--color-error); }

.cfg-editor__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cfg-editor__table th {
  text-align: left; padding: 6px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: var(--color-text-subtle); border-bottom: 1px solid var(--color-border);
}
.cfg-editor__table td { padding: 6px 8px; border-bottom: 1px solid var(--color-border); vertical-align: middle; }
.cfg-editor__num { text-align: right; width: 70px; }
.cfg-editor__input { width: 100%; padding: 5px 8px; font-size: 13px; }
.cfg-editor__actions-col { width: 1%; }
.cfg-editor__actions { white-space: nowrap; text-align: right; display: flex; gap: 6px; justify-content: flex-end; align-items: center; }
.cfg-editor__del:hover { color: var(--color-error); }
.cfg-editor__used { font-size: 11px; color: var(--color-text-subtle); }

.cfg-editor__badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; }
.cfg-editor__badge.is-on { background: rgba(22, 163, 74, 0.12); color: #15803d; }
.cfg-editor__badge.is-off { background: var(--color-bg-subtle); color: var(--color-text-subtle); }

tr.is-inactive td { opacity: 0.6; }
.cfg-editor__add-row td { border-bottom: none; padding-top: 10px; }

.btn--xs { padding: 3px 8px; font-size: 12px; }
</style>
