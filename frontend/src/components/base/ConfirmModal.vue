<template>
  <Dialog
    :visible="visible"
    :header="title"
    modal
    :draggable="false"
    :style="{ maxWidth: 'var(--modal-max-width)', width: '90vw' }"
    @update:visible="onClose"
  >
    <p class="confirm-modal__message">{{ message }}</p>

    <template #footer>
      <div class="confirm-modal__actions">
        <button v-if="cancelLabel" class="btn btn--secondary btn--sm" @click="emit('cancel')">
          {{ cancelLabel }}
        </button>
        <button :class="['btn', `btn--${variantClass}`, 'btn--sm']" @click="emit('confirm')">
          {{ confirmLabel }}
        </button>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'

const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
}>(), {
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'info',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  'update:visible': [value: boolean]
}>()

const variantClass = computed(() => {
  if (props.variant === 'danger') return 'danger'
  if (props.variant === 'warning') return 'secondary'
  return 'primary'
})

function onClose(val: boolean) {
  if (!val) emit('cancel')
  emit('update:visible', val)
}
</script>

<style scoped>
.confirm-modal__message {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
}

.confirm-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
</style>
