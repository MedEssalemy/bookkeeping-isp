<template>
  <div class="rich-editor">
    <label v-if="label" class="rich-editor__label">
      {{ label }}<span v-if="required" class="rich-editor__required">*</span>
    </label>
    <div :class="['rich-editor__wrapper', { 'rich-editor__wrapper--error': !!error }]">
      <!-- Toolbar — Tier 1 only: bold, italic, underline, break, bullet list -->
      <div class="rich-editor__toolbar">
        <button
          type="button"
          :class="['rich-editor__tool', { 'is-active': editor?.isActive('bold') }]"
          title="Bold"
          @click="editor?.chain().focus().toggleBold().run()"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          :class="['rich-editor__tool', { 'is-active': editor?.isActive('italic') }]"
          title="Italic"
          @click="editor?.chain().focus().toggleItalic().run()"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          :class="['rich-editor__tool', { 'is-active': editor?.isActive('underline') }]"
          title="Underline"
          @click="editor?.chain().focus().toggleUnderline().run()"
        >
          <span style="text-decoration: underline">U</span>
        </button>
        <div class="rich-editor__separator" />
        <button
          type="button"
          title="Line break"
          class="rich-editor__tool"
          @click="editor?.chain().focus().setHardBreak().run()"
        >
          ↵
        </button>
        <button
          type="button"
          :class="['rich-editor__tool', { 'is-active': editor?.isActive('bulletList') }]"
          title="Bullet list"
          @click="editor?.chain().focus().toggleBulletList().run()"
        >
          ≡
        </button>
      </div>
      <EditorContent class="rich-editor__content" :editor="editor" />
    </div>
    <span v-if="error" class="rich-editor__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  label?: string
  required?: boolean
  disabled?: boolean
  error?: string
}>(), {
  modelValue: '',
  required: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editor = useEditor({
  content: props.modelValue ?? '',
  extensions: [
    StarterKit.configure({
      // Tier 1: allow only bold, italic, hardBreak, bulletList, listItem, paragraph, text
      // All other marks and nodes are disabled to enforce Tier 1 constraint
      blockquote: false,
      code: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      orderedList: false,
      strike: false,
    }),
    Underline,
  ],
  editable: !props.disabled,
  onUpdate({ editor }) {
    emit('update:modelValue', editor.getHTML())
  },
})

watch(() => props.modelValue, (val) => {
  if (editor.value && val !== editor.value.getHTML()) {
    editor.value.commands.setContent(val ?? '')
  }
})

watch(() => props.disabled, (val) => {
  editor.value?.setEditable(!val)
})

onBeforeUnmount(() => editor.value?.destroy())
</script>

<style scoped>
.rich-editor {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rich-editor__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.rich-editor__required {
  color: var(--color-error);
  margin-left: 2px;
}

.rich-editor__wrapper {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-bg);
}

.rich-editor__wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.1);
}

.rich-editor__wrapper--error {
  border-color: var(--color-error);
}

.rich-editor__toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-subtle);
}

.rich-editor__tool {
  padding: 3px 7px;
  border: none;
  background: none;
  border-radius: 4px;
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: background 0.1s, color 0.1s;
  line-height: 1.4;
}

.rich-editor__tool:hover {
  background: var(--color-border);
  color: var(--color-text);
}

.rich-editor__tool.is-active {
  background: var(--color-primary);
  color: #fff;
}

.rich-editor__separator {
  width: 1px;
  height: 18px;
  background: var(--color-border);
  margin: 0 4px;
}

.rich-editor__error {
  font-size: 12px;
  color: var(--color-error);
}
</style>

<style>
.rich-editor__content .ProseMirror {
  min-height: 100px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: var(--font-sans);
  color: var(--color-text);
  outline: none;
}

.rich-editor__content .ProseMirror p {
  margin: 0 0 6px;
}

.rich-editor__content .ProseMirror ul {
  list-style-type: disc;
  padding-left: 20px;
  margin: 0 0 6px;
}

.rich-editor__content .ProseMirror li {
  color: var(--color-text);
}
</style>
