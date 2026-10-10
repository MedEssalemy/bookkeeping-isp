<template>
  <!-- The only v-html for user content: always sanitized first. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="proposal-rich-content" v-html="safe" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { sanitizeHtml } from '../../utils/sanitizeHtml'

const props = defineProps<{ html: string | null | undefined }>()

const safe = computed(() => sanitizeHtml(props.html))
</script>
