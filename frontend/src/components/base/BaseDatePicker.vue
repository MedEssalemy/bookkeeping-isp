<template>
  <div class="base-datepicker">
    <label v-if="label" :for="pickerId" class="base-datepicker__label">
      {{ label }}<span v-if="required" class="base-datepicker__required">*</span>
    </label>
    <DatePicker
      :inputId="pickerId"
      :modelValue="dateValue"
      :disabled="disabled"
      :placeholder="placeholder || 'MM/DD/YYYY'"
      showIcon
      showOnFocus
      dateFormat="mm/dd/yy"
      :class="['base-datepicker__control', { 'base-datepicker__control--error': !!error }]"
      @update:modelValue="onDateChange"
    />
    <span v-if="error" class="base-datepicker__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import DatePicker from 'primevue/datepicker'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  error?: string
}>(), {
  required: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const pickerId = useId()

const dateValue = computed<Date | null>(() => {
  if (!props.modelValue) return null
  const d = new Date(props.modelValue)
  return isNaN(d.getTime()) ? null : d
})

function onDateChange(val: Date | Date[] | (Date | null)[] | null | undefined) {
  if (!val || Array.isArray(val)) {
    emit('update:modelValue', null)
    return
  }
  emit('update:modelValue', (val as Date).toISOString().slice(0, 10))
}
</script>

<style scoped>
.base-datepicker {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.base-datepicker__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.base-datepicker__required {
  color: var(--color-error);
  margin-left: 2px;
}

.base-datepicker__control {
  width: 100%;
}

.base-datepicker__error {
  font-size: 12px;
  color: var(--color-error);
}
</style>
