<template>
  <div class="empty-state">
    <div v-if="$slots.icon" class="empty-state__icon">
      <slot name="icon" />
    </div>
    <div v-else class="empty-state__icon empty-state__icon--default">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    </div>
    <h3 class="empty-state__heading">{{ heading }}</h3>
    <p v-if="subtext" class="empty-state__subtext">{{ subtext }}</p>
    <div v-if="$slots.cta" class="empty-state__cta">
      <slot name="cta" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  heading: string
  subtext?: string
}>(), {})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  gap: 12px;
}

.empty-state__icon {
  color: var(--color-text-subtle);
  line-height: 0;
}

.empty-state__heading {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.empty-state__subtext {
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 0;
  max-width: 340px;
  line-height: 1.5;
}

.empty-state__cta {
  margin-top: 4px;
}
</style>
