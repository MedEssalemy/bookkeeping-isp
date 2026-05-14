<template>
  <div class="combo-select">
    <label v-if="label" :for="selectId" class="combo-select__label">
      {{ label }}<span v-if="required" class="combo-select__required">*</span>
    </label>

    <Select
      :inputId="selectId"
      :modelValue="modelValue"
      :options="options"
      :optionLabel="optionLabel"
      :optionValue="optionValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :editable="editable"
      :filter="searchable"
      :filterPlaceholder="filterPlaceholder"
      :showClear="showClear"
      :class="['combo-select__control', { 'combo-select__control--error': !!error }]"
      @update:modelValue="emit('update:modelValue', $event)"
    >
      <!-- Forward the per-option slot so callers can render rich rows
           (e.g. two-line: facility / address). -->
      <template v-if="$slots.option" #option="slotProps">
        <slot name="option" v-bind="slotProps" />
      </template>

      <!-- Forward the selected-value display slot so the trigger can render
           the same rich shape (or a compact summary) as the dropdown items. -->
      <template v-if="$slots.value" #value="slotProps">
        <slot name="value" v-bind="slotProps" />
      </template>

      <!-- Footer with "Add new" action — only rendered if addNewLabel is set. -->
      <template v-if="addNewLabel" #footer>
        <div class="combo-select__footer">
          <button
            type="button"
            class="combo-select__add-btn"
            @mousedown.prevent="handleAddNew"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{{ addNewLabel }}</span>
          </button>
        </div>
      </template>
    </Select>

    <span v-if="error" class="combo-select__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useRouter } from 'vue-router'
import Select from 'primevue/select'

const props = withDefaults(defineProps<{
  modelValue?: unknown
  label?: string
  placeholder?: string
  options?: unknown[]
  optionLabel?: string
  optionValue?: string
  required?: boolean
  disabled?: boolean
  searchable?: boolean
  filterPlaceholder?: string
  showClear?: boolean
  /**
   * When true, users can type a value not in the options list. The typed value
   * becomes the model value as-is. Use this when the list is a set of
   * suggestions, not an enum.
   */
  editable?: boolean
  error?: string
  /**
   * If provided, a footer button is rendered with this label. Clicking it
   * routes the user to `addNewTo` (or emits `add-new` if no route is given).
   */
  addNewLabel?: string
  /**
   * A vue-router location (string or RouteLocationRaw-ish object) to navigate
   * to when the user clicks "Add new". Kept loosely typed so callers can pass
   * either a path string or a { name, query } object.
   */
  addNewTo?: string | Record<string, unknown>
}>(), {
  options: () => [],
  optionLabel: 'label',
  optionValue: 'value',
  required: false,
  disabled: false,
  searchable: false,
  editable: false,
  showClear: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  'add-new': []
}>()

const router = useRouter()
const selectId = useId()

function handleAddNew() {
  emit('add-new')
  if (props.addNewTo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(props.addNewTo as any)
  }
}
</script>

<style scoped>
.combo-select {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.combo-select__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.combo-select__required {
  color: var(--color-error);
  margin-left: 2px;
}

.combo-select__control {
  width: 100%;
}

.combo-select__control :deep(.p-select-input) {
  font-family: var(--font-sans);
}

.combo-select__error {
  font-size: 12px;
  color: var(--color-error);
}

/* ── Footer action ───────────────────────────────────────────────────────── */
.combo-select__footer {
  padding: 4px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg);
}

.combo-select__add-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  font-family: var(--font-sans);
  transition: background 0.1s;
}

.combo-select__add-btn:hover {
  background: rgba(29, 78, 216, 0.08);
}

.combo-select__add-btn svg {
  flex-shrink: 0;
}
</style>
