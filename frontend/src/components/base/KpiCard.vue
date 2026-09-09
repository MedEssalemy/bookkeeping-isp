<template>
  <div class="kpi-card">
    <div class="kpi-card__label">{{ label }}</div>
    <div class="kpi-card__value">{{ value }}</div>
    <div v-if="trend" class="kpi-card__trend">{{ trend }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  trend?: string
}>()
</script>

<style scoped>
.kpi-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 20px;
  flex: 1 1 160px;
  min-width: 140px;
  max-width: 280px;
}

.kpi-card__label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #94a3b8;
  margin-bottom: 6px;
}

.kpi-card__value {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.kpi-card__trend {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 3px;
}
</style>
