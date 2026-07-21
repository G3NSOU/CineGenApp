<template>
  <canvas ref="canvas" class="stardust-canvas"></canvas>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  reducedMotion: { type: Boolean, default: false },
})

const canvas = ref(null)
const DPR = Math.min(window.devicePixelRatio || 1, 2)
let ctx = null
let rafId = null
let last = 0
let W = 0
let H = 0
let dust = []
let bokeh = []
let sprite = null
let spriteBig = null

function makeSprite(r, hue) {
  const s = Math.ceil(r * 2)
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(r, r, 0, r, r, r)
  grd.addColorStop(0, 'hsla(' + hue + ',85%,82%,1)')
  grd.addColorStop(0.4, 'hsla(' + hue + ',85%,72%,.5)')
  grd.addColorStop(1, 'transparent')
  g.fillStyle = grd
  g.beginPath()
  g.arc(r, r, r, 0, 7)
  g.fill()
  return c
}

function resize() {
  const el = canvas.value
  if (!el) return
  const w = el.clientWidth || window.innerWidth
  const h = el.clientHeight || window.innerHeight
  W = el.width = Math.floor(w * DPR)
  H = el.height = Math.floor(h * DPR)
}

function init() {
  sprite = makeSprite(8 * DPR, 205)
  spriteBig = makeSprite(46 * DPR, 200)
  dust = []
  for (let i = 0; i < 150; i++) {
    dust.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: (Math.random() * 1.6 + 0.5) * DPR,
      vy: -(Math.random() * 0.12 + 0.04) * DPR,
      vx: (Math.random() - 0.5) * 0.08 * DPR,
      ph: Math.random() * 6.28,
      tw: Math.random() * 0.025 + 0.006,
      a: Math.random() * 0.5 + 0.35,
    })
  }
  bokeh = []
  for (let i = 0; i < 6; i++) {
    bokeh.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: (Math.random() * 40 + 30) * DPR,
      vy: -(Math.random() * 0.05 + 0.02) * DPR,
      vx: (Math.random() - 0.5) * 0.04 * DPR,
      ph: Math.random() * 6.28,
      a: Math.random() * 0.08 + 0.05,
    })
  }
}

function draw(now) {
  rafId = requestAnimationFrame(draw)
  if (now - last < (props.reducedMotion ? 1000 / 30 : 0)) return
  last = now
  ctx.clearRect(0, 0, W, H)
  for (const b of bokeh) {
    b.x += b.vx
    b.y += b.vy
    b.ph += 0.004
    if (b.y < -b.r) b.y = H + b.r
    if (b.x < -b.r) b.x = W + b.r
    if (b.x > W + b.r) b.x = -b.r
    ctx.globalAlpha = b.a * (Math.sin(b.ph) * 0.4 + 0.7)
    ctx.drawImage(spriteBig, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2)
  }
  for (const p of dust) {
    p.x += p.vx
    p.y += p.vy
    p.ph += p.tw
    if (p.y < -6) p.y = H + 6
    if (p.x < -6) p.x = W + 6
    if (p.x > W + 6) p.x = -6
    const tw = Math.sin(p.ph) * 0.5 + 0.5
    ctx.globalAlpha = p.a * tw
    const s = p.r * 4
    ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s)
  }
  ctx.globalAlpha = 1
}

function onResize() {
  resize()
  init()
}

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  resize()
  init()
  draw(performance.now())
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.stardust-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  background: radial-gradient(80rem 50rem at 50% 120%, rgba(14, 30, 58, .5), transparent 60%), #05070b;
}
</style>
