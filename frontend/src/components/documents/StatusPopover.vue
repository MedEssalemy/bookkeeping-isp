<template>
  <div class="status-popover">
    <button
      ref="triggerRef"
      class="status-popover__trigger"
      @click="toggle"
    >
      <StatusBadge :label="currentStatus" :variant="statusVariant(currentStatus)" />
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <Popover ref="popoverRef" :dismissable="true">
      <div class="status-popover__menu">
        <div
          v-for="s in statusOptions"
          :key="s"
          :class="['status-popover__option', { 'is-active': s === currentStatus }]"
          @click="select(s)"
        >
          <StatusBadge :label="s" :variant="statusVariant(s)" />
          <svg v-if="s === currentStatus" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>
    </Popover>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
import { ref, computed, type Ref } from 'vue'
import Popover from 'primevue/popover'
import StatusBadge from '../base/StatusBadge.vue'
import { PROPOSAL_STATUSES, type ProposalStatus } from '../../types/proposal'
import type { DocDirection } from '../../types/common'

type BadgeVariant = 'gray' | 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'light-gray'

// Generic status popover shared by every document type. Proposals rely on the
// direction-based defaults below; POs/Invoices pass explicit `options` +
// `variantMap` (their statuses are their own code-owned enums).
const props = withDefaults(defineProps<{
  status: T
  options?: T[]
  variantMap?: Record<string, BadgeVariant>
  direction?: DocDirection
  loading?: boolean
}>(), {
  direction: 'issued',
})

const emit = defineEmits<{
  change: [status: T]
}>()

// Proposal fallback (used only when `options`/`variantMap` aren't provided).
const PROPOSAL_VARIANTS: Record<ProposalStatus, BadgeVariant> = {
  Draft: 'gray',
  Sent: 'blue',
  Received: 'blue',
  Accepted: 'green',
  Declined: 'red',
}

const statusOptions = computed<T[]>(
  () => props.options ?? (PROPOSAL_STATUSES[props.direction] as unknown as T[]),
)

const popoverRef = ref<InstanceType<typeof Popover> | null>(null)
const currentStatus = ref(props.status) as Ref<T>

function toggle(e: MouseEvent) {
  popoverRef.value?.toggle(e)
}

function select(s: T) {
  currentStatus.value = s
  popoverRef.value?.hide()
  emit('change', s)
}

function statusVariant(s: T): BadgeVariant {
  if (props.variantMap && props.variantMap[s]) return props.variantMap[s]
  return PROPOSAL_VARIANTS[s as unknown as ProposalStatus] ?? 'gray'
}
</script>

<style scoped>
.status-popover {
  display: inline-flex;
  align-items: center;
}

.status-popover__trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  color: var(--color-text-muted);
  transition: background 0.1s;
}

.status-popover__trigger:hover {
  background: var(--color-bg-subtle);
}

.status-popover__menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 140px;
  padding: 4px;
}

.status-popover__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}

.status-popover__option:hover {
  background: var(--color-bg-subtle);
}

.status-popover__option.is-active {
  background: var(--color-bg-subtle);
}
</style>
