<template>
  <div class="silk-background" :style="{ backgroundColor: color }">
    <canvas ref="canvasRef" :class="{ 'is-ready': ready }" aria-hidden="true" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

// Original CineGen canvas renderer. Broad layered Bézier ribbons create a
// fabric-like field without redistributing any third-party component source.
const props = defineProps({
  speed: { type: Number, default: 5 },
  scale: { type: Number, default: 1 },
  color: { type: String, default: '#7B7481' },
  noiseIntensity: { type: Number, default: 1.5 },
  rotation: { type: Number, default: 0 },
})

const canvasRef = ref(null)
const ready = ref(false)
let context = null
let resizeObserver = null
let reducedMotion = null
let frame = 0
let running = false
let startTime = 0
let lastDraw = 0

function parseColor(value) {
  const safe = /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).slice(1) : '7b7481'
  return [0, 2, 4].map(offset => parseInt(safe.slice(offset, offset + 2), 16))
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

function tone(rgb, amount) {
  return rgb.map(channel => Math.max(0, Math.min(255, Math.round(channel + amount))))
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas || !context) return
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const width = Math.max(1, Math.round(canvas.clientWidth * dpr))
  const height = Math.max(1, Math.round(canvas.clientHeight * dpr))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
}

function drawRibbon(width, height, index, time, rgb) {
  const count = 8
  const spacing = height / (count - 1)
  const scale = Math.max(0.35, Number(props.scale) || 1)
  const phase = time * (0.11 + index * 0.006) + index * 0.83
  const base = -height * 0.18 + index * spacing * 1.18
  const amplitude = height * (0.08 + 0.018 * Math.sin(index * 1.7)) / scale
  const leftY = base + Math.sin(phase) * amplitude
  const middleY = base + Math.sin(phase + 1.35) * amplitude * 1.45
  const rightY = base + Math.sin(phase + 2.6) * amplitude
  const bright = tone(rgb, 54 - index * 4)
  const dark = tone(rgb, -44 + index * 3)
  const gradient = context.createLinearGradient(-width * 0.2, leftY, width * 1.2, rightY)
  gradient.addColorStop(0, rgba(dark, 0.22))
  gradient.addColorStop(0.38, rgba(bright, 0.52))
  gradient.addColorStop(0.62, rgba(rgb, 0.28))
  gradient.addColorStop(1, rgba(dark, 0.18))

  context.beginPath()
  context.moveTo(-width * 0.25, leftY)
  context.bezierCurveTo(width * 0.12, leftY - amplitude, width * 0.32, middleY, width * 0.54, middleY)
  context.bezierCurveTo(width * 0.76, middleY, width * 0.91, rightY + amplitude, width * 1.25, rightY)
  context.lineWidth = Math.max(54, spacing * (1.45 + 0.12 * Math.cos(index)))
  context.lineCap = 'round'
  context.strokeStyle = gradient
  context.shadowColor = rgba(bright, 0.14)
  context.shadowBlur = Math.max(18, height * 0.035)
  context.stroke()
}

function draw(now = 0) {
  const canvas = canvasRef.value
  if (!canvas || !context) return
  const width = canvas.width
  const height = canvas.height
  const rgb = parseColor(props.color)
  const speed = Math.max(0, Number(props.speed) || 0)
  const time = speed === 0 ? 0 : ((now - startTime) / 1000) * speed * 0.18

  context.save()
  context.clearRect(0, 0, width, height)
  context.fillStyle = rgba(tone(rgb, -58), 1)
  context.fillRect(0, 0, width, height)
  context.translate(width / 2, height / 2)
  context.rotate((Number(props.rotation) || 0) - Math.PI / 2)
  const diagonal = Math.hypot(width, height)
  context.translate(-diagonal / 2, -diagonal / 2)
  for (let index = 0; index < 8; index += 1) drawRibbon(diagonal, diagonal, index, time, rgb)
  context.restore()

  const grain = Math.max(0, Math.min(4, Number(props.noiseIntensity) || 0))
  if (grain > 0) {
    context.save()
    context.globalAlpha = grain * 0.018
    context.fillStyle = '#ffffff'
    const step = Math.max(14, Math.round(24 / Math.max(grain, 0.5)))
    for (let y = 0; y < height; y += step) {
      for (let x = ((y / step) % 2) * step; x < width; x += step * 2) context.fillRect(x, y, 1, 1)
    }
    context.restore()
  }
}

function animate(now) {
  if (!running) return
  if (!lastDraw || now - lastDraw >= 32) {
    draw(now)
    lastDraw = now
  }
  frame = requestAnimationFrame(animate)
}

function stop() {
  running = false
  cancelAnimationFrame(frame)
  frame = 0
}

function start() {
  stop()
  if (document.hidden || reducedMotion?.matches || Number(props.speed) === 0) {
    draw(performance.now())
    return
  }
  running = true
  lastDraw = 0
  frame = requestAnimationFrame(animate)
}

function handleVisibility() {
  if (document.hidden) stop()
  else start()
}

function init() {
  const canvas = canvasRef.value
  context = canvas?.getContext('2d', { alpha: false })
  if (!context) return
  startTime = performance.now()
  resizeObserver = new ResizeObserver(() => {
    resize()
    draw(performance.now())
  })
  resizeObserver.observe(canvas)
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.addEventListener?.('change', start)
  document.addEventListener('visibilitychange', handleVisibility)
  resize()
  ready.value = true
  start()
}

watch(() => [props.speed, props.scale, props.color, props.noiseIntensity, props.rotation], () => {
  startTime = performance.now()
  start()
})

onMounted(init)
onBeforeUnmount(() => {
  stop()
  resizeObserver?.disconnect()
  reducedMotion?.removeEventListener?.('change', start)
  document.removeEventListener('visibilitychange', handleVisibility)
})
</script>

<style scoped>
.silk-background,
.silk-background canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.silk-background canvas {
  display: block;
  opacity: 0;
  transition: opacity 500ms var(--motion-ease-out);
}
.silk-background canvas.is-ready { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .silk-background canvas { transition-duration: 200ms; }
}
</style>
