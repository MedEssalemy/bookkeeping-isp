<template>
  <div class="base-input">
    <label v-if="label" :for="inputId" class="base-input__label">
      {{ label }}<span v-if="required" class="base-input__required">*</span>
    </label>
    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :required="required"
      :class="['base-input__field', { 'base-input__field--error': !!error }]"
      v-bind="$attrs"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="base-input__error">{{ error }}</span>
    <slot name="hint" />
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  label?: string
  placeholder?: string
  type?: 'text' | 'number' | 'email' | 'password' | 'tel'
  required?: boolean
  disabled?: boolean
  error?: string
}>(), {
  type: 'text',
  required: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputId = useId()
</script>

<style scoped>
.base-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.base-input__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.base-input__required {
  color: var(--color-error);
  margin-left: 2px;
}

.base-input__field {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.base-input__field:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.1);
}

.base-input__field--error {
  border-color: var(--color-error);
}

.base-input__field--error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.base-input__field:disabled {
  background: var(--color-bg-subtle);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.base-input__error {
  font-size: 12px;
  color: var(--color-error);
}
</style>
