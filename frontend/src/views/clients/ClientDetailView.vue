<template>
  <div class="client-detail">
    <!-- Header -->
    <div class="client-detail__header">
      <div class="client-detail__crumbs">
        <button type="button" class="client-detail__back" @click="router.push({ name: 'clients' })">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Clients
        </button>
      </div>
      <h1 class="client-detail__title">{{ business }}</h1>
      <div class="client-detail__stats">
        <span>{{ contactCount }} client name{{ contactCount === 1 ? '' : 's' }}</span>
        <span class="client-detail__stat-divider">·</span>
        <span>{{ facilityCount }} facilit{{ facilityCount === 1 ? 'y' : 'ies' }}</span>
        <span class="client-detail__stat-divider">·</span>
        <span>{{ rows.length }} row{{ rows.length === 1 ? '' : 's' }}</span>
      </div>
    </div>

    <!-- Filter -->
    <div class="client-detail__filters">
      <div class="client-detail__search-wrap">
        <svg class="client-detail__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          v-model="search"
          class="field__input client-detail__filter-input"
          type="text"
          placeholder="Search facility, client name, department, address…"
        />
      </div>
      <button class="btn btn--secondary btn--sm" @click="handleExport">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export this business
      </button>
    </div>

    <!-- Client names table -->
    <div class="client-detail__table-wrap">
      <template v-if="isLoading">
        <div v-for="i in 5" :key="i" class="skeleton skeleton--row" />
      </template>

      <EmptyState
        v-else-if="!filteredRows.length"
        heading="No client names found"
        :subtext="search ? 'Try a different search.' : 'This business has no client names on file.'"
      />

      <table v-else class="table">
        <thead>
          <tr>
            <th>Facility</th>
            <th>Department</th>
            <th>Title</th>
            <th>Client Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in filteredRows" :key="i" class="client-detail__row">
            <td class="client-detail__facility">{{ r.facility || '—' }}</td>
            <td>{{ r.department || '—' }}</td>
            <td>{{ r.title || '—' }}</td>
            <td class="client-detail__person">{{ r.name || '—' }}</td>
            <td class="client-detail__nowrap">{{ r.phone || '—' }}</td>
            <td>
              <a v-if="r.email" :href="`mailto:${cleanEmail(r.email)}`">{{ cleanEmail(r.email) }}</a>
              <span v-else>—</span>
            </td>
            <td class="client-detail__addr">{{ formatAddress(r) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useBusinessContacts } from '../../api/clients'
import { exportContactsAsCSV } from './clientsCsv'
import EmptyState from '../../components/base/EmptyState.vue'
import type { ClientContact } from '../../types/proposal'

const router = useRouter()
const route = useRoute()

const business = computed(() => String(route.params.business ?? ''))
const businessRef = computed(() => business.value)
const { data, isLoading } = useBusinessContacts(businessRef)
const rows = computed<ClientContact[]>(() => data.value ?? [])

const contactCount = computed(() => new Set(rows.value.map((r) => r.name).filter(Boolean)).size)
const facilityCount = computed(() => new Set(rows.value.map((r) => r.facility).filter(Boolean)).size)

const search = ref('')
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) => {
    return [
      r.facility, r.department, r.title, r.name, r.phone, r.email,
      r.address, r.city, r.state,
    ].some((v) => (v ?? '').toLowerCase().includes(q))
  })
})

function formatAddress(r: ClientContact): string {
  const parts = [r.address, [r.city, r.state].filter(Boolean).join(', ')].filter(Boolean)
  return parts.join(' · ') || '—'
}

// Some seed emails have stray trailing characters (e.g. "foo@bar>") — strip them.
function cleanEmail(e: string): string {
  return e.replace(/[<>]/g, '').trim()
}

function handleExport() {
  exportContactsAsCSV(
    rows.value,
    `${business.value.replace(/[^a-z0-9_\-]+/gi, '_')}-contacts.csv`,
  )
}
</script>

<style scoped>
.client-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.client-detail__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.client-detail__crumbs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.client-detail__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 0;
  font-size: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: var(--font-sans);
}

.client-detail__back:hover {
  color: var(--color-primary);
}

.client-detail__title {
  font-size: 22px;
  font-weight: 800;
  margin: 0;
}

.client-detail__stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.client-detail__stat-divider {
  color: var(--color-text-subtle);
}

.client-detail__filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.client-detail__search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 280px;
  max-width: 420px;
}

.client-detail__search-icon {
  position: absolute;
  left: 10px;
  color: var(--color-text-subtle);
  pointer-events: none;
}

.client-detail__filter-input {
  width: 100%;
  padding-left: 32px;
}

.client-detail__table-wrap {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  min-width: 0;
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table thead th {
  padding: 10px 14px;
  background: var(--color-bg-subtle);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}

.table tbody td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  vertical-align: top;
}

.table tbody tr:last-child td { border-bottom: none; }

.client-detail__row:hover { background: var(--color-bg-subtle); }

.client-detail__facility {
  font-weight: 600;
}

.client-detail__person {
  color: var(--color-primary);
}

.client-detail__nowrap {
  white-space: nowrap;
}

.client-detail__addr {
  font-size: 12px;
  color: var(--color-text-muted);
}

.skeleton--row {
  height: 48px;
  border-radius: 0;
  border-bottom: 1px solid var(--color-border);
  display: block;
}
</style>
