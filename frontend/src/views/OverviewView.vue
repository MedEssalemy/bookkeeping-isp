<template>
  <div class="overview">

    <!-- KPI cards -->
    <div class="overview__kpis">
      <KpiCard label="Outstanding Invoices" value="$0.00" trend="No data yet" />
      <KpiCard label="Overdue Invoices"     value="$0.00" trend="No data yet" />
      <KpiCard label="Expenses This Month"  value="$0.00" trend="No data yet" />
      <KpiCard label="Open Proposals"       value="0"     trend="No data yet" />
    </div>

    <!-- Recent invoices -->
    <div class="overview__section">
      <div class="overview__section-header">
        <h2 class="overview__section-title">Recent Invoices</h2>
        <RouterLink to="/invoices" class="overview__section-link">
          View all →
        </RouterLink>
      </div>

      <!-- Table card -->
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Date</th>
              <th>Status</th>
              <th class="td--number">Amount</th>
            </tr>
          </thead>
          <tbody>
            <!-- Empty state inside table -->
            <tr>
              <td colspan="5">
                <div class="overview__empty">
                  <svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="color: var(--color-text-subtle);">
                    <path d="M9 12h6M9 16h6M7 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M9 4a2 2 0 0 1 4 0v0a2 2 0 0 1-4 0z"/>
                  </svg>
                  <p style="font-size: 14px; font-weight: 600; color: var(--color-text); margin: 0;">No invoices yet</p>
                  <p style="font-size: 13px; color: var(--color-text-muted); margin: 0;">Invoices you create will appear here.</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import KpiCard from '../components/base/KpiCard.vue'
// Real data comes in a later step when TanStack Query is wired up.
// KPI values are hardcoded stubs for now.
</script>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* ── KPI row — flex wrap matches JSX kpiRow ────────────────────────────────── */
.overview__kpis {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

/* ── Section ───────────────────────────────────────────────────────────────── */
.overview__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.overview__section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.overview__section-link {
  font-size: 13px;
  color: var(--color-primary);
  text-decoration: none;
}

.overview__section-link:hover {
  text-decoration: underline;
}

/* ── Empty state inside table ──────────────────────────────────────────────── */
.overview__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 20px;
  text-align: center;
}
</style>