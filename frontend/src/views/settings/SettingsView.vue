<template>
  <div class="settings">
    <div class="settings__header">
      <h1 class="settings__title">Configuration</h1>
      <p class="settings__subtitle">
        Admin-managed dropdown lists. These feed the Job Code, Payment Terms, Reference, and
        Project Location choices across every document form.
      </p>
    </div>

    <div class="settings__lists">
      <ConfigListEditor name="job_codes" title="Job Codes" label-header="Job Code" />
      <ConfigListEditor
        name="payment_terms"
        title="Payment Terms"
        label-header="Term"
        :fields="[{ key: 'delay_days', label: 'Delay (days)', type: 'number' }]"
      />
      <ConfigListEditor name="references" title="References" label-header="Reference" />
      <ConfigListEditor
        name="mp_destinations"
        title="MP Destinations"
        label-header="Final Destination"
        :fields="[
          { key: 'physical_address', label: 'Physical Address' },
          { key: 'city', label: 'City' },
          { key: 'state', label: 'State' },
        ]"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import ConfigListEditor from '../../components/settings/ConfigListEditor.vue'
</script>

<style scoped>
.settings { display: flex; flex-direction: column; gap: 20px; padding: 24px; }
.settings__header { display: flex; flex-direction: column; gap: 6px; }
.settings__title { font-size: 20px; font-weight: 800; }
.settings__subtitle { font-size: 13px; color: var(--color-text-muted); margin: 0; max-width: 680px; line-height: 1.5; }
.settings__lists { display: flex; flex-direction: column; gap: 20px; }
</style>
