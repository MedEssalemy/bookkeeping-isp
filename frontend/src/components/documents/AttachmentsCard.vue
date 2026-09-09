<template>
  <div class="attachments card card--padded">
    <div class="attachments__head">
      <h2 class="attachments__title">Attachments</h2>
      <button
        v-if="auth.canEdit"
        class="btn btn--secondary btn--sm"
        :disabled="atLimit"
        :title="atLimit ? `Maximum ${MAX_FILES} files` : ''"
        @click="fileInput?.click()"
      >Upload file</button>
      <input
        ref="fileInput"
        type="file"
        :accept="ACCEPT"
        class="attachments__input"
        @change="onFilePicked"
      />
    </div>

    <p class="attachments__note">
      Attach the counterparty's original file (PDF, Word, Excel, or image; ≤ {{ MAX_MB }} MB, up to {{ MAX_FILES }}).
      Not persisted until the backend lands — files clear on refresh.
    </p>

    <div v-if="error" class="attachments__error">{{ error }}</div>

    <div v-if="isLoading" class="attachments__empty">Loading…</div>
    <div v-else-if="!attachments.length" class="attachments__empty">No files attached.</div>

    <ul v-else class="attachments__list">
      <li v-for="a in attachments" :key="a.id" class="attachments__item">
        <div class="attachments__file">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div class="attachments__meta">
            <span class="attachments__name">{{ a.file_name }}</span>
            <span class="attachments__sub">{{ formatSize(a.size_bytes) }} · {{ formatDate(a.uploaded_at) }}</span>
          </div>
        </div>
        <div class="attachments__actions">
          <button class="btn btn--ghost btn--xs" @click="download(a)">Download</button>
          <button v-if="auth.canEdit" class="btn btn--ghost btn--xs attachments__del" @click="askDelete(a)">Delete</button>
        </div>
      </li>
    </ul>

    <ConfirmModal
      v-model:visible="deleteOpen"
      title="Delete attachment?"
      :message="`Remove “${pendingDelete?.file_name}”? This can't be undone.`"
      confirmLabel="Delete"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="deleteOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRef } from 'vue'
import { useAuthStore } from '../../stores/auth'
import {
  useAttachments,
  useAddAttachment,
  useDeleteAttachment,
  downloadAttachment,
  type AttachmentModule,
} from '../../api/attachments'
import type { Attachment } from '../../types/common'
import ConfirmModal from '../base/ConfirmModal.vue'

const props = defineProps<{ module: AttachmentModule; recordId: string }>()

const auth = useAuthStore()

const MAX_FILES = 5
const MAX_MB = 10
const MAX_BYTES = MAX_MB * 1024 * 1024
const ACCEPT = '.pdf,.docx,.xlsx,.png,.jpg,.jpeg'
const ALLOWED_EXT = ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg']

const recordIdRef = toRef(props, 'recordId')
const { data, isLoading } = useAttachments(props.module, recordIdRef)
const attachments = computed<Attachment[]>(() => data.value ?? [])
const atLimit = computed(() => attachments.value.length >= MAX_FILES)

const fileInput = ref<HTMLInputElement | null>(null)
const error = ref('')

const { mutateAsync: addAttachment } = useAddAttachment(props.module)
const { mutateAsync: deleteAttachment } = useDeleteAttachment(props.module)

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXT.includes(ext)) {
    error.value = `Unsupported file type “.${ext}”. Allowed: ${ALLOWED_EXT.join(', ')}.`
    return
  }
  if (file.size > MAX_BYTES) {
    error.value = `“${file.name}” is ${formatSize(file.size)} — over the ${MAX_MB} MB limit.`
    return
  }
  if (atLimit.value) {
    error.value = `Maximum ${MAX_FILES} files per document.`
    return
  }
  await addAttachment({ recordId: props.recordId, file })
}

function download(a: Attachment) {
  downloadAttachment(props.module, props.recordId, a)
}

const deleteOpen = ref(false)
const pendingDelete = ref<Attachment | null>(null)
function askDelete(a: Attachment) { pendingDelete.value = a; deleteOpen.value = true }
async function confirmDelete() {
  const a = pendingDelete.value
  deleteOpen.value = false
  if (!a) return
  await deleteAttachment({ recordId: props.recordId, attachmentId: a.id })
  pendingDelete.value = null
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.attachments { display: flex; flex-direction: column; gap: 12px; }
.attachments__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.attachments__title { font-size: 14px; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.attachments__input { display: none; }
.attachments__note { font-size: 12px; color: var(--color-text-subtle); margin: 0; line-height: 1.5; }
.attachments__error { padding: 8px 12px; border-radius: 6px; font-size: 13px; background: rgba(220, 38, 38, 0.06); border: 1px solid rgba(220, 38, 38, 0.25); color: var(--color-error); }
.attachments__empty { font-size: 13px; color: var(--color-text-subtle); padding: 8px 0; }

.attachments__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.attachments__item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-bg-subtle);
}
.attachments__file { display: flex; align-items: center; gap: 10px; min-width: 0; color: var(--color-text-subtle); }
.attachments__meta { display: flex; flex-direction: column; min-width: 0; }
.attachments__name { font-size: 13px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.attachments__sub { font-size: 11px; color: var(--color-text-subtle); }
.attachments__actions { display: flex; gap: 6px; flex-shrink: 0; }
.attachments__del:hover { color: var(--color-error); }
.btn--xs { padding: 3px 8px; font-size: 12px; }
</style>
