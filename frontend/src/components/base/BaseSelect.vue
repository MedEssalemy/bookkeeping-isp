<template>
  <div class="base-select">
    <label v-if="label" :for="selectId" class="base-select__label">
      {{ label }}<span v-if="required" class="base-select__required">*</span>
    </label>
    <Select
      :inputId="selectId"
      :modelValue="modelValue"
      :options="options"
      :optionLabel="optionLabel"
      :optionValue="optionValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :filter="searchable"
      :class="['base-select__control', { 'base-select__control--error': !!error }]"
      @update:modelValue="emit('update:modelValue', $event)"
    />
    <span v-if="error" class="base-select__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import Select from 'primevue/select'

withDefaults(defineProps<{
  modelValue?: unknown
  label?: string
  placeholder?: string
  options?: unknown[]
  optionLabel?: string
  optionValue?: string
  required?: boolean
  disabled?: boolean
  searchable?: boolean
  error?: string
}>(), {
  options: () => [],
  optionLabel: 'label',
  optionValue: 'value',
  required: false,
  disabled: false,
  searchable: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
}>()

const selectId = useId()
</script>

<style scoped>
.base-select {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.base-select__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.base-select__required {
  color: var(--color-error);
  margin-left: 2px;
}

.base-select__control {
  width: 100%;
}

.base-select__error {
  font-size: 12px;
  color: var(--color-error);
}
</style>
