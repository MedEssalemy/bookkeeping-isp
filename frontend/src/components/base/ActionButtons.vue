<template>
  <div v-if="!isViewer" class="action-buttons">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const isViewer = computed(() => auth.role === 'viewer')
</script>

<style scoped>
.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
