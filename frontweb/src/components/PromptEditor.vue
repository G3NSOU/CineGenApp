<template>
  <div class="prompt-editor-page">
    <div v-if="loading" v-loading="true" class="loading-wrap" />
    <template v-else>
      <div class="editor-layout">
        <!-- 左侧菜单 -->
        <div class="left-sidebar">
          <div class="sidebar-menu">
            <div
              v-for="p in prompts"
              :key="p.key"
              :class="['menu-item', { active: currentKey === p.key }]"
              @click="selectPrompt(p.key)"
            >
              <div class="menu-item-content">
                <span class="menu-label">{{ p.label }}</span>
                <el-tag
                  v-if="p.is_customized"
                  type="warning"
                  size="small"
                  class="menu-tag"
                >已自定义</el-tag>
                <el-tag v-else type="info" size="small" class="menu-tag">默认</el-tag>
              </div>
              <div v-if="isDirty[p.key]" class="dirty-indicator" />
            </div>
          </div>
        </div>

        <!-- 右侧编辑区 -->
        <div class="right-content">
          <p class="page-desc">
            可自定义 AI 生成各阶段使用的提示词（System Prompt）。锁定区域为 JSON
            格式要求，不可修改以确保输出格式正确。
          </p>

          <div v-if="currentPrompt" class="prompt-card">
            <div class="prompt-card-header">
              <div class="prompt-card-meta">
                <span class="prompt-label">{{ currentPrompt.label }}</span>
                <el-tag
                  v-if="currentPrompt.is_customized"
                  type="warning"
                  size="small"
                  class="custom-tag"
                >已自定义</el-tag>
                <el-tag v-else type="info" size="small" class="custom-tag">使用默认</el-tag>
              </div>
              <p class="prompt-desc">{{ currentPrompt.description }}</p>
            </div>

            <div class="prompt-edit-section">
              <div class="section-label">
                <el-icon class="section-icon"><Edit /></el-icon>
                <span>指令内容（可编辑）</span>
              </div>
              <el-input
                v-model="editState[currentPrompt.key]"
                type="textarea"
                :rows="16"
                :placeholder="currentPrompt.default_body"
                class="prompt-textarea"
                @input="markDirty(currentPrompt.key)"
              />
            </div>

            <div v-if="currentPrompt.locked_suffix" class="prompt-locked-section">
              <div class="section-label section-label--locked">
                <el-icon class="section-icon"><Lock /></el-icon>
                <span>JSON 格式要求（锁定，不可修改）</span>
              </div>
              <div class="locked-content">{{ currentPrompt.locked_suffix }}</div>
            </div>

            <div class="prompt-actions">
              <el-button
                type="primary"
                size="small"
                :loading="savingKey === currentPrompt.key"
                :disabled="!isDirty[currentPrompt.key]"
                @click="save(currentPrompt)"
              >
                保存
              </el-button>
              <el-button
                size="small"
                :loading="resettingKey === currentPrompt.key"
                :disabled="!currentPrompt.is_customized && !isDirty[currentPrompt.key]"
                @click="reset(currentPrompt)"
              >
                恢复默认
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Lock } from '@element-plus/icons-vue'
import { promptsAPI } from '@/api/prompts'

const loading = ref(false)
const prompts = ref([])
const editState = ref({})
const isDirty = ref({})
const savingKey = ref(null)
const resettingKey = ref(null)
const currentKey = ref(null)

const currentPrompt = computed(() => {
  return prompts.value.find((p) => p.key === currentKey.value)
})

async function load() {
  loading.value = true
  try {
    const data = await promptsAPI.list()
    prompts.value = data.prompts || []
    for (const p of prompts.value) {
      editState.value[p.key] = p.current_body || p.default_body
    }
    // 默认选中第一个
    if (prompts.value.length > 0) {
      currentKey.value = prompts.value[0].key
    }
  } catch (_) {
    ElMessage.error('加载提示词失败')
  } finally {
    loading.value = false
  }
}

function selectPrompt(key) {
  currentKey.value = key
}

function markDirty(key) {
  const p = prompts.value.find((x) => x.key === key)
  if (!p) return
  const current = p.current_body || p.default_body
  isDirty.value[key] = editState.value[key] !== current
}

async function save(p) {
  const content = editState.value[p.key]
  if (!content?.trim()) {
    ElMessage.warning('内容不能为空')
    return
  }
  savingKey.value = p.key
  try {
    await promptsAPI.update(p.key, content.trim())
    p.current_body = content.trim()
    p.is_customized = true
    isDirty.value[p.key] = false
    ElMessage.success('已保存')
  } catch (_) {
  } finally {
    savingKey.value = null
  }
}

async function reset(p) {
  await ElMessageBox.confirm(`确定将「${p.label}」恢复为系统默认提示词？`, '恢复默认', {
    type: 'warning',
  })
  resettingKey.value = p.key
  try {
    await promptsAPI.reset(p.key)
    p.current_body = null
    p.is_customized = false
    editState.value[p.key] = p.default_body
    isDirty.value[p.key] = false
    ElMessage.success('已恢复默认')
  } catch (_) {
  } finally {
    resettingKey.value = null
  }
}

onMounted(() => load())
</script>

<style scoped>
.prompt-editor-page { padding: 0; height: 100%; }
.loading-wrap { min-height: 200px; }
.editor-layout { display: flex; gap: 16px; height: 100%; min-height: 460px; }
.left-sidebar {
  width: 224px; flex-shrink: 0;
  background: var(--cgp-glass);
  backdrop-filter: blur(var(--cgp-blur)) saturate(140%);
  -webkit-backdrop-filter: blur(var(--cgp-blur)) saturate(140%);
  border: 1px solid var(--cgp-border);
  border-radius: var(--cgp-radius);
  box-shadow: var(--cgp-shadow);
  display: flex; flex-direction: column; overflow: hidden;
}
.sidebar-menu { flex: 1; overflow-y: auto; padding: 10px; scrollbar-gutter: stable; }
.menu-item {
  padding: 11px 14px; border-radius: var(--cgp-radius-sm); cursor: pointer;
  margin-bottom: 4px; position: relative;
  transition: color var(--motion-fast) var(--motion-ease-out), background-color var(--motion-fast) var(--motion-ease-out), transform var(--motion-fast) var(--motion-ease-out);
}
.menu-item:hover { background: var(--bg-hover); }
.menu-item:active { transform: scale(.98); }
.menu-item.active { background: var(--cgp-accent-soft); box-shadow: inset 0 0 0 1px var(--cgp-border-bright); }
.menu-item.active .menu-label { color: var(--cgp-accent-strong); font-weight: 650; }
.menu-item-content { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.menu-label { font-size: 13px; color: var(--cgp-text); flex: 1; }
.menu-tag { font-size: 10px; transform: scale(.9); }
.dirty-indicator { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; background: var(--cgp-warning); border-radius: 50%; }
.right-content { flex: 1; min-width: 0; overflow-y: auto; padding: 2px 4px 2px 0; scrollbar-gutter: stable; }
.page-desc {
  margin: 0 0 16px; font-size: 12.5px; color: var(--cgp-text-muted); line-height: 1.6;
  padding: 10px 14px; background: var(--bg-inner); border-radius: var(--cgp-radius-sm);
  border-left: 3px solid var(--cgp-accent);
}
.prompt-card {
  background: var(--cgp-glass);
  backdrop-filter: blur(var(--cgp-blur)) saturate(140%);
  -webkit-backdrop-filter: blur(var(--cgp-blur)) saturate(140%);
  border: 1px solid var(--cgp-border);
  border-radius: var(--cgp-radius);
  box-shadow: var(--cgp-shadow);
  padding: 20px;
}
.prompt-card-header { margin-bottom: 16px; }
.prompt-card-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.prompt-label { font-size: 16px; font-weight: 650; color: var(--cgp-text); }
.custom-tag { font-size: 11px; }
.prompt-desc { margin: 0; font-size: 12px; color: var(--cgp-text-muted); }
.section-label { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 12px; font-weight: 500; color: var(--cgp-text-muted); }
.section-label--locked { color: var(--cgp-accent); }
.section-icon { font-size: 13px; }
.prompt-edit-section { margin-bottom: 16px; }
.prompt-textarea :deep(textarea) { font-family: 'Consolas', 'Monaco', ui-monospace, monospace; font-size: 12.5px; line-height: 1.6; }
.prompt-locked-section { margin-bottom: 16px; }
.locked-content {
  background: var(--bg-inner); border: 1px solid var(--cgp-border);
  border-radius: var(--cgp-radius-sm); padding: 10px 14px; font-size: 12px;
  font-family: 'Consolas', 'Monaco', ui-monospace, monospace;
  color: var(--cgp-text-muted); white-space: pre-wrap; line-height: 1.6; user-select: none;
}
.prompt-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 16px; border-top: 1px solid var(--cgp-border); }
</style>
