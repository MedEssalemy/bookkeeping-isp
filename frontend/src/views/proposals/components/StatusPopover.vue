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
          v-for="s in STATUS_OPTIONS"
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

<script setup lang="ts">
import { ref } from 'vue'
import Popover from 'primevue/popover'
import StatusBadge from '../../../components/base/StatusBadge.vue'
import type { ProposalStatus } from '../../../types/proposal'

const props = defineProps<{
  status: ProposalStatus
  loading?: boolean
}>()

const emit = defineEmits<{
  change: [status: ProposalStatus]
}>()

const STATUS_OPTIONS: ProposalStatus[] = ['Draft', 'Sent', 'Accepted', 'Declined']

const popoverRef = ref<InstanceType<typeof Popover> | null>(null)
const currentStatus = ref<ProposalStatus>(props.status)

function toggle(e: MouseEvent) {
  popoverRef.value?.toggle(e)
}

function select(s: ProposalStatus) {
  currentStatus.value = s
  popoverRef.value?.hide()
  emit('change', s)
}

function statusVariant(s: ProposalStatus): 'gray' | 'blue' | 'green' | 'red' {
  const map: Record<ProposalStatus, 'gray' | 'blue' | 'green' | 'red'> = {
    Draft: 'gray',
    Sent: 'blue',
    Accepted: 'green',
    Declined: 'red',
  }
  return map[s]
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
