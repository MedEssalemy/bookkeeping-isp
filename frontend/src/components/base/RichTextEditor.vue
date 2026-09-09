<template>
  <div class="rich-editor">
    <label v-if="label" class="rich-editor__label">
      {{ label }}<span v-if="required" class="rich-editor__required">*</span>
    </label>
    <div :class="['rich-editor__wrapper', { 'rich-editor__wrapper--error': !!error }]">
      <!-- Toolbar -->
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

        <!-- List split-button: main button toggles the current list style;
             chevron opens a dropdown to pick a different marker. -->
        <div ref="listGroupRef" class="rich-editor__list-group">
          <button
            type="button"
            :class="['rich-editor__tool', 'rich-editor__list-main', { 'is-active': isAnyListActive }]"
            :title="`Toggle list (${currentMarkerLabel})`"
            @click="onToggleList"
          >
            <span class="rich-editor__list-glyph">{{ currentMarkerGlyph }}</span>
          </button>
          <button
            type="button"
            class="rich-editor__tool rich-editor__list-caret"
            title="Choose list style"
            :aria-expanded="listMenuOpen"
            @click="listMenuOpen = !listMenuOpen"
          >▾</button>

          <Transition name="rich-editor-menu">
            <div v-if="listMenuOpen" class="rich-editor__menu">
              <button
                v-for="opt in MARKER_OPTIONS"
                :key="opt.id"
                type="button"
                :class="['rich-editor__menu-item', { 'is-active': currentMarkerId === opt.id }]"
                @click="applyMarker(opt)"
              >
                <span class="rich-editor__menu-glyph">{{ opt.glyph }}</span>
                <span>{{ opt.label }}</span>
                <span v-if="currentMarkerId === opt.id" class="rich-editor__menu-check">✓</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>
      <EditorContent class="rich-editor__content" :editor="editor" />
    </div>
    <span v-if="error" class="rich-editor__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, onMounted, onUnmounted } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'

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

// ── Marker options ───────────────────────────────────────────────────────────
// Each option pairs a TipTap list type with a value we stamp onto the list
// node via `data-marker`. The same value drives the CSS `list-style-type` for
// web rendering. The default — disc — matches Word's default bullet, so even
// if the doc-generation backend ignores `data-marker` entirely, lists still
// look right in the generated .docx.
type MarkerKind = 'bullet' | 'ordered'
interface MarkerOption {
  id: string
  kind: MarkerKind
  marker: string   // value written to data-marker AND used as list-style-type
  glyph: string    // shown in the toolbar / menu
  label: string
}

const MARKER_OPTIONS: MarkerOption[] = [
  { id: 'square',  kind: 'bullet',  marker: 'square',  glyph: '▪', label: 'Square' },
  { id: 'disc',    kind: 'bullet',  marker: 'disc',    glyph: '●', label: 'Disc' },
  { id: 'circle',  kind: 'bullet',  marker: 'circle',  glyph: '○', label: 'Circle' },
  { id: 'decimal', kind: 'ordered', marker: 'decimal', glyph: '1.', label: 'Numbered' },
]
const DEFAULT_OPTION = MARKER_OPTIONS[0]

// Tracks the user's *most recently chosen* marker so toggling the list on/off
// preserves their pick. Editor state holds the source-of-truth marker for the
// list node the caret is in; this is just the "what would we apply next" hint.
const lastMarkerId = ref<string>(DEFAULT_OPTION.id)

// ── TipTap setup ─────────────────────────────────────────────────────────────
// We add data-marker as a node attribute on bullet/ordered lists. TipTap reads
// it back when parsing existing content, and re-emits it on save — so the
// serialized HTML always carries the marker info for the backend.
const editor = useEditor({
  content: props.modelValue ?? '',
  extensions: [
    StarterKit.configure({
      blockquote: false,
      code: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      strike: false,
      // We register BulletList / OrderedList separately (below) with extra attrs.
      bulletList: false,
      orderedList: false,
    }),
    BulletList.extend({
      addAttributes() {
        return {
          marker: {
            // Square is the design default. Existing content without the
            // attribute keeps its prior look (disc) via the parseHTML fallback,
            // so we don't surprise users by changing already-saved lists.
            default: 'square',
            parseHTML: (el) => el.getAttribute('data-marker') ?? 'disc',
            renderHTML: (attrs) => ({ 'data-marker': attrs.marker }),
          },
        }
      },
    }),
    OrderedList.extend({
      addAttributes() {
        return {
          marker: {
            default: 'decimal',
            parseHTML: (el) => el.getAttribute('data-marker') ?? 'decimal',
            renderHTML: (attrs) => ({ 'data-marker': attrs.marker }),
          },
        }
      },
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

// ── Derived: which marker is active on the current list node? ────────────────
// We re-read the editor state to figure out whether the caret is in a list,
// and if so, which marker it has. Falls back to lastMarkerId when no list.
const isAnyListActive = computed(() =>
  !!editor.value && (editor.value.isActive('bulletList') || editor.value.isActive('orderedList')),
)

const currentMarkerId = computed<string>(() => {
  const e = editor.value
  if (!e) return lastMarkerId.value
  if (e.isActive('bulletList')) {
    const attrs = e.getAttributes('bulletList') as { marker?: string }
    return attrs.marker ?? DEFAULT_OPTION.id
  }
  if (e.isActive('orderedList')) {
    const attrs = e.getAttributes('orderedList') as { marker?: string }
    return attrs.marker ?? 'decimal'
  }
  return lastMarkerId.value
})

const currentOption = computed<MarkerOption>(() => {
  return MARKER_OPTIONS.find((o) => o.id === currentMarkerId.value) ?? DEFAULT_OPTION
})

const currentMarkerGlyph = computed(() => currentOption.value.glyph)
const currentMarkerLabel = computed(() => currentOption.value.label)

// ── Commands ─────────────────────────────────────────────────────────────────
// "Toggle list" uses the *currently displayed* marker (whatever's on the
// caret's list, or the last picked marker if there's no list). This keeps the
// main button's behavior obvious — what you see is what you get.
function onToggleList() {
  applyMarker(currentOption.value)
}

function applyMarker(opt: MarkerOption) {
  if (!editor.value) return
  const e = editor.value
  lastMarkerId.value = opt.id
  listMenuOpen.value = false

  const chain = e.chain().focus()

  // Decide which command to run:
  //   - If we're in a list of the *other* kind, swap to this kind.
  //   - If we're in a list of this kind, either update its marker or toggle off.
  //   - Otherwise turn the current selection into the requested list.
  const inBullet = e.isActive('bulletList')
  const inOrdered = e.isActive('orderedList')
  const wantBullet = opt.kind === 'bullet'

  if (wantBullet && inOrdered) {
    chain.toggleOrderedList().toggleBulletList().updateAttributes('bulletList', { marker: opt.marker }).run()
    return
  }
  if (!wantBullet && inBullet) {
    chain.toggleBulletList().toggleOrderedList().updateAttributes('orderedList', { marker: opt.marker }).run()
    return
  }
  if (wantBullet && inBullet) {
    // Already a bullet list — update the marker (or toggle off if same).
    const currentAttrs = e.getAttributes('bulletList') as { marker?: string }
    if (currentAttrs.marker === opt.marker) {
      chain.toggleBulletList().run()
    } else {
      chain.updateAttributes('bulletList', { marker: opt.marker }).run()
    }
    return
  }
  if (!wantBullet && inOrdered) {
    const currentAttrs = e.getAttributes('orderedList') as { marker?: string }
    if (currentAttrs.marker === opt.marker) {
      chain.toggleOrderedList().run()
    } else {
      chain.updateAttributes('orderedList', { marker: opt.marker }).run()
    }
    return
  }

  // No list active — create one with the requested marker.
  if (wantBullet) {
    chain.toggleBulletList().updateAttributes('bulletList', { marker: opt.marker }).run()
  } else {
    chain.toggleOrderedList().updateAttributes('orderedList', { marker: opt.marker }).run()
  }
}

// ── Marker dropdown open/close ───────────────────────────────────────────────
const listMenuOpen = ref(false)
const listGroupRef = ref<HTMLElement | null>(null)

function handleClickOutside(e: MouseEvent) {
  if (!listMenuOpen.value) return
  if (listGroupRef.value && !listGroupRef.value.contains(e.target as Node)) {
    listMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', handleClickOutside))
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

/* ── List split-button ──────────────────────────────────────────────────── */
.rich-editor__list-group {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.rich-editor__list-main {
  padding-right: 4px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.rich-editor__list-glyph {
  display: inline-block;
  min-width: 14px;
  text-align: center;
}

.rich-editor__list-caret {
  padding: 3px 4px;
  font-size: 10px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.rich-editor__menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 30;
  min-width: 160px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: var(--shadow-card);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.rich-editor__menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text);
  font-family: var(--font-sans);
  text-align: left;
  width: 100%;
}

.rich-editor__menu-item:hover {
  background: var(--color-bg-subtle);
}

.rich-editor__menu-item.is-active {
  color: var(--color-primary);
  font-weight: 600;
}

.rich-editor__menu-glyph {
  display: inline-block;
  width: 16px;
  text-align: center;
  color: var(--color-text-muted);
}

.rich-editor__menu-item.is-active .rich-editor__menu-glyph {
  color: var(--color-primary);
}

.rich-editor__menu-check {
  margin-left: auto;
  color: var(--color-primary);
}

.rich-editor-menu-enter-active,
.rich-editor-menu-leave-active {
  transition: opacity 0.12s, transform 0.12s;
}

.rich-editor-menu-enter-from,
.rich-editor-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

<style>
/* ── Content ────────────────────────────────────────────────────────────────
   These styles live in a global block (no scoped) so the same rules apply to
   the read-only renderer used by the proposal detail/preview view. Any HTML
   we emit here (`<ul data-marker="square">`, `<ol data-marker="decimal">`)
   renders the same way wherever it's shown. */

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

/* Some global resets (Tailwind preflight, PrimeVue base) flatten <em> and
   <strong> back to normal. Restore them explicitly here and in any view that
   renders saved rich content. */
.rich-editor__content .ProseMirror em,
.proposal-rich-content em {
  font-style: italic;
}

.rich-editor__content .ProseMirror strong,
.proposal-rich-content strong {
  font-weight: 700;
}

.rich-editor__content .ProseMirror u,
.proposal-rich-content u {
  text-decoration: underline;
}

/* List markers, driven by data-marker. Default to disc / decimal so older
   content without the attribute still looks right. */
.rich-editor__content .ProseMirror ul,
.proposal-rich-content ul {
  list-style-type: disc;
  padding-left: 24px;
  margin: 0 0 6px;
}

.rich-editor__content .ProseMirror ul[data-marker="disc"],
.proposal-rich-content ul[data-marker="disc"]    { list-style-type: disc; }
.rich-editor__content .ProseMirror ul[data-marker="circle"],
.proposal-rich-content ul[data-marker="circle"]  { list-style-type: circle; }
.rich-editor__content .ProseMirror ul[data-marker="square"],
.proposal-rich-content ul[data-marker="square"]  { list-style-type: square; }

.rich-editor__content .ProseMirror ol,
.proposal-rich-content ol {
  list-style-type: decimal;
  padding-left: 24px;
  margin: 0 0 6px;
}

.rich-editor__content .ProseMirror li,
.proposal-rich-content li {
  color: var(--color-text);
}
</style>
