<template>
  <span :class="['status-badge', `status-badge--${variant}`]">{{ label }}</span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  variant?: 'gray' | 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'light-gray'
}>(), {
  variant: 'gray',
})
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0.02em;
}

.status-badge--gray {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.status-badge--light-gray {
  background: rgba(148, 163, 184, 0.1);
  color: #94a3b8;
}

.status-badge--blue {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

.status-badge--green {
  background: rgba(5, 150, 105, 0.1);
  color: #059669;
}

.status-badge--red {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.status-badge--amber {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}

.status-badge--purple {
  background: rgba(124, 58, 237, 0.1);
  color: #7c3aed;
}
</style>
