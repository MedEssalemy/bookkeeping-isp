<template>
  <div class="base-textarea">
    <label v-if="label" :for="textareaId" class="base-textarea__label">
      {{ label }}<span v-if="required" class="base-textarea__required">*</span>
    </label>
    <textarea
      :id="textareaId"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :rows="rows"
      :class="['base-textarea__field', { 'base-textarea__field--error': !!error }]"
      v-bind="$attrs"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <span v-if="error" class="base-textarea__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{
  modelValue?: string | null
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  rows?: number
  error?: string
}>(), {
  required: false,
  disabled: false,
  rows: 3,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaId = useId()
</script>

<style scoped>
.base-textarea {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.base-textarea__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.base-textarea__required {
  color: var(--color-error);
  margin-left: 2px;
}

.base-textarea__field {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  resize: vertical;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.base-textarea__field:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.1);
}

.base-textarea__field--error {
  border-color: var(--color-error);
}

.base-textarea__field--error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.base-textarea__field:disabled {
  background: var(--color-bg-subtle);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.base-textarea__error {
  font-size: 12px;
  color: var(--color-error);
}
</style>
