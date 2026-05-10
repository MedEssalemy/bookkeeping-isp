<template>
  <Dialog
    :visible="visible"
    header="Document Preview"
    modal
    :draggable="false"
    :style="{ width: '700px', maxWidth: '95vw' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="doc-preview">
      <div class="doc-preview__placeholder">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>Preview will be available once the backend is implemented.</p>
      </div>
    </div>
    <template #footer>
      <button class="btn btn--secondary btn--sm" @click="emit('update:visible', false)">Close</button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()
</script>

<style scoped>
.doc-preview {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.doc-preview__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--color-text-muted);
  text-align: center;
}

.doc-preview__placeholder svg {
  color: var(--color-text-subtle);
}

.doc-preview__placeholder p {
  font-size: 14px;
  margin: 0;
}
</style>
