<template>
  <div class="data-table">
    <DataTablePrime
      :value="loading ? skeletonRows : value"
      :rowHover="!loading"
      v-bind="$attrs"
    >
      <template v-if="loading" v-for="col in skeletonCols" :key="col" #[`body_${col}`]>
        <div class="skeleton skeleton--text" />
      </template>

      <slot />

      <template #empty>
        <slot name="empty">
          <div class="data-table__empty">
            <span>No records found.</span>
          </div>
        </slot>
      </template>
    </DataTablePrime>

    <!-- Pagination -->
    <div v-if="total > 0" class="data-table__pagination">
      <span class="data-table__pagination-info">
        Showing {{ pageStart }}–{{ pageEnd }} of {{ total }}
      </span>
      <div class="data-table__pagination-controls">
        <button
          class="btn btn--secondary btn--sm"
          :disabled="page <= 1"
          @click="emit('pageChange', page - 1)"
        >Prev</button>
        <span class="data-table__page-num">{{ page }} / {{ totalPages }}</span>
        <button
          class="btn btn--secondary btn--sm"
          :disabled="page >= totalPages"
          @click="emit('pageChange', page + 1)"
        >Next</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DataTablePrime from 'primevue/datatable'

const props = withDefaults(defineProps<{
  value?: unknown[]
  loading?: boolean
  page?: number
  pageSize?: number
  total?: number
}>(), {
  value: () => [],
  loading: false,
  page: 1,
  pageSize: 20,
  total: 0,
})

const emit = defineEmits<{
  pageChange: [page: number]
}>()

const skeletonRows = computed(() => Array.from({ length: props.pageSize }, (_, i) => ({ _sk: i })))
const skeletonCols = computed(() => ['0', '1', '2', '3', '4'])

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const pageStart = computed(() => (props.page - 1) * props.pageSize + 1)
const pageEnd = computed(() => Math.min(props.page * props.pageSize, props.total))
</script>

<style scoped>
.data-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.data-table__empty {
  padding: 32px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 14px;
}

.data-table__pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
}

.data-table__pagination-info {
  font-size: 13px;
  color: var(--color-text-muted);
}

.data-table__pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.data-table__page-num {
  font-size: 13px;
  color: var(--color-text-muted);
  min-width: 50px;
  text-align: center;
}
</style>
