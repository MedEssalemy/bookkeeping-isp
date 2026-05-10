<template>
  <div class="line-items">
    <table class="table line-items__table">
      <thead>
        <tr v-if="variant === 'Standard'">
          <th class="line-items__col-jc">Job Code</th>
          <th class="line-items__col-desc">Description</th>
          <th class="line-items__col-qty td--number">Est. Qty / Hours</th>
          <th class="line-items__col-price td--number">Rate</th>
          <th class="td--number">Amount</th>
          <th v-if="!readonly" class="line-items__col-del"></th>
        </tr>
        <tr v-else>
          <th class="line-items__col-desc">Services</th>
          <th class="line-items__col-price td--number">Hourly Rate</th>
          <th class="line-items__col-qty td--number">Hours Estimated</th>
          <th class="td--number">Estimated Fee</th>
          <th v-if="!readonly" class="line-items__col-del"></th>
        </tr>
      </thead>
      <tbody>
        <template v-if="variant === 'Standard'">
          <tr v-for="(item, idx) in (items as StandardLineItem[])" :key="item.id">
            <!-- Job Code -->
            <td>
              <Select
                v-if="!readonly"
                v-model="item.job_code"
                :options="JOB_CODES"
                placeholder="—"
                showClear
                class="line-items__jc-select"
              />
              <span v-else>{{ item.job_code || '—' }}</span>
            </td>
            <!-- Description -->
            <td>
              <input
                v-if="!readonly"
                v-model="item.description"
                class="field__input line-items__inline-input"
                type="text"
                placeholder="Description"
                @keydown.enter.prevent="onEnter(idx)"
              />
              <span v-else>{{ item.description || '—' }}</span>
            </td>
            <!-- Qty (nullable) -->
            <td class="td--number">
              <input
                v-if="!readonly"
                :value="item.qty ?? ''"
                class="field__input line-items__num-input"
                type="number"
                min="0"
                step="any"
                placeholder="—"
                @input="onQtyInput(item, $event)"
              />
              <span v-else>{{ item.qty ?? '—' }}</span>
            </td>
            <!-- Rate -->
            <td class="td--number">
              <input
                v-if="!readonly"
                v-model.number="item.rate"
                class="field__input line-items__num-input"
                type="number"
                step="0.01"
              />
              <span v-else>{{ fmt(item.rate) }}</span>
            </td>
            <!-- Amount (computed) -->
            <td class="td--number line-items__computed">{{ fmt(item.amount) }}</td>
            <!-- Delete -->
            <td v-if="!readonly">
              <button
                class="line-items__del"
                @click="emit('remove', item.id)"
                title="Remove row"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </td>
          </tr>
        </template>
        <template v-else>
          <tr v-for="(item, idx) in (items as MPLineItem[])" :key="item.id">
            <!-- Services -->
            <td>
              <input
                v-if="!readonly"
                v-model="item.services"
                class="field__input line-items__inline-input"
                type="text"
                placeholder="Services"
                @keydown.enter.prevent="onEnter(idx)"
              />
              <span v-else>{{ item.services || '—' }}</span>
            </td>
            <!-- Hourly Rate (nullable) -->
            <td class="td--number">
              <input
                v-if="!readonly"
                :value="item.hourly_rate ?? ''"
                class="field__input line-items__num-input"
                type="number"
                step="0.01"
                placeholder="—"
                @input="onHourlyRateInput(item, $event)"
              />
              <span v-else>{{ item.hourly_rate !== null ? fmt(item.hourly_rate) : '—' }}</span>
            </td>
            <!-- Hours Estimated -->
            <td class="td--number">
              <input
                v-if="!readonly"
                v-model.number="item.hours_estimated"
                class="field__input line-items__num-input"
                type="number"
                step="any"
              />
              <span v-else>{{ item.hours_estimated }}</span>
            </td>
            <!-- Estimated Fee (computed) -->
            <td class="td--number line-items__computed">{{ fmt(item.estimated_fee) }}</td>
            <!-- Delete -->
            <td v-if="!readonly">
              <button
                class="line-items__del"
                @click="emit('remove', item.id)"
                title="Remove row"
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <button
      v-if="!readonly"
      class="btn btn--ghost btn--sm line-items__add"
      type="button"
      @click="emit('add')"
    >
      + Add Row
    </button>
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import { JOB_CODES } from '../../../mocks/jobCodes'
import type { StandardLineItem, MPLineItem } from '../../../types/proposal'

const props = withDefaults(defineProps<{
  items: (StandardLineItem | MPLineItem)[]
  variant: 'Standard' | 'MP'
  readonly?: boolean
}>(), {
  readonly: false,
})

const emit = defineEmits<{
  add: []
  remove: [id: string]
}>()

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function onEnter(idx: number) {
  if (idx === props.items.length - 1) emit('add')
}

function onQtyInput(item: StandardLineItem, e: Event) {
  const v = (e.target as HTMLInputElement).value
  item.qty = v === '' ? null : Number(v)
}

function onHourlyRateInput(item: MPLineItem, e: Event) {
  const v = (e.target as HTMLInputElement).value
  item.hourly_rate = v === '' ? null : Number(v)
}
</script>

<style scoped>
.line-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-x: auto;
}

.line-items__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 700px;
}

.line-items__table thead th {
  padding: 8px 10px;
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

.line-items__table thead th.td--number {
  text-align: right;
}

.line-items__table tbody td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
}

.line-items__table tbody tr:last-child td {
  border-bottom: none;
}

.line-items__col-jc    { width: 18%; }
.line-items__col-desc  { width: 36%; }
.line-items__col-qty   { width: 110px; }
.line-items__col-price { width: 110px; }
.line-items__col-del   { width: 36px; }

.line-items__inline-input {
  width: 100%;
  padding: 5px 8px;
  font-size: 13px;
}

.line-items__num-input {
  width: 100px;
  padding: 5px 8px;
  font-size: 13px;
  text-align: right;
}

.line-items__jc-select {
  width: 100%;
  font-size: 13px;
}

.line-items__computed {
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.line-items__del {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: background 0.1s, color 0.1s;
}

.line-items__del:hover {
  background: rgba(220, 38, 38, 0.08);
  color: var(--color-error);
}

.line-items__add {
  align-self: flex-start;
}
</style>
