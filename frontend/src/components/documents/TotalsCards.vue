<template>
  <div class="totals-cards">
    <template v-if="variant === 'Standard'">
      <div class="totals-card">
        <div class="totals-card__label">Subtotal</div>
        <div class="totals-card__value">{{ fmt(subtotal) }}</div>
      </div>
      <div class="totals-card">
        <div class="totals-card__label">Sales Tax</div>
        <div class="totals-card__value">{{ fmt(salesTax) }}</div>
        <div class="totals-card__meta">{{ (taxRate * 100).toFixed(4) }}%</div>
      </div>
    </template>
    <div class="totals-card totals-card--total">
      <div class="totals-card__label">Total</div>
      <div class="totals-card__value totals-card__value--total">{{ fmt(total) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant: 'Standard' | 'MP'
  subtotal?: number
  salesTax?: number
  taxRate?: number
  total: number
}>(), {
  subtotal: 0,
  salesTax: 0,
  taxRate: 0,
})

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
</script>

<style scoped>
.totals-cards {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.totals-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px 20px;
  min-width: 130px;
  text-align: right;
}

.totals-card--total {
  border-color: var(--color-primary);
  background: rgba(29, 78, 216, 0.04);
}

.totals-card__label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
  margin-bottom: 4px;
}

.totals-card__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.totals-card__value--total {
  color: var(--color-primary);
  font-size: 20px;
}

.totals-card__meta {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
</style>
