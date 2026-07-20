<template>
  <div class="side-rays-background" :class="[`origin-${origin}`, { 'is-ready': ready }]" :style="styleVars">
    <div class="ray-field">
      <span class="ray ray-a" />
      <span class="ray ray-b" />
      <span class="ray ray-c" />
    </div>
    <div class="source-glow" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

// Original CineGen CSS light-field renderer. Layered gradients move as broad
// surfaces, keeping GPU cost predictable and avoiding third-party shader code.
const props = defineProps({
  speed: { type: Number, default: 2.5 },
  rayColor1: { type: String, default: '#eab308' },
  rayColor2: { type: String, default: '#96c8ff' },
  intensity: { type: Number, default: 2 },
  spread: { type: Number, default: 2 },
  origin: { type: String, default: 'top-left' },
  tilt: { type: Number, default: 0 },
  saturation: { type: Number, default: 1.5 },
  blend: { type: Number, default: 0.75 },
  falloff: { type: Number, default: 1.6 },
  opacity: { type: Number, default: 1 },
})

const ready = ref(false)
const styleVars = computed(() => {
  const speed = Math.max(0, Number(props.speed) || 0)
  const duration = speed === 0 ? 100000 : Math.max(8, 42 / speed)
  const intensity = Math.max(0.08, Math.min(1, Number(props.intensity) * 0.24))
  const blend = Math.max(0, Math.min(1, Number(props.blend) || 0))
  const opacity = Math.max(0.1, Math.min(1, Number(props.opacity) || 1))
  return {
    '--ray-color-a': props.rayColor1,
    '--ray-color-b': props.rayColor2,
    '--ray-duration': `${duration}s`,
    '--ray-spread': Math.max(0.65, Math.min(1.8, Number(props.spread) * 0.48)),
    '--ray-tilt': `${Number(props.tilt) || 0}deg`,
    '--ray-saturation': Math.max(0, Number(props.saturation) || 0),
    '--ray-blur': `${Math.max(28, Math.min(110, Number(props.falloff) * 28))}px`,
    '--ray-opacity': opacity,
    '--ray-opacity-a': opacity * intensity * (1 - blend * 0.42),
    '--ray-opacity-b': opacity * intensity * (0.45 + blend * 0.55),
    '--ray-opacity-c': opacity * intensity * 0.38,
  }
})

onMounted(() => requestAnimationFrame(() => { ready.value = true }))
</script>

<style scoped>
.side-rays-background {
  position: absolute;
  inset: 0;
  overflow: hidden;
  opacity: 0;
  background: #070a0f;
  transition: opacity 480ms var(--motion-ease-out);
  isolation: isolate;
}
.side-rays-background.is-ready { opacity: 1; }
.ray-field {
  position: absolute;
  inset: -32%;
  transform: rotate(var(--ray-tilt));
  transform-origin: 18% 18%;
  filter: saturate(var(--ray-saturation));
}
.origin-top-right .ray-field { transform: scaleX(-1) rotate(var(--ray-tilt)); }
.origin-bottom-left .ray-field { transform: scaleY(-1) rotate(var(--ray-tilt)); }
.origin-bottom-right .ray-field { transform: scale(-1) rotate(var(--ray-tilt)); }
.ray {
  position: absolute;
  left: -12%;
  top: -20%;
  width: 128%;
  height: 92%;
  transform-origin: 0 0;
  clip-path: polygon(0 0, 100% 12%, 72% 100%, 0 48%);
  filter: blur(var(--ray-blur));
  mix-blend-mode: screen;
  will-change: transform, opacity;
}
.ray-a {
  opacity: var(--ray-opacity-a);
  background: linear-gradient(116deg, var(--ray-color-a), transparent 68%);
  transform: rotate(8deg) scaleY(var(--ray-spread));
  animation: ray-drift-a var(--ray-duration) ease-in-out infinite alternate;
}
.ray-b {
  opacity: var(--ray-opacity-b);
  background: linear-gradient(129deg, var(--ray-color-b), transparent 72%);
  transform: rotate(24deg) scaleY(calc(var(--ray-spread) * .82));
  animation: ray-drift-b calc(var(--ray-duration) * 1.18) ease-in-out infinite alternate;
}
.ray-c {
  opacity: var(--ray-opacity-c);
  background: linear-gradient(104deg, color-mix(in srgb, var(--ray-color-a) 45%, var(--ray-color-b)), transparent 74%);
  transform: rotate(39deg) scaleY(calc(var(--ray-spread) * .58));
  animation: ray-drift-c calc(var(--ray-duration) * .86) ease-in-out infinite alternate;
}
.source-glow {
  position: absolute;
  left: -16%;
  top: -24%;
  width: 62%;
  height: 62%;
  border-radius: 50%;
  opacity: var(--ray-opacity);
  background: radial-gradient(circle, color-mix(in srgb, var(--ray-color-a) 48%, var(--ray-color-b)), transparent 70%);
  filter: blur(calc(var(--ray-blur) * .72));
  mix-blend-mode: screen;
}
.origin-top-right .source-glow { left: auto; right: -16%; }
.origin-bottom-left .source-glow { top: auto; bottom: -24%; }
.origin-bottom-right .source-glow { left: auto; right: -16%; top: auto; bottom: -24%; }

@keyframes ray-drift-a {
  from { transform: rotate(5deg) translate3d(-2%, -2%, 0) scaleY(var(--ray-spread)); }
  to { transform: rotate(13deg) translate3d(5%, 4%, 0) scaleY(calc(var(--ray-spread) * 1.08)); }
}
@keyframes ray-drift-b {
  from { transform: rotate(27deg) translate3d(-1%, 2%, 0) scaleY(calc(var(--ray-spread) * .82)); }
  to { transform: rotate(19deg) translate3d(6%, -3%, 0) scaleY(calc(var(--ray-spread) * .94)); }
}
@keyframes ray-drift-c {
  from { transform: rotate(35deg) translate3d(1%, -2%, 0) scaleY(calc(var(--ray-spread) * .58)); }
  to { transform: rotate(44deg) translate3d(7%, 5%, 0) scaleY(calc(var(--ray-spread) * .68)); }
}
@media (prefers-reduced-motion: reduce) {
  .side-rays-background { transition-duration: 200ms; }
  .ray { animation: none; }
}
</style>
