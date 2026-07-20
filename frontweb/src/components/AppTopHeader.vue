<template>
  <header class="app-top-header">
    <div class="app-top-header__inner">
      <button class="app-top-header__brand" type="button" aria-label="返回项目空间" @click="router.push('/')">
        <CineGenBrand />
      </button>

      <nav v-show="workspace" class="app-top-header__nav app-top-header__content-enter" aria-label="主要导航">
        <span class="app-top-header__nav-slider" :class="{ 'is-materials': active === 'materials' }" aria-hidden="true" />
        <button
          type="button"
          class="app-top-header__nav-item"
          :class="{ 'is-active': active === 'projects' }"
          :aria-current="active === 'projects' ? 'page' : undefined"
          @click="router.push('/')"
        >
          <el-icon><FolderOpened /></el-icon><span>项目空间</span>
        </button>
        <button
          type="button"
          class="app-top-header__nav-item"
          :class="{ 'is-active': active === 'materials' }"
          :aria-current="active === 'materials' ? 'page' : undefined"
          @click="router.push('/materials')"
        >
          <el-icon><Files /></el-icon><span>素材库</span>
        </button>
      </nav>

      <div v-show="!workspace" id="app-header-context" class="app-top-header__context" aria-label="当前位置与页面操作">
        <div v-if="fallbackTitle" class="app-top-header__fallback app-top-header__content-enter">
          <el-button text @click="router.push('/')">项目</el-button>
          <span aria-hidden="true">›</span>
          <strong>{{ fallbackTitle }}</strong>
        </div>
      </div>

      <div class="app-top-header__actions" aria-label="全局操作">
        <div id="app-header-actions" class="app-top-header__supplemental" />
        <el-popover
          v-if="workspace && active === 'projects'"
          placement="bottom-end"
          :width="510"
          trigger="click"
          popper-class="background-picker-popper"
        >
          <template #reference>
            <el-button class="btn-settings app-top-header__background" aria-label="调整外观">
              <el-icon><Picture /></el-icon><span>外观</span>
            </el-button>
          </template>

          <section class="background-picker" aria-label="外观设置">
            <header class="background-picker__header">
              <div>
                <strong>外观</strong>
                <p>当前客户端的所有页面统一使用</p>
              </div>
              <el-button v-if="activeBackgroundId !== 'ambient'" text size="small" @click="resetActiveBackground">
                <el-icon><RefreshRight /></el-icon>重置
              </el-button>
            </header>

            <div v-if="supportsMaterialMode" class="material-picker" aria-label="界面材质">
              <div class="material-picker__label">
                <strong>界面材质</strong>
                <small>切换后不改变任何页面布局</small>
              </div>
              <div class="material-picker__options">
                <button
                  v-for="option in materialOptions"
                  :key="option.id"
                  type="button"
                  class="material-option"
                  :class="{ 'is-active': activeMaterialId === option.id }"
                  :aria-pressed="activeMaterialId === option.id"
                  @click="setAppMaterial(option.id)"
                >
                  <span class="material-option__sample" :class="`is-${option.id}`" aria-hidden="true">
                    <i /><i /><i />
                  </span>
                  <span class="material-option__copy">
                    <strong>{{ option.name }}</strong>
                    <small>{{ option.description }}</small>
                  </span>
                  <el-icon v-if="activeMaterialId === option.id" class="material-option__check"><Check /></el-icon>
                </button>
              </div>
            </div>

            <div class="background-picker__section-label">
              <strong>背景</strong>
              <small v-if="activeMaterialId === 'simple'">简约模式下暂停动态背景，切回后自动恢复</small>
              <small v-else>选择全局背景并调整动态参数</small>
            </div>

            <div class="background-picker__options" :class="{ 'is-paused': activeMaterialId === 'simple' }">
              <button
                v-for="option in backgroundOptions"
                :key="option.id"
                type="button"
                class="background-option"
                :class="{ 'is-active': activeBackgroundId === option.id }"
                :disabled="activeMaterialId === 'simple'"
                :aria-pressed="activeBackgroundId === option.id"
                @click="setAppBackground(option.id)"
              >
                <span class="background-option__preview" :class="`is-${option.id}`">
                  <span v-if="activeBackgroundId === option.id" class="background-option__check"><el-icon><Check /></el-icon></span>
                </span>
                <span class="background-option__copy">
                  <strong>{{ option.name }}</strong>
                  <small>{{ option.description }}</small>
                </span>
              </button>
            </div>

            <div
              class="background-picker__controls-stage"
              :class="{ 'is-empty': activeBackgroundId === 'ambient' }"
            >
              <div
                class="background-picker__controls"
                :class="{ 'is-active': activeMaterialId !== 'simple' && activeBackgroundId === 'silk' }"
                :aria-hidden="activeMaterialId === 'simple' || activeBackgroundId !== 'silk'"
                :inert="activeMaterialId === 'simple' || activeBackgroundId !== 'silk'"
              >
                <label class="background-control background-control--color">
                  <span>颜色</span>
                  <span class="background-color-value">{{ silkSettings.color }}</span>
                  <input v-model="silkSettings.color" type="color" aria-label="Silk 颜色" />
                </label>
                <label class="background-control">
                  <span>速度</span><output>{{ silkSettings.speed.toFixed(1) }}</output>
                  <el-slider v-model="silkSettings.speed" :min="0" :max="12" :step="0.5" :show-tooltip="false" />
                </label>
                <label class="background-control">
                  <span>纹理尺度</span><output>{{ silkSettings.scale.toFixed(2) }}</output>
                  <el-slider v-model="silkSettings.scale" :min="0.35" :max="2" :step="0.05" :show-tooltip="false" />
                </label>
                <label class="background-control">
                  <span>颗粒</span><output>{{ silkSettings.noiseIntensity.toFixed(1) }}</output>
                  <el-slider v-model="silkSettings.noiseIntensity" :min="0" :max="4" :step="0.1" :show-tooltip="false" />
                </label>
                <label class="background-control">
                  <span>旋转</span><output>{{ silkSettings.rotation.toFixed(2) }}</output>
                  <el-slider v-model="silkSettings.rotation" :min="0" :max="6.28" :step="0.01" :show-tooltip="false" />
                </label>
              </div>

              <div
                class="background-picker__controls background-picker__controls--rays"
                :class="{ 'is-active': activeMaterialId !== 'simple' && activeBackgroundId === 'rays' }"
                :aria-hidden="activeMaterialId === 'simple' || activeBackgroundId !== 'rays'"
                :inert="activeMaterialId === 'simple' || activeBackgroundId !== 'rays'"
              >
                <div class="background-control background-control--colors">
                  <span>光束颜色</span>
                  <div class="background-color-group">
                    <label><input v-model="raysSettings.rayColor1" type="color" aria-label="Side Rays 颜色 1" /></label>
                    <label><input v-model="raysSettings.rayColor2" type="color" aria-label="Side Rays 颜色 2" /></label>
                  </div>
                </div>
                <label class="background-control">
                  <span>速度</span><output>{{ raysSettings.speed.toFixed(1) }}</output>
                  <el-slider v-model="raysSettings.speed" :min="0" :max="8" :step="0.1" :show-tooltip="false" />
                </label>
                <label class="background-control">
                  <span>亮度</span><output>{{ raysSettings.intensity.toFixed(1) }}</output>
                  <el-slider v-model="raysSettings.intensity" :min="0.2" :max="4" :step="0.1" :show-tooltip="false" />
                </label>
                <label class="background-control">
                  <span>展开</span><output>{{ raysSettings.spread.toFixed(1) }}</output>
                  <el-slider v-model="raysSettings.spread" :min="0.2" :max="4" :step="0.1" :show-tooltip="false" />
                </label>
                <label class="background-control background-control--select">
                  <span>光源位置</span>
                  <el-select v-model="raysSettings.origin" size="small" aria-label="Side Rays 光源位置">
                    <el-option label="左上" value="top-left" /><el-option label="右上" value="top-right" />
                    <el-option label="左下" value="bottom-left" /><el-option label="右下" value="bottom-right" />
                  </el-select>
                </label>
                <label class="background-control">
                  <span>倾斜</span><output>{{ raysSettings.tilt.toFixed(0) }}°</output>
                  <el-slider v-model="raysSettings.tilt" :min="-90" :max="90" :step="1" :show-tooltip="false" />
                </label>
                <label class="background-control">
                  <span>饱和度</span><output>{{ raysSettings.saturation.toFixed(1) }}</output>
                  <el-slider v-model="raysSettings.saturation" :min="0" :max="3" :step="0.1" :show-tooltip="false" />
                </label>
                <label class="background-control">
                  <span>双色混合</span><output>{{ raysSettings.blend.toFixed(2) }}</output>
                  <el-slider v-model="raysSettings.blend" :min="0" :max="1" :step="0.05" :show-tooltip="false" />
                </label>
                <label class="background-control">
                  <span>衰减</span><output>{{ raysSettings.falloff.toFixed(1) }}</output>
                  <el-slider v-model="raysSettings.falloff" :min="0.5" :max="4" :step="0.1" :show-tooltip="false" />
                </label>
                <label class="background-control">
                  <span>透明度</span><output>{{ raysSettings.opacity.toFixed(2) }}</output>
                  <el-slider v-model="raysSettings.opacity" :min="0.1" :max="1" :step="0.05" :show-tooltip="false" />
                </label>
              </div>
            </div>
          </section>
        </el-popover>
        <el-button v-if="workspace && active === 'projects'" class="btn-settings app-top-header__ai" :class="{ 'is-current': aiActive }" :disabled="aiActive" @click="openAiConfig">
          <el-icon><Setting /></el-icon><span>AI 配置</span>
        </el-button>
        <div v-if="isWindowsDesktop" class="app-window-controls" aria-label="窗口控制">
          <button class="app-window-control" type="button" aria-label="最小化" title="最小化" @click="minimizeWindow">
            <el-icon><Minus /></el-icon>
          </button>
          <button
            class="app-window-control"
            type="button"
            :aria-label="isWindowMaximized ? '还原窗口' : '最大化窗口'"
            :aria-pressed="isWindowMaximized"
            :title="isWindowMaximized ? '还原窗口' : '最大化窗口'"
            @click="toggleMaximizeWindow"
          >
            <el-icon><FullScreen /></el-icon>
          </button>
          <button class="app-window-control is-close" type="button" aria-label="关闭窗口" title="关闭窗口" @click="closeWindow">
            <el-icon><CloseBold /></el-icon>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, CloseBold, Files, FolderOpened, FullScreen, Minus, Picture, RefreshRight, Setting } from '@element-plus/icons-vue'
import CineGenBrand from '@/components/CineGenBrand.vue'
import { useAppBackground } from '@/composables/useAppBackground'

defineProps({
  active: { type: String, required: true },
  workspace: { type: Boolean, default: false },
  fallbackTitle: { type: String, default: '' },
  aiActive: { type: Boolean, default: false },
})

const router = useRouter()
const openAiConfig = () => {
  if (router.currentRoute.value.name === 'ai-config') return
  router.push({
    name: 'ai-config',
    query: { returnTo: router.currentRoute.value.fullPath },
  })
}
const isWindowsDesktop = document.documentElement.dataset.desktopShell === 'windows' && Boolean(window.cinegenWindow)
const isWindowMaximized = ref(false)
let stopWindowStateListener = null
const {
  activeMaterialId,
  materialOptions,
  supportsMaterialMode,
  activeBackgroundId,
  backgroundOptions,
  silkSettings,
  raysSettings,
  setAppBackground,
  setAppMaterial,
  resetSilkSettings,
  resetRaysSettings,
} = useAppBackground()

function resetActiveBackground() {
  if (activeBackgroundId.value === 'silk') resetSilkSettings()
  if (activeBackgroundId.value === 'rays') resetRaysSettings()
}

async function minimizeWindow() {
  await window.cinegenWindow?.minimize()
}

async function toggleMaximizeWindow() {
  const state = await window.cinegenWindow?.toggleMaximize()
  if (state) isWindowMaximized.value = Boolean(state.isMaximized)
}

async function closeWindow() {
  await window.cinegenWindow?.close()
}

onMounted(async () => {
  if (!isWindowsDesktop) return
  const state = await window.cinegenWindow.getState()
  isWindowMaximized.value = Boolean(state?.isMaximized)
  stopWindowStateListener = window.cinegenWindow.onStateChange((nextState) => {
    isWindowMaximized.value = Boolean(nextState?.isMaximized)
  })
})
onBeforeUnmount(() => stopWindowStateListener?.())
</script>

<style scoped>
.app-top-header {
  position: sticky;
  top: 0;
  z-index: 50;
  width: 100%;
  height: 68px;
  border-bottom: 1px solid rgba(232,232,226,.09);
  background: var(--liquid-frost-bg);
  box-shadow: 0 10px 34px rgba(5,6,6,.2);
  backdrop-filter: blur(var(--liquid-frost-blur)) saturate(106%);
  -webkit-backdrop-filter: blur(var(--liquid-frost-blur)) saturate(106%);
}
.app-top-header__inner {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 24px;
}
.app-top-header__brand {
  display: flex;
  flex: 0 0 166px;
  align-items: center;
  height: 48px;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
}
.app-top-header__nav {
  --nav-item-width: 108px;
  --nav-gap: 4px;
  --nav-pad: 4px;
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--nav-gap);
  padding: var(--nav-pad);
  border: 1px solid rgba(232,232,226,.09);
  border-radius: 13px;
  background: rgba(16,17,17,.3);
  box-shadow: 0 6px 18px rgba(5,6,6,.12);
}
.app-top-header__nav-slider {
  position: absolute;
  top: var(--nav-pad);
  left: var(--nav-pad);
  width: var(--nav-item-width);
  height: 36px;
  overflow: hidden;
  border: 1px solid rgba(225,226,219,.25);
  border-radius: 9px;
  background: var(--liquid-pulse-bg);
  box-shadow: 0 0 0 1px rgba(220,222,214,.045),0 0 22px var(--liquid-pulse-glow);
  transform: translateX(0);
  transition: transform var(--motion-standard) var(--motion-ease-in-out), box-shadow var(--motion-standard) var(--motion-ease-out);
  pointer-events: none;
}
.app-top-header__nav-slider::after {
  content: "";
  position: absolute;
  inset: -35% -10%;
  background: radial-gradient(circle at 72% 18%,rgba(221,225,215,.2),transparent 42%);
  opacity: .72;
}
.app-top-header__nav-slider.is-materials {
  transform: translateX(calc(100% + var(--nav-gap)));
}
.app-top-header__nav-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  z-index: 1;
  width: var(--nav-item-width);
  min-width: var(--nav-item-width);
  height: 36px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: 9px;
  color: #a9aba6;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--motion-fast) var(--motion-ease-out), transform var(--motion-fast) var(--motion-ease-out);
}
.app-top-header__nav-item:hover {
  color: #ecece7;
  border-color: transparent;
  background: transparent;
}
.app-top-header__nav-item.is-active {
  color: #ecece7;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
}
.app-top-header__nav-item:active { transform: scale(.97); transition-duration: 100ms; }
.app-top-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-left: auto;
}
.app-top-header__context {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
  height: 48px;
  overflow: hidden;
}
.app-top-header__supplemental { display: flex; align-items: center; gap: 8px; }
.app-top-header__ai { min-width: 102px; }
.app-top-header__background { min-width: 84px; }
:global(html[data-desktop-shell="windows"]) .app-top-header__background { display: none; }
.app-top-header__ai.is-current { opacity: .72; }
.app-window-controls {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 38px;
  margin-left: 2px;
  padding-left: 8px;
  border-left: 1px solid rgba(235,235,235,.09);
  -webkit-app-region: no-drag;
}
.app-window-control {
  display: inline-grid;
  width: 38px;
  min-width: 38px;
  height: 38px;
  padding: 0;
  place-items: center;
  border: 1px solid rgba(235,235,235,.09);
  border-radius: 10px;
  color: #c8c8c4;
  background: rgba(235,235,235,.035);
  box-shadow: inset 0 1px 0 rgba(235,235,235,.025);
  cursor: pointer;
  transition: color var(--motion-fast) var(--motion-ease-out), background-color var(--motion-fast) var(--motion-ease-out), border-color var(--motion-fast) var(--motion-ease-out), transform var(--motion-fast) var(--motion-ease-out);
}
.app-window-control:hover {
  color: #eeeeea;
  border-color: rgba(235,235,235,.18);
  background: rgba(235,235,235,.09);
}
@media (hover: hover) and (pointer: fine) { .app-window-control:hover { transform: translateY(-1px); } }
.app-window-control:active { transform: translateY(0) scale(.96); transition-duration: 100ms; }
.app-window-control:focus-visible { outline: 2px solid rgba(235,235,235,.28); outline-offset: 2px; }
.app-window-control.is-close:hover {
  border-color: rgba(210,84,84,.42);
  background: rgba(176,50,50,.52);
}
.app-window-control .el-icon { font-size: 15px; }
.app-top-header__fallback { display: flex; align-items: center; gap: 8px; color: #777b76; }
.app-top-header__fallback strong { color: #c8cac5; font-size: 13px; font-weight: 620; }
.app-top-header__actions :deep(.el-button + .el-button) { margin-left: 0; }
.app-top-header__actions :deep(.el-button) { min-height: 38px; }
.app-top-header__actions :deep(.btn-settings) {
  --el-button-bg-color: rgba(255,255,255,.055);
  --el-button-border-color: rgba(255,255,255,.13);
  --el-button-text-color: #d7d7d2;
  --el-button-hover-bg-color: rgba(255,255,255,.11);
  --el-button-hover-border-color: rgba(255,255,255,.24);
  --el-button-hover-text-color: #eeeeea;
}
@media (max-width: 900px) {
  .app-top-header__inner { padding: 0 14px; }
  .app-top-header__brand { flex-basis: 126px; }
  .app-top-header__nav { --nav-item-width: 98px; }
  .app-top-header__nav-item { padding: 0 11px; }
}
@media (max-width: 620px) {
  .app-top-header { height: 62px; }
  .app-top-header__inner { padding: 0 10px; }
  .app-top-header__brand { flex-basis: 120px; }
  .app-top-header__nav { --nav-item-width: 90px; --nav-gap: 2px; --nav-pad: 3px; }
  .app-top-header__nav-item { height: 36px; padding: 0 8px; }
  .app-top-header__actions :deep(.el-button) { width: 38px !important; min-width: 38px !important; max-width: 38px !important; padding: 0 !important; overflow: hidden; }
  .app-top-header__actions :deep(.el-button > span) { gap: 0 !important; font-size: 0 !important; }
  .app-top-header__actions :deep(.el-button .el-icon) { margin: 0 !important; font-size: 15px !important; }
}
@media (max-width: 460px) {
  .app-top-header__brand { flex-basis: 116px; }
  .app-top-header__nav { --nav-item-width: 38px; }
  .app-top-header__nav-item { padding: 0; }
  .app-top-header__nav-item span { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .app-top-header__nav-item { transition: color var(--motion-fast) var(--motion-ease-out); }
  .app-top-header__nav-slider { transition: opacity var(--motion-fast) var(--motion-ease-out); }
  .app-top-header__content-enter { animation: none; transition: opacity var(--motion-fast) var(--motion-ease-out); }
}
</style>

<style>
.background-picker-popper.el-popper {
  padding: 0 !important;
  overflow: hidden;
  border-radius: 18px !important;
}
.background-picker {
  padding: 16px;
  color: #e7e7e7;
}
.background-picker__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 13px;
}
.background-picker__header strong { font-size: 14px; font-weight: 650; }
.background-picker__header p { margin: 3px 0 0; color: #858585; font-size: 11px; }
.background-picker__header .el-button { margin-top: -5px; }
.material-picker {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(235,235,235,.075);
}
.material-picker__label,
.background-picker__section-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.material-picker__label strong,
.background-picker__section-label strong { color: #d7d7d7; font-size: 12px; font-weight: 620; }
.material-picker__label small,
.background-picker__section-label small { color: #777; font-size: 10px; }
.material-picker__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}
.material-option {
  position: relative;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(235,235,235,.09);
  border-radius: 12px;
  color: inherit;
  background: rgba(235,235,235,.025);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--motion-fast) var(--motion-ease-out), background-color var(--motion-fast) var(--motion-ease-out), transform var(--motion-fast) var(--motion-ease-out);
}
.material-option:hover { border-color: rgba(235,235,235,.18); background: rgba(235,235,235,.045); }
@media (hover: hover) and (pointer: fine) { .material-option:hover { transform: translateY(-1px); } }
.material-option:active { transform: scale(.97); transition-duration: 100ms; }
.material-option.is-active { border-color: rgba(235,235,235,.26); background: rgba(235,235,235,.065); }
.material-option__sample {
  display: grid;
  grid-template-columns: 13px 1fr;
  grid-template-rows: 9px 1fr;
  gap: 3px;
  width: 54px;
  height: 38px;
  padding: 5px;
  overflow: hidden;
  border: 1px solid rgba(235,235,235,.11);
  border-radius: 8px;
  background: #101113;
}
.material-option__sample i { display: block; border-radius: 2px; background: rgba(235,235,235,.1); }
.material-option__sample i:first-child { grid-column: 1 / -1; }
.material-option__sample i:nth-child(2) { grid-row: 2; }
.material-option__sample i:nth-child(3) { grid-row: 2; }
.material-option__sample.is-glass { background: linear-gradient(135deg, rgba(105,125,140,.34), rgba(18,18,18,.7)); }
.material-option__sample.is-glass i { border: 1px solid rgba(235,235,235,.09); background: rgba(235,235,235,.075); box-shadow: inset 0 1px rgba(255,255,255,.08); }
.material-option__sample.is-simple { background: #0d0f12; }
.material-option__sample.is-simple i:first-child { background: #1a1c20; }
.material-option__sample.is-simple i:nth-child(2) { background: #15171a; }
.material-option__sample.is-simple i:nth-child(3) { background: #1b1d21; }
.material-option__copy { min-width: 0; }
.material-option__copy strong,
.material-option__copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.material-option__copy strong { font-size: 12px; font-weight: 620; }
.material-option__copy small { margin-top: 2px; color: #7f7f7f; font-size: 10px; }
.material-option__check { position: absolute; top: 7px; right: 7px; color: #dedede; font-size: 12px; }
.background-picker__options.is-paused { opacity: .48; }
.background-picker__options.is-paused .background-option { transform: none; cursor: default; }
.background-picker__options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.background-option {
  display: block;
  min-width: 0;
  padding: 7px;
  border: 1px solid rgba(235,235,235,.09);
  border-radius: 13px;
  color: inherit;
  background: rgba(235,235,235,.025);
  text-align: left;
  cursor: pointer;
  transition: transform var(--motion-fast) var(--motion-ease-out), border-color var(--motion-fast) var(--motion-ease-out), background-color var(--motion-fast) var(--motion-ease-out);
}
.background-option:hover {
  border-color: rgba(235,235,235,.18);
  background: rgba(235,235,235,.045);
}
@media (hover: hover) and (pointer: fine) { .background-option:hover { transform: translateY(-1px); } }
.background-option:active { transform: scale(.97); transition-duration: 100ms; }
.background-option.is-active {
  border-color: rgba(235,235,235,.28);
  background: rgba(235,235,235,.065);
}
.background-option__preview {
  position: relative;
  display: block;
  height: 72px;
  overflow: hidden;
  border-radius: 9px;
  background: #0b0e13;
}
.background-option__preview.is-ambient {
  background:
    radial-gradient(circle at 12% 0%, rgba(143,166,182,.72), transparent 45%),
    radial-gradient(circle at 90% 88%, rgba(30,68,99,.62), transparent 52%),
    linear-gradient(135deg,#111923,#070a0f);
}
.background-option__preview.is-silk {
  background:
    repeating-radial-gradient(ellipse at 15% 120%, transparent 0 12%, rgba(102,137,190,.22) 14% 18%, transparent 21% 29%),
    linear-gradient(140deg,#254878,#0b1b33 52%,#1b3663);
  background-size: 170% 190%, auto;
}
.background-option__preview.is-silk::after {
  content: "";
  position: absolute;
  inset: -40%;
  background: repeating-linear-gradient(128deg, transparent 0 13px, rgba(195,211,232,.09) 17px, transparent 24px);
  transform: rotate(-8deg);
}
.background-option__preview.is-rays {
  background:
    linear-gradient(136deg, rgba(234,179,8,.05) 12%, rgba(234,179,8,.58) 30%, transparent 47%),
    linear-gradient(150deg, rgba(150,200,255,.72) 18%, rgba(150,200,255,.12) 45%, transparent 61%),
    #070a0f;
}
.background-option__preview.is-rays::after {
  content: "";
  position: absolute;
  inset: -20%;
  background: repeating-linear-gradient(138deg, transparent 0 14px, rgba(228,235,238,.13) 18px, transparent 28px);
  filter: blur(5px);
  transform: rotate(4deg);
}
.background-option__check {
  position: absolute;
  z-index: 1;
  top: 7px;
  right: 7px;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid rgba(235,235,235,.28);
  border-radius: 99px;
  color: #ededed;
  background: rgba(8,8,8,.55);
  box-shadow: 0 4px 14px rgba(0,0,0,.28);
  backdrop-filter: blur(8px);
}
.background-option__copy { display: block; padding: 8px 2px 2px; }
.background-option__copy strong,
.background-option__copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.background-option__copy strong { font-size: 12px; font-weight: 620; }
.background-option__copy small { margin-top: 2px; color: #7f7f7f; font-size: 10px; }
.background-picker__controls {
  position: absolute;
  top: 14px;
  left: 0;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 14px;
  margin-top: 0;
  padding: 13px;
  border: 1px solid rgba(235,235,235,.075);
  border-radius: 12px;
  background: rgba(5,5,5,.19);
  opacity: 0;
  transform: translateY(-7px) scale(.992);
  transform-origin: 50% 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 180ms var(--motion-ease-out),
    transform var(--motion-standard) var(--motion-ease-out),
    visibility 0s linear var(--motion-standard);
}
.background-picker__controls-stage {
  position: relative;
  height: 276px;
  overflow: hidden;
}
.background-picker__controls.is-active {
  z-index: 1;
  opacity: 1;
  transform: translateY(0) scale(1);
  visibility: visible;
  pointer-events: auto;
  transition-delay: 0s, 0s, 0s;
}
.background-picker__controls--rays { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.background-control {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  min-width: 0;
  color: #a8a8a8;
  font-size: 11px;
}
.background-control output { color: #727272; font-variant-numeric: tabular-nums; }
.background-control .el-slider { grid-column: 1 / -1; height: 22px; }
.background-control .el-slider__runway { height: 3px; background: rgba(235,235,235,.09); }
.background-control .el-slider__bar { height: 3px; background: #bdbdbd; }
.background-control .el-slider__button {
  width: 12px;
  height: 12px;
  border: 2px solid #d2d2d2;
  background: #777;
}
.background-control--color {
  grid-column: 1 / -1;
  grid-template-columns: 1fr auto 28px;
  min-height: 30px;
}
.background-control--colors {
  grid-column: 1 / -1;
  grid-template-columns: 1fr auto;
  min-height: 32px;
}
.background-control--select { grid-template-columns: 1fr 88px; }
.background-control--select .el-select { width: 88px; }
.background-color-group { display: flex; gap: 7px; }
.background-color-group label { display: block; width: 30px; height: 28px; }
.background-color-group input[type="color"] {
  width: 30px;
  height: 28px;
  padding: 2px;
  border: 1px solid rgba(235,235,235,.16);
  border-radius: 8px;
  background: rgba(235,235,235,.04);
  cursor: pointer;
}
.background-color-value { margin-right: 8px; color: #818181; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.background-control input[type="color"] {
  width: 28px;
  height: 28px;
  padding: 2px;
  overflow: hidden;
  border: 1px solid rgba(235,235,235,.16);
  border-radius: 8px;
  background: rgba(235,235,235,.04);
  cursor: pointer;
}
@media (prefers-reduced-motion: reduce) {
  .background-option { transition: color var(--motion-fast) var(--motion-ease-out), border-color var(--motion-fast) var(--motion-ease-out); }
  .background-picker__controls { transform: none; transition: opacity var(--motion-fast) var(--motion-ease-out), visibility 0s linear var(--motion-fast); }
}
</style>
