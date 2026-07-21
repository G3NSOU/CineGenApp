<template>
  <div class="ai-config">
    <Teleport to="#app-header-context">
      <div class="cgp-route-context" key="ai-config">
        <el-button text class="cgp-context-home" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>返回
        </el-button>
        <span class="breadcrumb-sep">›</span>
        <span class="page-title">设置</span>
        <nav class="ai-config-header-tabs" aria-label="设置分类">
          <button
            v-for="item in configTabs"
            :key="item.value"
            type="button"
            class="ai-config-header-tab"
            :class="{ 'is-active': activeTab === item.value }"
            :aria-current="activeTab === item.value ? 'page' : undefined"
            @click="activeTab = item.value"
          >{{ item.label }}</button>
        </nav>
      </div>
    </Teleport>

    <main class="ai-config-workspace">
      <AIConfigContent v-model="activeTab" page-mode />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import AIConfigContent from '@/components/AIConfigContent.vue'

const router = useRouter()
const route = useRoute()
const activeTab = ref('configs')
const configTabs = [
  { value: 'configs', label: '服务配置' },
  { value: 'prompts', label: '提示词' },
  { value: 'sceneModelMap', label: '业务场景' },
  { value: 'generation', label: '生成设置' },
  { value: 'storage', label: '存储' },
  { value: 'sd2_assets', label: 'SD2 资产' },
  { value: 'version', label: '版本' },
]

function returnPath() {
  const value = typeof route.query.returnTo === 'string' ? route.query.returnTo : ''
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/ai-config')) return '/'
  return value
}

function goBack() {
  router.push(returnPath())
}
</script>

<style scoped>
.ai-config {
  min-height: calc(100dvh - var(--work-header, 68px));
  padding: 0 24px 28px;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
.ai-config-workspace {
  width: min(1600px, 100%);
  height: calc(100dvh - var(--work-header, 68px) - 28px);
  min-height: 620px;
  margin: 0 auto;
  padding: 18px 0 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.ai-config-header-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin-left: 12px;
  padding: 3px;
  border: 1px solid rgba(235,235,235,.08);
  border-radius: 12px;
  background: rgba(18,19,20,.22);
}
.ai-config-header-tab {
  height: 36px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: rgba(235,235,232,.62);
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  font-weight: 620;
  white-space: nowrap;
  cursor: pointer;
  transition: color 180ms ease, background-color 220ms ease, border-color 220ms ease, transform 180ms ease, box-shadow 220ms ease;
}
.ai-config-header-tab:hover {
  color: rgba(242,242,238,.92);
  background: rgba(235,235,235,.045);
}
.ai-config-header-tab:active { transform: scale(.97); }
.ai-config-header-tab.is-active {
  color: rgba(244,244,240,.94);
  border-color: rgba(235,235,235,.13);
  background: rgba(235,235,235,.085);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 6px 18px rgba(0,0,0,.14);
}
:deep(.ai-config-content),
:deep(.config-tabs) {
  width: 100%;
  height: 100%;
  min-height: 0;
}
:deep(.config-tabs--page > .el-tabs__header) { display: none; }
:deep(.config-tabs) {
  display: flex;
  flex-direction: column;
  margin: 0;
}
:deep(.config-tabs > .el-tabs__header) {
  flex: 0 0 auto;
  min-height: 52px;
  margin: 0 0 14px;
}
:deep(.config-tabs > .el-tabs__content) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
:deep(.config-tabs > .el-tabs__content > .el-tab-pane) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  animation: ai-config-pane-in 260ms cubic-bezier(.2,.8,.2,1) both;
}
:deep(.config-tabs > .el-tabs__content > .el-tab-pane > .tab-content) {
  width: 100%;
  height: 100%;
  max-height: none;
  padding: 2px 0 0 !important;
  overflow: auto;
  scrollbar-gutter: stable;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
@media (max-height: 760px) {
  .ai-config-workspace { min-height: 0; }
}
@keyframes ai-config-pane-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  :deep(.config-tabs > .el-tabs__content > .el-tab-pane) { animation: none; }
}
</style>
