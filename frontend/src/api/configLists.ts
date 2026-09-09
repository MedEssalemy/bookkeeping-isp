import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { useMocks } from '../mocks'
import {
  mockGetConfigList,
  mockAddListItem,
  mockUpdateListItem,
  mockToggleListItem,
  mockDeleteListItem,
  mockConfigListUsage,
  type ConfigListItem,
  type ConfigListName,
  type ListItemExtras,
} from '../mocks/configLists'
import { api as axios } from './axios'

export type { ConfigListItem, ConfigListName, ListItemExtras }

async function getConfigList(name: ConfigListName, includeInactive = false): Promise<ConfigListItem[]> {
  if (useMocks) return mockGetConfigList(name, includeInactive)
  return axios.get(`/config-lists/${name}`, { params: { include_inactive: includeInactive } }).then((r) => r.data as ConfigListItem[])
}

/**
 * Raw config-list query. Prefer the `useConfigList` composable in components —
 * it exposes ready-to-bind `options` (labels) plus the full `items`.
 * Pass `includeInactive` for the settings editor / edit-mode dropdowns.
 */
export function useConfigListQuery(name: ConfigListName, includeInactive = false) {
  return useQuery({
    queryKey: ['config-list', name, includeInactive],
    queryFn: () => getConfigList(name, includeInactive),
    staleTime: 5 * 60 * 1000,
  })
}

// ── Usage counts ──────────────────────────────────────────────────────────────

async function getConfigListUsage(name: ConfigListName): Promise<Record<string, number>> {
  if (useMocks) return mockConfigListUsage(name)
  return axios.get(`/config-lists/${name}/usage`).then((r) => r.data as Record<string, number>)
}

export function useConfigListUsage(name: Ref<ConfigListName>) {
  return useQuery({
    queryKey: ['config-list-usage', name],
    queryFn: () => getConfigListUsage(name.value),
  })
}

// ── Mutations (Settings → Lists CRUD, followup §2) ────────────────────────────

function invalidate(qc: ReturnType<typeof useQueryClient>, name: ConfigListName) {
  qc.invalidateQueries({ queryKey: ['config-list', name] })
  qc.invalidateQueries({ queryKey: ['config-list-usage', name] })
}

async function addListItem(name: ConfigListName, label: string, extras: ListItemExtras): Promise<ConfigListItem> {
  if (useMocks) return mockAddListItem(name, label, extras)
  return axios.post(`/config-lists/${name}/items`, { label, ...extras }).then((r) => r.data as ConfigListItem)
}

export function useAddListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { name: ConfigListName; label: string; extras?: ListItemExtras }) =>
      addListItem(args.name, args.label, args.extras ?? {}),
    onSuccess: (_, args) => invalidate(qc, args.name),
  })
}

async function updateListItem(name: ConfigListName, id: string, patch: { label?: string } & ListItemExtras): Promise<ConfigListItem> {
  if (useMocks) return mockUpdateListItem(name, id, patch)
  return axios.patch(`/config-lists/${name}/items/${id}`, patch).then((r) => r.data as ConfigListItem)
}

export function useUpdateListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { name: ConfigListName; id: string; patch: { label?: string } & ListItemExtras }) =>
      updateListItem(args.name, args.id, args.patch),
    onSuccess: (_, args) => invalidate(qc, args.name),
  })
}

async function toggleListItem(name: ConfigListName, id: string, active: boolean): Promise<ConfigListItem> {
  if (useMocks) return mockToggleListItem(name, id, active)
  return axios.patch(`/config-lists/${name}/items/${id}`, { active }).then((r) => r.data as ConfigListItem)
}

export function useToggleListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { name: ConfigListName; id: string; active: boolean }) =>
      toggleListItem(args.name, args.id, args.active),
    onSuccess: (_, args) => invalidate(qc, args.name),
  })
}

async function deleteListItem(name: ConfigListName, id: string): Promise<{ id: string }> {
  if (useMocks) return mockDeleteListItem(name, id)
  return axios.delete(`/config-lists/${name}/items/${id}`).then((r) => r.data as { id: string })
}

export function useDeleteListItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { name: ConfigListName; id: string }) => deleteListItem(args.name, args.id),
    onSuccess: (_, args) => invalidate(qc, args.name),
  })
}
