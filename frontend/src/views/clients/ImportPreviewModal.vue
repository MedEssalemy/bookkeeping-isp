<template>
  <Dialog
    :visible="visible"
    header="Review import"
    modal
    :draggable="false"
    :style="{ maxWidth: '780px', width: '94vw' }"
    @update:visible="onClose"
  >
    <div v-if="plan" class="import-preview">
      <!-- Summary tiles -->
      <div class="import-preview__summary">
        <div class="import-preview__tile import-preview__tile--add">
          <div class="import-preview__tile-value">{{ plan.newCount }}</div>
          <div class="import-preview__tile-label">New</div>
        </div>
        <div class="import-preview__tile import-preview__tile--update">
          <div class="import-preview__tile-value">{{ plan.updateCount }}</div>
          <div class="import-preview__tile-label">Updated</div>
        </div>
        <div class="import-preview__tile import-preview__tile--unchanged">
          <div class="import-preview__tile-value">{{ plan.unchangedCount }}</div>
          <div class="import-preview__tile-label">Unchanged</div>
        </div>
      </div>

      <!-- Diagnostics — only when something's worth flagging -->
      <div v-if="parseResult?.ignoredHeaders.length" class="import-preview__notice">
        <strong>Ignored columns:</strong>
        {{ parseResult.ignoredHeaders.join(', ') }} — not in our schema, the
        data is skipped.
      </div>
      <div v-if="parseResult?.missingHeaders.length" class="import-preview__notice">
        <strong>Missing columns:</strong>
        {{ parseResult.missingHeaders.join(', ') }} — these will be empty on
        new rows.
      </div>

      <!-- Empty state -->
      <div
        v-if="plan.newCount === 0 && plan.updateCount === 0"
        class="import-preview__empty"
      >
        Nothing to import — every row in the file matches an existing client
        exactly.
      </div>

      <!-- Item list -->
      <div v-else class="import-preview__list">
        <div
          v-for="(item, i) in plan.items.slice(0, MAX_PREVIEW)"
          :key="i"
          class="import-preview__item"
        >
          <span
            :class="['import-preview__badge', `import-preview__badge--${item.action}`]"
          >{{ item.action === 'create' ? 'NEW' : 'UPDATE' }}</span>
          <div class="import-preview__item-text">
            <div class="import-preview__item-primary">
              {{ item.row.name || '(no name)' }}
              <span v-if="item.row.business_name" class="import-preview__item-biz">
                — {{ item.row.business_name }}
              </span>
            </div>
            <div class="import-preview__item-secondary">
              {{ describeSecondary(item.row) }}
            </div>
          </div>
        </div>
        <div
          v-if="plan.items.length > MAX_PREVIEW"
          class="import-preview__more"
        >
          + {{ plan.items.length - MAX_PREVIEW }} more row{{ plan.items.length - MAX_PREVIEW === 1 ? '' : 's' }}
          (commit to apply all)
        </div>
      </div>
    </div>

    <template #footer>
      <div class="import-preview__actions">
        <button
          type="button"
          class="btn btn--secondary btn--sm"
          :disabled="isCommitting"
          @click="onClose(false)"
        >Cancel</button>
        <button
          type="button"
          class="btn btn--primary btn--sm"
          :disabled="isCommitting || (plan?.newCount === 0 && plan?.updateCount === 0)"
          @click="handleConfirm"
        >
          {{ isCommitting ? 'Importing…' : confirmLabel }}
        </button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import type { ImportPlan, AddContactInput } from '../../api/clients'
import type { ParseResult } from './clientsIO'

const MAX_PREVIEW = 50

const props = defineProps<{
  visible: boolean
  plan: ImportPlan | null
  parseResult: ParseResult | null
  isCommitting?: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
}>()

const confirmLabel = computed(() => {
  if (!props.plan) return 'Import'
  const total = props.plan.newCount + props.plan.updateCount
  if (total === 0) return 'Nothing to import'
  return `Import ${total} change${total === 1 ? '' : 's'}`
})

function describeSecondary(r: AddContactInput): string {
  const parts: string[] = []
  if (r.facility) parts.push(r.facility)
  if (r.department) parts.push(r.department)
  const addr = [r.address, r.city, r.state].filter(Boolean).join(', ')
  if (addr) parts.push(addr)
  return parts.join(' · ')
}

function onClose(open: boolean) {
  if (props.isCommitting) return
  emit('update:visible', open)
}

function handleConfirm() {
  emit('confirm')
}
</script>

<style scoped>
.import-preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: var(--font-sans);
}

.import-preview__summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.import-preview__tile {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  background: var(--color-bg);
}

.import-preview__tile-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.import-preview__tile-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
  margin-top: 4px;
}

.import-preview__tile--add .import-preview__tile-value { color: #15803d; }
.import-preview__tile--update .import-preview__tile-value { color: #b45309; }
.import-preview__tile--unchanged .import-preview__tile-value { color: var(--color-text-muted); }

.import-preview__notice {
  font-size: 12px;
  color: var(--color-text-muted);
  background: rgba(180, 83, 9, 0.06);
  border: 1px solid rgba(180, 83, 9, 0.18);
  padding: 8px 10px;
  border-radius: 6px;
}

.import-preview__empty {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 16px;
  background: var(--color-bg-subtle);
  border-radius: 6px;
}

.import-preview__list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.import-preview__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}
.import-preview__item:last-child { border-bottom: none; }

.import-preview__badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 2px;
  font-family: var(--font-sans);
}

.import-preview__badge--create {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}
.import-preview__badge--update {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.import-preview__item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.import-preview__item-primary {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.import-preview__item-biz {
  color: var(--color-text-muted);
  font-weight: 400;
}

.import-preview__item-secondary {
  font-size: 11.5px;
  color: var(--color-text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.import-preview__more {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
  font-style: italic;
}

.import-preview__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
