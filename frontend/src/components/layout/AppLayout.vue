<template>
  <div class="app-layout">

    <!-- Mobile overlay — tap to close sidebar -->
    <Transition name="fade">
      <div
        v-if="sidebarOpen"
        class="sidebar-overlay"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- Sidebar -->
    <AppSidebar
      :class="{ 'is-open': sidebarOpen }"
      @navigate="sidebarOpen = false"
    />

    <!-- Main wrapper: topbar + scrollable content -->
    <div class="main-wrapper">
      <AppTopBar @toggle-sidebar="sidebarOpen = !sidebarOpen" />

      <main class="content">
        <router-view />
      </main>
    </div>

    <!-- Bottom tab bar — mobile only -->
    <AppBottomNav @open-more="sidebarOpen = true" />

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppSidebar from './AppSidebar.vue'
import AppTopBar from './AppTopBar.vue'
import AppBottomNav from './AppBottomNav.vue'

// sidebarOpen is owned here — the single source of truth.
// AppTopBar toggles it. AppSidebar reads it via :class.
// Overlay click and nav item click both close it.
const sidebarOpen = ref(false)
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100svh;
  background: var(--color-bg-app);
}

/* Dark overlay — shown when sidebar is open */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  z-index: 39; /* just below sidebar (z-index: 40), above bottom nav (z-index: 40 too — sidebar wins via stacking) */
}

/* Fade transition for the overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>