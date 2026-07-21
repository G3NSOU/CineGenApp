<template>
  <div class="version-info">
    <div class="version-info__head">
      <div>
        <div class="version-info__label">当前版本</div>
        <div class="version-info__version">v{{ version }}</div>
      </div>
      <span class="version-info__badge">Build {{ version }}</span>
    </div>
    <div class="version-info__changelog">
      <div v-if="loading" class="version-info__state">加载更新日志…</div>
      <div v-else-if="error" class="version-info__state">更新日志加载失败</div>
      <template v-else>
        <div v-for="(b, i) in blocks" :key="i" :class="'cl-' + b.type">{{ b.text }}</div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import pkg from '../../package.json'

const version = ref(pkg.version)
const raw = ref('')
const loading = ref(true)
const error = ref(false)

onMounted(async () => {
  // 从后端获取实际运行版本（反映 config.app.version，比前端打包版本更准确）
  try {
    const hr = await fetch('/health')
    if (hr.ok) {
      const hd = await hr.json()
      if (hd && hd.version) version.value = hd.version
    }
  } catch (_) {}
  try {
    const res = await fetch('/CHANGELOG.md')
    if (!res.ok) throw new Error('http')
    raw.value = await res.text()
  } catch (_) {
    error.value = true
  } finally {
    loading.value = false
  }
})

const blocks = computed(() => {
  const out = []
  for (const line of raw.value.split('\n')) {
    if (line.includes('img.shields.io') || /^\[!\[/.test(line)) continue
    if (line.trim() === '---' || line.trim() === '') continue
    if (line.startsWith('## ')) out.push({ type: 'h2', text: line.slice(3).trim() })
    else if (line.startsWith('### ')) out.push({ type: 'h3', text: line.slice(4).trim() })
    else if (line.startsWith('- ')) out.push({ type: 'li', text: line.slice(2).trim() })
    else out.push({ type: 'p', text: line.trim() })
  }
  return out
})
</script>

<style scoped>
.version-info { color: var(--cgp-text); }
.version-info__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--cgp-border);
}
.version-info__label { font-size: 12px; color: var(--cgp-text-subtle); margin-bottom: 4px; }
.version-info__version { font-size: 26px; font-weight: 700; letter-spacing: .3px; }
.version-info__badge {
  padding: 5px 12px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 600;
  color: var(--cgp-accent-strong);
  background: var(--cgp-accent-soft);
  border: 1px solid var(--cgp-border-bright);
}
.version-info__changelog { max-height: 58vh; overflow: auto; scrollbar-gutter: stable; padding-right: 6px; }
.version-info__state { color: var(--cgp-text-subtle); font-size: 13px; padding: 12px 0; }
.cl-h2 { font-size: 15px; font-weight: 700; margin: 18px 0 8px; color: var(--cgp-accent-strong); }
.cl-h2:first-child { margin-top: 0; }
.cl-h3 { font-size: 13px; font-weight: 650; margin: 12px 0 6px; color: var(--cgp-text); }
.cl-li { position: relative; padding-left: 16px; margin: 4px 0; font-size: 13px; line-height: 1.6; color: var(--cgp-text-muted); }
.cl-li::before { content: ""; position: absolute; left: 2px; top: 9px; width: 5px; height: 5px; border-radius: 50%; background: var(--cgp-text-subtle); }
.cl-p { font-size: 13px; color: var(--cgp-text-muted); margin: 6px 0; line-height: 1.6; }
</style>
