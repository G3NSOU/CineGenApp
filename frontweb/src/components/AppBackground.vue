<template>
  <div class="app-background" aria-hidden="true">
    <Transition name="background-crossfade">
      <div v-if="activeMaterialId === 'simple'" key="simple" class="app-background__layer app-background__simple" />
      <div v-else-if="activeBackgroundId === 'ambient'" key="ambient" class="app-background__layer app-background__ambient" />
      <SilkBackground
        v-else-if="activeBackgroundId === 'silk'"
        key="silk"
        class="app-background__layer"
        :speed="silkSettings.speed"
        :scale="silkSettings.scale"
        :color="silkSettings.color"
        :noise-intensity="silkSettings.noiseIntensity"
        :rotation="silkSettings.rotation"
      />
      <SideRaysBackground
        v-else
        key="rays"
        class="app-background__layer"
        :speed="raysSettings.speed"
        :ray-color1="raysSettings.rayColor1"
        :ray-color2="raysSettings.rayColor2"
        :intensity="raysSettings.intensity"
        :spread="raysSettings.spread"
        :origin="raysSettings.origin"
        :tilt="raysSettings.tilt"
        :saturation="raysSettings.saturation"
        :blend="raysSettings.blend"
        :falloff="raysSettings.falloff"
        :opacity="raysSettings.opacity"
      />
    </Transition>
    <div class="app-background__veil" />
  </div>
</template>

<script setup>
import SilkBackground from '@/components/SilkBackground.vue'
import SideRaysBackground from '@/components/SideRaysBackground.vue'
import { useAppBackground } from '@/composables/useAppBackground'

const { activeMaterialId, activeBackgroundId, silkSettings, raysSettings } = useAppBackground()
</script>

<style scoped>
.app-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  background: #070a0f;
}
.app-background__layer {
  position: absolute;
  inset: 0;
}
.app-background__simple {
  background: #0d0f12;
}
.app-background__ambient {
  background:
    radial-gradient(78rem 34rem at 8% -5%, rgba(143, 166, 182, .44), transparent 63%),
    radial-gradient(60rem 31rem at 88% 14%, rgba(54, 75, 94, .34), transparent 68%),
    radial-gradient(70rem 28rem at 34% 78%, rgba(91, 115, 134, .25), transparent 66%),
    radial-gradient(54rem 30rem at 96% 92%, rgba(27, 54, 82, .30), transparent 68%),
    linear-gradient(132deg, #101721 0%, #090d13 37%, #111923 59%, #070a0f 100%);
}
.app-background__ambient::after {
  content: "";
  position: absolute;
  inset: -6%;
  opacity: .72;
  background:
    linear-gradient(153deg, transparent 7%, rgba(181, 197, 208, .10) 19%, transparent 31%),
    linear-gradient(141deg, transparent 42%, rgba(71, 98, 119, .13) 54%, transparent 69%),
    linear-gradient(rgba(226, 235, 241, .011) 1px, transparent 1px),
    linear-gradient(90deg, rgba(226, 235, 241, .011) 1px, transparent 1px);
  background-size: auto, auto, 52px 52px, 52px 52px;
  filter: blur(24px);
  mask-image: linear-gradient(to bottom, black, rgba(0,0,0,.72) 72%, transparent);
}
.app-background__veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 30%, transparent 16%, rgba(3, 4, 6, .08) 72%, rgba(3, 4, 6, .25) 100%),
    linear-gradient(to bottom, rgba(3, 4, 6, .03), rgba(3, 4, 6, .14));
}
.background-crossfade-enter-active,
.background-crossfade-leave-active { transition: opacity 520ms var(--motion-ease-out); }
.background-crossfade-enter-from,
.background-crossfade-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .background-crossfade-enter-active,
  .background-crossfade-leave-active { transition: opacity 200ms var(--motion-ease-out); }
}
</style>
