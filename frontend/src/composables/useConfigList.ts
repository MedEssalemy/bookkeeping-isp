import { computed } from 'vue'
import { useConfigListQuery, type ConfigListItem, type ConfigListName } from '../api/configLists'

/**
 * The single read path for every admin-configurable dropdown (spec §3.4).
 * Forms and filters consume this — never a hard-coded options array.
 *
 *   `options` — label strings, for simple Select/MultiSelect bindings.
 *   `items`   — full rows, for consumers needing extras (e.g. Payment Terms'
 *               `delay_days`, MP Destinations' address parts).
 */
export function useConfigList(name: ConfigListName, opts: { includeInactive?: boolean } = {}) {
  const query = useConfigListQuery(name, opts.includeInactive ?? false)

  const items = computed<ConfigListItem[]>(() => query.data.value ?? [])
  const options = computed<string[]>(() => items.value.map((i) => i.label))

  return {
    options,
    items,
    isLoading: query.isLoading,
  }
}
