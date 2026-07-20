import { reactive, ref, watch } from 'vue'

const BACKGROUND_KEY = 'cinegen-background-v1'
const SILK_KEY = 'cinegen-background-silk-v1'
const RAYS_KEY = 'cinegen-background-rays-v1'
const MATERIAL_KEY = 'cinegen-material-v1'
const appearanceBridge = typeof window !== 'undefined' ? window.cinegenAppearance : null
// ES modules run before main.js marks the document shell, so preload is the
// authoritative early platform signal. Keep this mode out of Windows builds.
const isWindowsDesktop = typeof window !== 'undefined' && window.cinegenWindow?.platform === 'win32'

export const materialOptions = Object.freeze([
  {
    id: 'glass',
    name: 'Liquid Glass',
    description: '完整玻璃材质与动态背景',
  },
  {
    id: 'simple',
    name: '简约模式',
    description: '实体深色材质，适合较低配置',
  },
])

export const backgroundOptions = Object.freeze([
  {
    id: 'ambient',
    name: '雾蓝织光',
    description: '当前的静态模糊色块',
  },
  {
    id: 'silk',
    name: '流光绸缎',
    description: 'CineGen 原创 Canvas 流动背景',
  },
  {
    id: 'rays',
    name: '侧光场',
    description: 'CineGen 原创低负载动态光束',
  },
])

const DEFAULT_SILK = Object.freeze({
  speed: 5,
  scale: 0.8,
  color: '#1b3663',
  noiseIntensity: 0,
  rotation: 1.57,
})

const DEFAULT_RAYS = Object.freeze({
  speed: 2.5,
  rayColor1: '#eab308',
  rayColor2: '#96c8ff',
  intensity: 2,
  spread: 2,
  origin: 'top-left',
  tilt: 0,
  saturation: 1.5,
  blend: 0.75,
  falloff: 1.6,
  opacity: 0.86,
})

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function normalizeHex(value, fallback = DEFAULT_SILK.color) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback
}

const rawStoredBackground = readStorage(BACKGROUND_KEY, 'ambient')
const storedBackground = rawStoredBackground === 'liquid' ? 'rays' : rawStoredBackground
const activeBackgroundId = ref(backgroundOptions.some(item => item.id === storedBackground) ? storedBackground : 'ambient')
const storedMaterial = readStorage(MATERIAL_KEY, 'glass')
const activeMaterialId = ref(!isWindowsDesktop && materialOptions.some(item => item.id === storedMaterial) ? storedMaterial : 'glass')
const storedSilk = readStorage(SILK_KEY, {})
const silkSettings = reactive({
  speed: clampNumber(storedSilk.speed, 0, 12, DEFAULT_SILK.speed),
  scale: clampNumber(storedSilk.scale, 0.35, 2, DEFAULT_SILK.scale),
  color: normalizeHex(storedSilk.color),
  noiseIntensity: clampNumber(storedSilk.noiseIntensity, 0, 4, DEFAULT_SILK.noiseIntensity),
  rotation: clampNumber(storedSilk.rotation, 0, 6.28, DEFAULT_SILK.rotation),
})
const storedRays = readStorage(RAYS_KEY, {})
const origins = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
const raysSettings = reactive({
  speed: clampNumber(storedRays.speed, 0, 8, DEFAULT_RAYS.speed),
  rayColor1: normalizeHex(storedRays.rayColor1, DEFAULT_RAYS.rayColor1),
  rayColor2: normalizeHex(storedRays.rayColor2, DEFAULT_RAYS.rayColor2),
  intensity: clampNumber(storedRays.intensity, 0.2, 4, DEFAULT_RAYS.intensity),
  spread: clampNumber(storedRays.spread, 0.2, 4, DEFAULT_RAYS.spread),
  origin: origins.includes(storedRays.origin) ? storedRays.origin : DEFAULT_RAYS.origin,
  tilt: clampNumber(storedRays.tilt, -90, 90, DEFAULT_RAYS.tilt),
  saturation: clampNumber(storedRays.saturation, 0, 3, DEFAULT_RAYS.saturation),
  blend: clampNumber(storedRays.blend, 0, 1, DEFAULT_RAYS.blend),
  falloff: clampNumber(storedRays.falloff, 0.5, 4, DEFAULT_RAYS.falloff),
  opacity: clampNumber(storedRays.opacity, 0.1, 1, DEFAULT_RAYS.opacity),
})

function appearanceSnapshot() {
  return {
    version: 2,
    materialId: activeMaterialId.value,
    backgroundId: activeBackgroundId.value,
    silk: { ...silkSettings },
    rays: { ...raysSettings },
  }
}

function applyAppearanceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false
  if (!isWindowsDesktop && materialOptions.some(item => item.id === snapshot.materialId)) {
    activeMaterialId.value = snapshot.materialId
  }
  const backgroundId = snapshot.backgroundId === 'liquid' ? 'rays' : snapshot.backgroundId
  if (backgroundOptions.some(item => item.id === backgroundId)) activeBackgroundId.value = backgroundId

  const savedSilk = snapshot.silk && typeof snapshot.silk === 'object' ? snapshot.silk : {}
  Object.assign(silkSettings, {
    speed: clampNumber(savedSilk.speed, 0, 12, silkSettings.speed),
    scale: clampNumber(savedSilk.scale, 0.35, 2, silkSettings.scale),
    color: normalizeHex(savedSilk.color, silkSettings.color),
    noiseIntensity: clampNumber(savedSilk.noiseIntensity, 0, 4, silkSettings.noiseIntensity),
    rotation: clampNumber(savedSilk.rotation, 0, 6.28, silkSettings.rotation),
  })

  const savedRays = snapshot.rays && typeof snapshot.rays === 'object' ? snapshot.rays : {}
  Object.assign(raysSettings, {
    speed: clampNumber(savedRays.speed, 0, 8, raysSettings.speed),
    rayColor1: normalizeHex(savedRays.rayColor1, raysSettings.rayColor1),
    rayColor2: normalizeHex(savedRays.rayColor2, raysSettings.rayColor2),
    intensity: clampNumber(savedRays.intensity, 0.2, 4, raysSettings.intensity),
    spread: clampNumber(savedRays.spread, 0.2, 4, raysSettings.spread),
    origin: origins.includes(savedRays.origin) ? savedRays.origin : raysSettings.origin,
    tilt: clampNumber(savedRays.tilt, -90, 90, raysSettings.tilt),
    saturation: clampNumber(savedRays.saturation, 0, 3, raysSettings.saturation),
    blend: clampNumber(savedRays.blend, 0, 1, raysSettings.blend),
    falloff: clampNumber(savedRays.falloff, 0.5, 4, raysSettings.falloff),
    opacity: clampNumber(savedRays.opacity, 0.1, 1, raysSettings.opacity),
  })
  return true
}

function saveDesktopAppearance() {
  if (appearanceBridge?.save) void appearanceBridge.save(appearanceSnapshot())
}

let settingsSaveTimer = 0
let desktopAppearanceLoaded = !appearanceBridge?.load
function scheduleDesktopSettingsSave() {
  if (!appearanceBridge?.save) return
  window.clearTimeout(settingsSaveTimer)
  settingsSaveTimer = window.setTimeout(saveDesktopAppearance, 100)
}

watch(activeBackgroundId, value => {
  try { localStorage.setItem(BACKGROUND_KEY, JSON.stringify(value)) } catch (_) {}
  saveDesktopAppearance()
})

watch(activeMaterialId, value => {
  const materialId = !isWindowsDesktop && materialOptions.some(item => item.id === value) ? value : 'glass'
  if (activeMaterialId.value !== materialId) {
    activeMaterialId.value = materialId
    return
  }
  document.documentElement.classList.toggle('cinegen-simple', materialId === 'simple')
  try { localStorage.setItem(MATERIAL_KEY, JSON.stringify(materialId)) } catch (_) {}
  if (desktopAppearanceLoaded) saveDesktopAppearance()
}, { immediate: true })

watch(silkSettings, value => {
  try { localStorage.setItem(SILK_KEY, JSON.stringify(value)) } catch (_) {}
  scheduleDesktopSettingsSave()
}, { deep: true })

watch(raysSettings, value => {
  try { localStorage.setItem(RAYS_KEY, JSON.stringify(value)) } catch (_) {}
  scheduleDesktopSettingsSave()
}, { deep: true })

if (appearanceBridge?.load) {
  void appearanceBridge.load()
    .then(snapshot => {
      if (!applyAppearanceSnapshot(snapshot)) saveDesktopAppearance()
    })
    .catch(() => {})
    .finally(() => { desktopAppearanceLoaded = true })
}

export function setAppBackground(id) {
  if (backgroundOptions.some(item => item.id === id)) activeBackgroundId.value = id
}

export function setAppMaterial(id) {
  if (!isWindowsDesktop && materialOptions.some(item => item.id === id)) activeMaterialId.value = id
}

export function resetSilkSettings() {
  Object.assign(silkSettings, DEFAULT_SILK)
}

export function resetRaysSettings() {
  Object.assign(raysSettings, DEFAULT_RAYS)
}

export function useAppBackground() {
  return {
    activeMaterialId,
    materialOptions,
    supportsMaterialMode: !isWindowsDesktop,
    activeBackgroundId,
    backgroundOptions,
    silkSettings,
    raysSettings,
    setAppBackground,
    setAppMaterial,
    resetSilkSettings,
    resetRaysSettings,
  }
}
