import type { Attachment } from '../types/common'

/**
 * In-memory attachment store (followup spec §4). Files are held as object URLs
 * for the session — NOT persisted; a refresh clears them (the UI says so). The
 * backend contract is documented in the followup spec; this mock mirrors its
 * shapes so the full upload/download/delete UX ships without server work.
 */

export type AttachmentModule = 'proposals' | 'pos' | 'invoices'

interface StoredAttachment extends Attachment {
  _url: string
}

const store = new Map<string, StoredAttachment[]>()

function key(module: AttachmentModule, recordId: string): string {
  return `${module}:${recordId}`
}

let nextId = 1
function genId(): string {
  return `att${nextId++}`
}

function delay<T>(data: T, ms = 60): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

function toPublic(a: StoredAttachment): Attachment {
  const { _url, ...rest } = a
  void _url
  return rest
}

export function mockListAttachments(module: AttachmentModule, recordId: string): Promise<Attachment[]> {
  return delay((store.get(key(module, recordId)) ?? []).map(toPublic))
}

export function mockAddAttachment(module: AttachmentModule, recordId: string, file: File): Promise<Attachment> {
  const k = key(module, recordId)
  const list = store.get(k) ?? []
  const stored: StoredAttachment = {
    id: genId(),
    file_name: file.name,
    size_bytes: file.size,
    mime_type: file.type || 'application/octet-stream',
    uploaded_at: new Date().toISOString(),
    _url: URL.createObjectURL(file),
  }
  list.push(stored)
  store.set(k, list)
  return delay(toPublic(stored))
}

export function mockDeleteAttachment(module: AttachmentModule, recordId: string, attachmentId: string): Promise<{ id: string }> {
  const k = key(module, recordId)
  const list = store.get(k) ?? []
  const idx = list.findIndex((a) => a.id === attachmentId)
  if (idx >= 0) {
    URL.revokeObjectURL(list[idx]._url)
    list.splice(idx, 1)
    store.set(k, list)
  }
  return delay({ id: attachmentId })
}

/** Object URL for download/open. Empty string if the attachment is gone. */
export function mockGetAttachmentUrl(module: AttachmentModule, recordId: string, attachmentId: string): string {
  const list = store.get(key(module, recordId)) ?? []
  return list.find((a) => a.id === attachmentId)?._url ?? ''
}
