import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { useMocks } from '../mocks'
import {
  mockListAttachments,
  mockAddAttachment,
  mockDeleteAttachment,
  mockGetAttachmentUrl,
  type AttachmentModule,
} from '../mocks/attachments'
import { api as axios } from './axios'
import type { Attachment } from '../types/common'

export type { AttachmentModule }

async function listAttachments(module: AttachmentModule, recordId: string): Promise<Attachment[]> {
  if (useMocks) return mockListAttachments(module, recordId)
  return axios.get(`/${module}/${recordId}/attachments`).then((r) => r.data as Attachment[])
}

async function addAttachment(module: AttachmentModule, recordId: string, file: File): Promise<Attachment> {
  if (useMocks) return mockAddAttachment(module, recordId, file)
  const form = new FormData()
  form.append('file', file)
  return axios.post(`/${module}/${recordId}/attachments`, form).then((r) => r.data as Attachment)
}

async function deleteAttachment(module: AttachmentModule, recordId: string, attachmentId: string): Promise<{ id: string }> {
  if (useMocks) return mockDeleteAttachment(module, recordId, attachmentId)
  return axios.delete(`/attachments/${attachmentId}`).then((r) => r.data as { id: string })
}

export function useAttachments(module: AttachmentModule, recordId: Ref<string>) {
  return useQuery({
    queryKey: ['attachments', module, recordId],
    queryFn: () => listAttachments(module, recordId.value),
    enabled: () => !!recordId.value,
  })
}

export function useAddAttachment(module: AttachmentModule) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { recordId: string; file: File }) => addAttachment(module, args.recordId, args.file),
    onSuccess: (_, args) => qc.invalidateQueries({ queryKey: ['attachments', module, args.recordId] }),
  })
}

export function useDeleteAttachment(module: AttachmentModule) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { recordId: string; attachmentId: string }) =>
      deleteAttachment(module, args.recordId, args.attachmentId),
    onSuccess: (_, args) => qc.invalidateQueries({ queryKey: ['attachments', module, args.recordId] }),
  })
}

/**
 * Trigger a download of an attachment. Mock: session object URL. Backend: the
 * file is fetched through axios (a plain link wouldn't carry the Bearer token).
 */
export async function downloadAttachment(module: AttachmentModule, recordId: string, att: Attachment): Promise<void> {
  let url: string
  let revoke = false
  if (useMocks) {
    url = mockGetAttachmentUrl(module, recordId, att.id)
  } else {
    const blob = await axios
      .get(`/attachments/${att.id}/download`, { responseType: 'blob' })
      .then((r) => r.data as Blob)
    url = URL.createObjectURL(blob)
    revoke = true
  }
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = att.file_name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000)
}
