<template>
  <div class="suggest-input">
    <label v-if="label" :for="inputId" class="suggest-input__label">
      {{ label }}<span v-if="required" class="suggest-input__required">*</span>
    </label>

    <AutoComplete
      :inputId="inputId"
      :modelValue="modelValue"
      :suggestions="filtered"
      :placeholder="placeholder"
      :disabled="disabled"
      :type="type"
      :forceSelection="false"
      :completeOnFocus="true"
      :class="['suggest-input__control', { 'suggest-input__control--error': !!error }]"
      @complete="onComplete"
      @update:modelValue="onUpdate"
    >
      <template #empty>
        <div class="suggest-input__empty">No matches — your value will be used as-is.</div>
      </template>
    </AutoComplete>

    <span v-if="error" class="suggest-input__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * Combobox-style text input: shows a typeahead dropdown of existing values
 * from the column, but the user can also type any new value (free-text
 * override). Used on the Client Add/Edit form so users can pick from values
 * already entered for other clients without being locked into them.
 */
import { ref, useId } from 'vue'
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  label?: string
  placeholder?: string
  type?: 'text' | 'email' | 'tel'
  options?: string[]
  required?: boolean
  disabled?: boolean
  error?: string
}>(), {
  type: 'text',
  options: () => [],
  required: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputId = useId()
const filtered = ref<string[]>([])

function onComplete(event: AutoCompleteCompleteEvent) {
  const q = (event.query ?? '').trim().toLowerCase()
  const opts = props.options ?? []
  if (!q) {
    filtered.value = opts.slice(0, 50)
    return
  }
  filtered.value = opts
    .filter((o) => o && o.toLowerCase().includes(q))
    .slice(0, 50)
}

function onUpdate(v: unknown) {
  emit('update:modelValue', v == null ? '' : String(v))
}
</script>

<style scoped>
.suggest-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.suggest-input__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.suggest-input__required {
  color: var(--color-error);
  margin-left: 2px;
}

.suggest-input__control {
  width: 100%;
}

.suggest-input__control :deep(.p-autocomplete-input) {
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

.suggest-input__control :deep(.p-autocomplete-input:focus) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.1);
}

.suggest-input__control--error :deep(.p-autocomplete-input) {
  border-color: var(--color-error);
}

.suggest-input__control--error :deep(.p-autocomplete-input:focus) {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
}

.suggest-input__empty {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.suggest-input__error {
  font-size: 12px;
  color: var(--color-error);
}
</style>
