import { reactive, ref, watch } from 'vue'

const BACKGROUND_KEY = 'cinegen-background-v1'
const RAYS_KEY = 'cinegen-background-rays-v2'
const MATERIAL_KEY = 'cinegen-material-v1'
const REDUCED_MOTION_KEY = 'cinegen-reduced-motion-v1'
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
    description: '静态冷色模糊色块',
  },
  {
    id: 'rays',
    name: '流光束',
    description: '光束明灭与位置流动',
  },
  {
    id: 'stardust',
    name: '星尘',
    description: '微粒与光斑纵深',
  },
])

const DEFAULT_RAYS = Object.freeze({
  c1: '#1e40af',
  c2: '#3b82f6',
  c3: '#60a5fa',
  c4: '#f59e0b',
  c5: '#22d3ee',
  c6: '#93c5fd',
})

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

function normalizeHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback
}

function buildRays(stored) {
  const s = stored && typeof stored === 'object' ? stored : {}
  return {
    c1: normalizeHex(s.c1, DEFAULT_RAYS.c1),
    c2: normalizeHex(s.c2, DEFAULT_RAYS.c2),
    c3: normalizeHex(s.c3, DEFAULT_RAYS.c3),
    c4: normalizeHex(s.c4, DEFAULT_RAYS.c4),
    c5: normalizeHex(s.c5, DEFAULT_RAYS.c5),
    c6: normalizeHex(s.c6, DEFAULT_RAYS.c6),
  }
}

const rawStoredBackground = readStorage(BACKGROUND_KEY, 'ambient')
const activeBackgroundId = ref(backgroundOptions.some(item => item.id === rawStoredBackground) ? rawStoredBackground : 'ambient')
const storedMaterial = readStorage(MATERIAL_KEY, 'glass')
const activeMaterialId = ref(!isWindowsDesktop && materialOptions.some(item => item.id === storedMaterial) ? storedMaterial : 'glass')
const storedRays = readStorage(RAYS_KEY, {})
const raysSettings = reactive(buildRays(storedRays))
const storedReducedMotion = readStorage(REDUCED_MOTION_KEY, false)
const activeReducedMotion = ref(Boolean(storedReducedMotion))

function appearanceSnapshot() {
  return {
    version: 3,
    materialId: activeMaterialId.value,
    backgroundId: activeBackgroundId.value,
    reducedMotion: activeReducedMotion.value,
    rays: { ...raysSettings },
  }
}

function applyAppearanceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false
  if (!isWindowsDesktop && materialOptions.some(item => item.id === snapshot.materialId)) {
    activeMaterialId.value = snapshot.materialId
  }
  if (backgroundOptions.some(item => item.id === snapshot.backgroundId)) activeBackgroundId.value = snapshot.backgroundId
  if (typeof snapshot.reducedMotion === 'boolean') activeReducedMotion.value = snapshot.reducedMotion
  Object.assign(raysSettings, buildRays(snapshot.rays))
  return true
}

function saveDesktopAppearance() {
  if (appearanceBridge?.save) void appearanceBridge.save(appearanceSnapshot())
}

let desktopAppearanceLoaded = !appearanceBridge?.load

function applyReducedMotion(value) {
  document.documentElement.style.setProperty('--sp', value ? '1.6' : '1')
}

watch(activeBackgroundId, value => {
  try { localStorage.setItem(BACKGROUND_KEY, JSON.stringify(value)) } catch (_) {}
  if (desktopAppearanceLoaded) saveDesktopAppearance()
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

watch(raysSettings, value => {
  try { localStorage.setItem(RAYS_KEY, JSON.stringify(value)) } catch (_) {}
  if (desktopAppearanceLoaded) saveDesktopAppearance()
}, { deep: true })

watch(activeReducedMotion, value => {
  applyReducedMotion(value)
  try { localStorage.setItem(REDUCED_MOTION_KEY, JSON.stringify(value)) } catch (_) {}
  if (desktopAppearanceLoaded) saveDesktopAppearance()
}, { immediate: true })

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

export function setAppReducedMotion(value) {
  activeReducedMotion.value = Boolean(value)
}

export function resetRaysColors() {
  Object.assign(raysSettings, DEFAULT_RAYS)
}

export function useAppBackground() {
  return {
    activeMaterialId,
    materialOptions,
    supportsMaterialMode: !isWindowsDesktop,
    activeBackgroundId,
    backgroundOptions,
    raysSettings,
    activeReducedMotion,
    setAppBackground,
    setAppMaterial,
    setAppReducedMotion,
    resetRaysColors,
  }
}
