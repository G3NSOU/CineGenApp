<template>
  <div class="rays-root" :style="colorVars">
    <div class="beams">
      <span class="beam r1"></span>
      <span class="beam r2"></span>
      <span class="beam r3"></span>
      <span class="beam r4"></span>
      <span class="beam r5"></span>
      <span class="beam r6"></span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  colors: { type: Object, required: true },
})

const colorVars = computed(() => ({
  '--c1': props.colors.c1,
  '--c2': props.colors.c2,
  '--c3': props.colors.c3,
  '--c4': props.colors.c4,
  '--c5': props.colors.c5,
  '--c6': props.colors.c6,
}))
</script>

<style scoped>
.rays-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: linear-gradient(160deg, #0a0e14, #070a0f 70%);
}
.beams {
  position: absolute;
  inset: -22%;
  transform: rotate(-17deg);
  transform-origin: 18% 0;
  animation: sway calc(34s * var(--sp, 1)) ease-in-out infinite;
}
@keyframes sway {
  0%, 100% { transform: rotate(-17deg); }
  50% { transform: rotate(-20.5deg); }
}
.beam {
  position: absolute;
  top: -16%;
  height: 132%;
  width: 16vw;
  max-width: 240px;
  filter: blur(26px);
  mix-blend-mode: screen;
  opacity: 0;
  will-change: opacity, transform;
  animation:
    fade calc(var(--f) * var(--sp, 1)) ease-in-out infinite var(--fd, 0s),
    drift calc(var(--dr) * var(--sp, 1)) ease-in-out infinite;
}
@keyframes fade {
  0%, 100% { opacity: 0; }
  50% { opacity: var(--o, .5); }
}
@keyframes drift {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(var(--m, 5vw)); }
}
.r1 { left: 8%; --f: 9s; --fd: 0s; --dr: 16s; --m: 5vw; background: linear-gradient(90deg, transparent, var(--c1), transparent); }
.r2 { left: 22%; --f: 11s; --fd: 1.2s; --dr: 18s; --m: -6vw; background: linear-gradient(90deg, transparent, var(--c2), transparent); }
.r3 { left: 40%; --f: 13s; --fd: .6s; --dr: 20s; --m: 7vw; background: linear-gradient(90deg, transparent, var(--c3), transparent); }
.r4 { left: 56%; --f: 15s; --fd: 2s; --dr: 22s; --m: -5vw; --o: .32; background: linear-gradient(90deg, transparent, var(--c4), transparent); }
.r5 { left: 72%; --f: 12s; --fd: 3s; --dr: 17s; --m: 6vw; background: linear-gradient(90deg, transparent, var(--c5), transparent); }
.r6 { left: 88%; --f: 10s; --fd: 1.6s; --dr: 19s; --m: -7vw; background: linear-gradient(90deg, transparent, var(--c6), transparent); }
@media (prefers-reduced-motion: reduce) {
  .beams, .beam { animation: none; }
  .beam { opacity: .35; }
}
</style>
