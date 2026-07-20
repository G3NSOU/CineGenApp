<template>
  <div class="app">
    <AppBackground />
    <AppTopHeader
      :active="activeWorkspaceSection"
      :workspace="isWorkspaceRoute"
      :fallback-title="headerFallbackTitle"
      :ai-active="route.name === 'ai-config'"
    />
    <router-view v-slot="{ Component, route }">
      <Transition
        :name="routeTransitionName"
        :css="routeTransitionCss"
        :mode="routeTransitionMode"
        :duration="routeTransitionDuration"
        @after-enter="settleRouteTransition"
        @enter-cancelled="settleRouteTransition"
      >
        <component :is="Component" :key="route.name || route.path" />
      </Transition>
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppBackground from '@/components/AppBackground.vue'
import AppTopHeader from '@/components/AppTopHeader.vue'

const route = useRoute()
const settledRouteName = ref(String(route.name || ''))
const routeGroup = (name: string) => name === 'list' || name === 'materials' ? 'workspace' : 'project'
const isWorkspaceRoute = computed(() => route.name === 'list' || route.name === 'materials')
const activeWorkspaceSection = computed(() => route.name === 'materials' ? 'materials' : 'projects')
const headerFallbackTitle = computed(() => ({
  'free-create': '自由创作',
  'media-library': '媒体素材库',
}[String(route.name || '')] || ''))
const isCrossHierarchyNavigation = computed(() => (
  routeGroup(settledRouteName.value) !== routeGroup(String(route.name || ''))
))
const isWorkspaceSectionNavigation = computed(() => (
  routeGroup(settledRouteName.value) === 'workspace' && isWorkspaceRoute.value
))
const routeTransitionName = computed(() => {
  if (isCrossHierarchyNavigation.value) {
    return isWorkspaceRoute.value ? 'workspace-exit-project' : 'workspace-enter-project'
  }
  if (route.name === 'materials') return 'workspace-forward'
  if (route.name === 'list') return 'workspace-back'
  return 'page-glass'
})
// The background lives outside router-view and never participates in a route
// transition. Cross-hierarchy pages animate their direct content children in
// out-in order, avoiding both translucent overlap and WebGL canvas remounts.
const routeTransitionCss = computed(() => true)
const routeTransitionMode = computed(() => isWorkspaceSectionNavigation.value ? undefined : 'out-in')
const routeTransitionDuration = computed(() => {
  if (isCrossHierarchyNavigation.value) return { enter: 180, leave: 110 }
  if (isWorkspaceSectionNavigation.value) return { enter: 220, leave: 160 }
  return { enter: 170, leave: 100 }
})
const settleRouteTransition = () => {
  settledRouteName.value = String(route.name || '')
}
</script>

<style>
* {
  box-sizing: border-box;
}
html, body, #app, .app {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: transparent;
  color: var(--text-primary);
  transition: background 0.25s, color 0.25s;
}
.app {
  position: relative;
  isolation: isolate;
}

/* AI configuration is a very large, control-dense surface. Avoid stacking two
 * expensive live backdrop filters over the animated background. The opaque
 * neutral fill keeps the glass edge language while making input/compositing
 * responsive on lower-end GPUs. */
html.dark body .ai-config-overlay {
  background: rgba(6, 7, 8, .66) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
html.dark body .ai-config-overlay .ai-config-dialog {
  background:
    linear-gradient(145deg, rgba(238, 241, 244, .045), transparent 38%),
    rgba(18, 19, 20, .965) !important;
  box-shadow: 0 28px 80px rgba(0, 0, 0, .48), inset 0 1px 0 rgba(238, 241, 244, .055) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  contain: layout paint;
}
.app > .film-list,
.app > .materials-page,
.app > .studio-page,
.app > .drama-detail,
.app > .film-create,
.app > .drama-canvas-page,
.app > .ai-config,
.app > .free-create-page,
.app > .media-library-page {
  min-height: calc(100dvh - 68px) !important;
}
.workspace-forward-leave-active,
.workspace-back-leave-active {
  position: absolute;
  inset: 68px 0 auto;
  width: 100%;
  z-index: 0;
}
.workspace-forward-enter-active,
.workspace-back-enter-active {
  position: relative;
  z-index: 1;
}

/*
 * Never animate a route root. A transformed ancestor changes the containing
 * block of fixed sidebars; fading whole translucent pages also changes the
 * apparent brightness of the persistent background. Animate only content.
 */
.workspace-forward-enter-active .materials-sidebar,
.workspace-back-leave-active .materials-sidebar {
  transition: opacity var(--motion-fast) var(--motion-ease-out), transform var(--motion-standard) var(--motion-ease-out);
}
.workspace-forward-enter-from .materials-sidebar,
.workspace-back-leave-to .materials-sidebar { opacity: 0; transform: translateX(-16px); }

.workspace-forward-enter-active .materials-content,
.workspace-back-leave-active .materials-content,
.workspace-back-enter-active .projects-wrap,
.workspace-forward-leave-active .projects-wrap {
  transition: opacity var(--motion-fast) var(--motion-ease-out), transform var(--motion-standard) var(--motion-ease-out);
}
.workspace-forward-enter-from .materials-content,
.workspace-back-enter-from .projects-wrap { opacity: 0; transform: translateY(6px); }
.workspace-back-leave-to .materials-content,
.workspace-forward-leave-to .projects-wrap { opacity: 0; transform: translateY(-3px); }

.page-glass-enter-active > * {
  transition: opacity 150ms var(--motion-ease-out), transform 170ms var(--motion-ease-out);
}
.page-glass-leave-active > * {
  transition: opacity 85ms var(--motion-ease-out), transform 100ms var(--motion-ease-out);
}
.page-glass-enter-from > * { opacity: 0; transform: translateY(6px); }
.page-glass-leave-to > * { opacity: 0; transform: translateY(-3px); }

/*
 * Cross-hierarchy navigation is out-in: translucent route surfaces never
 * overlap, so the fixed background keeps exactly the same apparent luminance.
 */
.workspace-enter-project-enter-active > *,
.workspace-exit-project-enter-active .projects-wrap {
  transition: opacity 160ms var(--motion-ease-out), transform 180ms var(--motion-ease-out);
}
.workspace-enter-project-leave-active .projects-wrap,
.workspace-exit-project-leave-active > * {
  transition: opacity 90ms var(--motion-ease-out), transform 110ms var(--motion-ease-out);
}
.workspace-enter-project-leave-to .projects-wrap { opacity: 0; transform: translateY(-3px); }
.workspace-enter-project-enter-from > * { opacity: 0; transform: translateY(6px); }
.workspace-exit-project-leave-to > * { opacity: 0; transform: translateY(-3px); }
.workspace-exit-project-enter-from .projects-wrap { opacity: 0; transform: translateY(6px); }

@media (prefers-reduced-motion: reduce) {
  .page-glass-enter-active,
  .page-glass-leave-active,
  .workspace-forward-enter-active,
  .workspace-forward-leave-active,
  .workspace-back-enter-active,
  .workspace-back-leave-active,
  .workspace-enter-project-enter-active,
  .workspace-enter-project-leave-active,
  .workspace-exit-project-enter-active,
  .workspace-exit-project-leave-active { transition: none; }
  .page-glass-enter-active > *,
  .page-glass-leave-active > *,
  .workspace-forward-enter-active :is(.materials-sidebar,.materials-content),
  .workspace-back-leave-active :is(.materials-sidebar,.materials-content),
  .workspace-back-enter-active .projects-wrap,
  .workspace-forward-leave-active .projects-wrap,
  .workspace-enter-project-enter-active > *,
  .workspace-enter-project-leave-active .projects-wrap,
  .workspace-exit-project-enter-active .projects-wrap,
  .workspace-exit-project-leave-active > * {
    transition: opacity var(--motion-fast) var(--motion-ease-out);
  }
  .page-glass-enter-from > *,
  .page-glass-leave-to > *,
  .workspace-forward-enter-from :is(.materials-sidebar,.materials-content),
  .workspace-back-leave-to :is(.materials-sidebar,.materials-content),
  .workspace-back-enter-from .projects-wrap,
  .workspace-forward-leave-to .projects-wrap,
  .workspace-enter-project-enter-from > *,
  .workspace-enter-project-leave-to .projects-wrap,
  .workspace-exit-project-enter-from .projects-wrap,
  .workspace-exit-project-leave-to > * { transform: none; }
}
</style>
