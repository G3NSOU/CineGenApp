<template>
  <div class="materials-page">
    <main class="materials-shell">
      <aside class="materials-sidebar" aria-label="素材分类">
        <div class="sidebar-heading">
          <span>LIBRARY</span>
          <strong>素材库</strong>
        </div>
        <div class="material-tabs">
          <span class="material-tab-slider" :style="{ '--material-index': activeTypeIndex }" aria-hidden="true" />
          <button
            v-for="type in materialTypes"
            :key="type.value"
            type="button"
            class="material-tab"
            :class="{ 'is-active': activeType === type.value }"
            :aria-current="activeType === type.value ? 'page' : undefined"
            @click="selectType(type.value)"
          >
            <el-icon><component :is="type.icon" /></el-icon>
            <span>{{ type.label }}</span>
            <small>{{ counts[type.value] ?? '—' }}</small>
          </button>
        </div>
      </aside>

      <section class="materials-content">
        <div class="material-panel">
          <div class="content-heading-stage">
            <Transition name="material-context">
              <div :key="activeType" class="content-heading">
                <div>
                  <span class="content-kicker">{{ currentType.eyebrow }}</span>
                  <h1>{{ currentType.title }}</h1>
                  <p>{{ currentType.description }}</p>
                </div>
                <div class="content-heading-actions">
                  <el-button class="batch-add-button" :loading="batchUploading" @click="startBatchAdd">
                    <el-icon v-if="!batchUploading"><Upload /></el-icon>{{ batchButtonText }}
                  </el-button>
                  <el-button type="primary" class="add-button" :disabled="batchUploading" @click="startCreate">
                    <el-icon><Plus /></el-icon>{{ activeType === 'audio' ? '添加音频' : `添加${currentType.singular}` }}
                  </el-button>
                </div>
              </div>
            </Transition>
          </div>

          <div class="materials-toolbar-stage">
            <Transition name="material-context">
              <div :key="activeType" class="materials-toolbar">
                <el-input
                  v-model="keyword"
                  class="search-input"
                  clearable
                  :placeholder="`搜索${currentType.label}名称或描述`"
                  @input="scheduleSearch"
                >
                  <template #prefix><el-icon><Search /></el-icon></template>
                </el-input>
                <span class="result-count">共 {{ total }} 项</span>
                <el-button circle aria-label="刷新素材" :loading="loading" @click="loadMaterials"><el-icon><Refresh /></el-icon></el-button>
              </div>
            </Transition>
          </div>

          <div v-loading="loading" class="material-grid" :class="{ 'is-audio': activeType === 'audio' }">
            <article v-for="(item, index) in items" :key="`${activeType}:${item.id}`" class="material-card" :style="{ '--card-index': Math.min(index, 5) }">
            <template v-if="activeType !== 'audio'">
              <el-image
                v-if="imageUrl(item)"
                class="material-cover"
                :src="imageUrl(item)"
                :preview-src-list="[imageUrl(item)]"
                fit="cover"
                lazy
                preview-teleported
              />
              <div v-else class="material-cover empty-cover">
                <el-icon><Picture /></el-icon><span>暂无图片</span>
              </div>
            </template>
            <template v-else>
              <div class="audio-visual">
                <div class="audio-icon"><el-icon><Headset /></el-icon></div>
                <div class="audio-bars" aria-hidden="true"><i v-for="n in 18" :key="n" :style="{ height: `${18 + ((n * 13) % 30)}%` }" /></div>
              </div>
            </template>

            <div class="material-card-body">
              <div class="card-title-row">
                <h2><el-tag v-if="isTosActive(item)" size="small" effect="plain" class="tos-name-tag">TOS</el-tag>{{ itemTitle(item) }}</h2>
                <el-dropdown trigger="click" @command="command => onCardCommand(command, item)">
                  <el-button text circle aria-label="素材操作"><el-icon><MoreFilled /></el-icon></el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit"><el-icon><Edit /></el-icon>编辑</el-dropdown-item>
                      <el-dropdown-item command="delete" divided><el-icon><Delete /></el-icon>删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <p>{{ itemDescription(item) }}</p>
              <div v-if="activeType === 'character'" class="voice-status">
                <el-icon><Microphone /></el-icon>
                <span>{{ boundAudioName(item.voice_library_id) || '未绑定角色声音' }}</span>
              </div>
              <audio v-if="activeType === 'audio'" :src="audioUrl(item)" controls preload="none" />
              <el-button
                class="tos-sync-button"
                size="small"
                :disabled="isTosActive(item)"
                :loading="syncingIds.has(item.id)"
                @click="syncToTos(item)"
              >{{ isTosActive(item) ? `TOS · ${tosCountdown(item)}` : '同步到 TOS' }}</el-button>
              <div class="card-meta">
                <span>{{ item.category || currentType.singular }}</span>
                <time>{{ formatDate(item.updated_at || item.created_at) }}</time>
              </div>
            </div>
            </article>

            <div v-if="!loading && !items.length" class="empty-state">
              <div class="empty-state-icon"><el-icon><component :is="currentType.icon" /></el-icon></div>
              <h2>还没有{{ currentType.label }}</h2>
              <p>{{ currentType.empty }}</p>
              <el-button type="primary" @click="startCreate"><el-icon><Plus /></el-icon>添加{{ currentType.singular }}</el-button>
            </div>
          </div>

        <el-pagination
          v-if="total > pageSize"
          v-model:current-page="page"
          v-model:page-size="pageSize"
          class="materials-pagination"
          :total="total"
          :page-sizes="[20, 40, 80]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadMaterials"
          @size-change="onPageSizeChange"
        />
        </div>
      </section>
    </main>

    <input ref="audioFileInput" type="file" accept=".mp3,.wav,.m4a,.ogg,.webm,audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm" hidden @change="uploadAudio" />
    <input ref="batchImageFileInput" type="file" accept=".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp" multiple hidden @change="uploadBatchFiles" />
    <input ref="batchAudioFileInput" type="file" accept=".mp3,.wav,.m4a,.ogg,.webm,audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/webm" multiple hidden @change="uploadBatchFiles" />

    <el-dialog v-model="editorOpen" :title="`${editingId ? '编辑' : '添加'}${currentType.singular}`" width="520px" destroy-on-close>
      <el-form label-position="top" class="material-form">
        <template v-if="activeType !== 'audio'">
          <el-form-item label="素材图片">
            <button type="button" class="image-uploader" @click="imageFileInput?.click()">
              <img v-if="editor.image_url || editor.local_path" :src="imageUrl(editor)" alt="素材预览" />
              <span v-else><el-icon><Upload /></el-icon>上传图片</span>
              <span v-if="imageUploading" class="uploading-mask">上传中…</span>
            </button>
            <input ref="imageFileInput" type="file" accept="image/*" hidden @change="uploadEditorImage" />
          </el-form-item>
        </template>
        <el-form-item :label="activeType === 'scene' ? '地点名称' : '名称'">
          <el-input v-model="editor.name" :placeholder="activeType === 'scene' ? '例如：雨夜车站' : `输入${currentType.singular}名称`" />
        </el-form-item>
        <el-form-item v-if="activeType === 'scene'" label="时间 / 氛围">
          <el-input v-model="editor.time" placeholder="例如：深夜、清晨、黄昏" />
        </el-form-item>
        <el-form-item label="分类"><el-input v-model="editor.category" placeholder="可选" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="editor.description" type="textarea" :rows="4" placeholder="补充外观、用途或声音特征" /></el-form-item>
        <el-form-item v-if="activeType !== 'audio'" label="标签"><el-input v-model="editor.tags" placeholder="多个标签用逗号分隔" /></el-form-item>
        <el-form-item v-if="activeType === 'character'" label="角色声音">
          <el-select v-model="editor.voice_library_id" clearable filterable placeholder="从音频库选择">
            <el-option v-for="audio in audioOptions" :key="audio.id" :label="audio.name" :value="audio.id" />
          </el-select>
          <span class="form-hint">同一音频库既用于参考素材，也用于角色声音绑定。</span>
        </el-form-item>
        <section v-if="editingId && activeType !== 'audio'" v-loading="versionsLoading" class="material-version-section">
          <div class="version-section-heading">
            <div><strong>版本记录</strong><span>重新上传会创建新版本，TOS 状态与倒计时互相独立。</span></div>
            <small>{{ materialVersions.length }} 个版本</small>
          </div>
          <div class="material-version-list">
            <article v-for="version in materialVersions" :key="version.id" class="material-version-item" :class="{ 'is-current': version.is_current }">
              <img v-if="imageUrl(version)" :src="imageUrl(version)" :alt="`版本 ${version.version_number}`" />
              <div v-else class="version-empty"><el-icon><Picture /></el-icon></div>
              <div class="version-details">
                <div><strong>版本 {{ version.version_number }}</strong><el-tag v-if="version.is_current" size="small" effect="plain">当前</el-tag></div>
                <span>{{ formatDateTime(version.created_at) }}</span>
                <small :class="{ 'is-synced': isTosActive(version) }">{{ isTosActive(version) ? `TOS · ${tosCountdown(version)}` : '未同步到 TOS' }}</small>
              </div>
              <el-button size="small" :disabled="Boolean(version.is_current)" :loading="versionSwitchingId === version.id" @click="activateMaterialVersion(version)">
                {{ version.is_current ? '使用中' : '切换' }}
              </el-button>
            </article>
          </div>
        </section>
      </el-form>
      <template #footer>
        <el-button @click="editorOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!editor.name?.trim()" @click="saveEditor">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, markRaw, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Box, Delete, Edit, Headset, Microphone, MoreFilled, Picture, PictureFilled, Plus, Refresh, Search, Setting, Upload, User } from '@element-plus/icons-vue'
import { characterLibraryAPI } from '@/api/characterLibrary'
import { sceneLibraryAPI } from '@/api/sceneLibrary'
import { propLibraryAPI } from '@/api/propLibrary'
import { audioLibraryAPI, materialTosAPI, materialVersionAPI, voiceBindingAPI } from '@/api/mediaLibrary'
import { uploadAPI } from '@/api/upload'

const router = useRouter()
const route = useRoute()
const materialTypes = [
  { value: 'character', label: '角色', singular: '角色', title: '角色素材', eyebrow: 'CHARACTERS', icon: markRaw(User), description: '管理跨项目复用的角色形象，并从统一音频库绑定角色声音。', empty: '从项目加入角色，或在这里直接创建新的角色素材。' },
  { value: 'scene', label: '场景', singular: '场景', title: '场景素材', eyebrow: 'SCENES', icon: markRaw(PictureFilled), description: '集中管理地点、空间、时间与氛围参考。', empty: '从项目加入场景，或在这里直接创建新的场景素材。' },
  { value: 'prop', label: '道具', singular: '道具', title: '道具素材', eyebrow: 'PROPS', icon: markRaw(Box), description: '保存可在不同镜头与项目中反复调用的关键物件。', empty: '从项目加入道具，或在这里直接创建新的道具素材。' },
  { value: 'audio', label: '音频', singular: '音频', title: '音频素材', eyebrow: 'AUDIO', icon: markRaw(Headset), description: '统一管理配乐、音效、对白与角色声音参考；任意音频均可绑定角色。', empty: '上传配乐、音效、对白或角色声音参考。' },
]
const validTypes = new Set(materialTypes.map(item => item.value))
const activeType = ref(validTypes.has(route.query.type) ? route.query.type : 'character')
const activeTypeIndex = computed(() => Math.max(0, materialTypes.findIndex(item => item.value === activeType.value)))
const currentType = computed(() => materialTypes.find(item => item.value === activeType.value) || materialTypes[0])
const items = ref([])
const counts = reactive({ character: null, scene: null, prop: null, audio: null })
const loading = ref(false)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const editorOpen = ref(false)
const editingId = ref(null)
const editor = reactive(emptyEditor())
const saving = ref(false)
const imageUploading = ref(false)
const imageFileInput = ref(null)
const audioFileInput = ref(null)
const batchImageFileInput = ref(null)
const batchAudioFileInput = ref(null)
const audioOptions = ref([])
const batchUploading = ref(false)
const syncingIds = ref(new Set())
const materialVersions = ref([])
const versionsLoading = ref(false)
const versionSwitchingId = ref(null)
const nowTick = ref(Date.now())
let tosClock = null
const batchProgress = ref({ done: 0, total: 0 })
const batchButtonText = computed(() => batchUploading.value
  ? `正在添加 ${batchProgress.value.done}/${batchProgress.value.total}`
  : '批量添加')
let searchTimer = null
let batchTargetType = null

function emptyEditor() {
  return { name: '', time: '', category: '', description: '', tags: '', image_url: '', local_path: null, voice_library_id: null }
}

function apiFor(type) {
  return type === 'character' ? characterLibraryAPI : type === 'scene' ? sceneLibraryAPI : type === 'prop' ? propLibraryAPI : audioLibraryAPI
}

function selectType(type) {
  if (type === activeType.value) return
  // 各素材表的主键会重复；先同步卸载旧列表，避免新旧卡片在
  // 同一个 CSS Grid 中争夺位置。新卡挂载后只执行独立入场动画。
  items.value = []
  total.value = 0
  loading.value = true
  activeType.value = type
  keyword.value = ''
  page.value = 1
  router.replace({ path: '/materials', query: { type } })
}

watch(activeType, () => loadMaterials())

async function loadMaterials() {
  const requestedType = activeType.value
  loading.value = true
  try {
    const params = { page: page.value, page_size: pageSize.value, keyword: keyword.value || undefined, global: 1 }
    const res = await apiFor(requestedType).list(params)
    // 快速连续切换标签时，忽略较早请求的迟到响应。
    if (requestedType !== activeType.value) return
    items.value = res?.items || []
    const pagination = res?.pagination || {}
    total.value = pagination.total ?? res?.total ?? items.value.length
    counts[requestedType] = total.value
  } catch (error) {
    if (requestedType !== activeType.value) return
    items.value = []
    total.value = 0
    ElMessage.error(error?.message || '素材加载失败')
  } finally {
    if (requestedType === activeType.value) loading.value = false
  }
}

async function loadCounts() {
  await Promise.all(materialTypes.map(async type => {
    try {
      const res = await apiFor(type.value).list({ page: 1, page_size: 1, global: 1 })
      counts[type.value] = res?.pagination?.total ?? res?.total ?? res?.items?.length ?? 0
    } catch { counts[type.value] = 0 }
  }))
}

async function loadAudioOptions() {
  try {
    const res = await audioLibraryAPI.list({ page: 1, page_size: 100, global: 1 })
    audioOptions.value = res?.items || []
  } catch { audioOptions.value = [] }
}

function scheduleSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; loadMaterials() }, 260)
}

function onPageSizeChange() { page.value = 1; loadMaterials() }

function imageUrl(item) {
  if (item?.local_path) return `/static/${String(item.local_path).replace(/^\//, '')}`
  return item?.image_url || ''
}

function audioUrl(item) {
  if (item?.local_path) return `/static/${String(item.local_path).replace(/^\//, '')}`
  return item?.audio_url || ''
}

function itemTitle(item) {
  return activeType.value === 'scene' ? (item.location || item.time || '未命名场景') : (item.name || `未命名${currentType.value.singular}`)
}

function itemDescription(item) {
  return item.description || item.prompt || (activeType.value === 'audio' ? '暂无声音描述' : '暂无素材描述')
}

function boundAudioName(id) {
  if (!id) return ''
  return audioOptions.value.find(item => Number(item.id) === Number(id))?.name || '已绑定音频'
}

function isTosActive(item) {
  const expires = Date.parse(item?.tos_expires_at || '')
  return Boolean(item?.tos_url && Number.isFinite(expires) && expires > nowTick.value)
}

function tosCountdown(item) {
  const remaining = Math.max(0, Date.parse(item?.tos_expires_at || '') - nowTick.value)
  const hours = Math.ceil(remaining / 3600000)
  const days = Math.floor(hours / 24)
  return days > 0 ? `${days}天${hours % 24}小时` : `${hours}小时`
}

async function syncToTos(item) {
  if (isTosActive(item) || syncingIds.value.has(item.id)) return
  syncingIds.value = new Set(syncingIds.value).add(item.id)
  try {
    const synced = await materialTosAPI.sync('global', activeType.value, item.id)
    Object.assign(item, synced)
    ElMessage.success('素材已同步到 TOS')
  } catch (error) {
    ElMessage.error(error?.message || '同步到 TOS 失败')
  } finally {
    const next = new Set(syncingIds.value)
    next.delete(item.id)
    syncingIds.value = next
  }
}

function getAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const finish = (value) => { URL.revokeObjectURL(url); resolve(Number.isFinite(value) ? value : null) }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(audio.duration)
    audio.onerror = () => finish(null)
    audio.src = url
  })
}

function formatDate(value) {
  if (!value) return '未记录时间'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toLocaleDateString('zh-CN')
}

function formatDateTime(value) {
  if (!value) return '未记录时间'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false })
}

async function loadMaterialVersions() {
  if (!editingId.value || activeType.value === 'audio') {
    materialVersions.value = []
    return
  }
  versionsLoading.value = true
  try {
    materialVersions.value = await materialVersionAPI.list(activeType.value, editingId.value) || []
  } catch (error) {
    materialVersions.value = []
    ElMessage.error(error?.message || '版本记录加载失败')
  } finally { versionsLoading.value = false }
}

function resetEditor(item = null) {
  Object.assign(editor, emptyEditor())
  if (!item) return
  Object.assign(editor, {
    name: activeType.value === 'scene' ? (item.location || '') : (item.name || ''),
    time: item.time || '', category: item.category || '', description: item.description || item.prompt || '',
    tags: item.tags || '', image_url: item.image_url || '', local_path: item.local_path || null,
    voice_library_id: item.voice_library_id || null,
  })
}

function startCreate() {
  if (activeType.value === 'audio') return audioFileInput.value?.click()
  editingId.value = null
  resetEditor()
  if (activeType.value === 'character') loadAudioOptions()
  editorOpen.value = true
}

function startBatchAdd() {
  if (batchUploading.value) return
  batchTargetType = activeType.value
  const input = batchTargetType === 'audio' ? batchAudioFileInput.value : batchImageFileInput.value
  input?.click()
}

function filenameWithoutExtension(filename, fallback) {
  const name = String(filename || '').replace(/\.[^.]+$/, '').trim()
  return name || fallback
}

function imageLibraryPayload(type, file, uploaded) {
  const name = filenameWithoutExtension(file.name, `新${materialTypes.find(item => item.value === type)?.singular || '素材'}`)
  const shared = {
    category: null,
    description: null,
    prompt: null,
    tags: null,
    image_url: uploaded?.url || uploaded?.image_url || '',
    local_path: uploaded?.local_path || null,
    source_type: 'upload',
  }
  return type === 'scene' ? { ...shared, location: name, time: null } : { ...shared, name }
}

async function createBatchItem(type, file) {
  if (type === 'audio') {
    const duration = await getAudioDuration(file)
    const uploaded = await uploadAPI.uploadAudio(file)
    return audioLibraryAPI.create({
      name: filenameWithoutExtension(file.name, '新音频'),
      category: 'audio',
      audio_url: uploaded?.url || '',
      local_path: uploaded?.local_path || null,
      mime_type: uploaded?.mime_type || file.type || null,
      duration,
    })
  }
  const uploaded = await uploadAPI.uploadImage(file)
  return apiFor(type).create(imageLibraryPayload(type, file, uploaded))
}

async function uploadBatchFiles(event) {
  const input = event.target
  const files = Array.from(input?.files || [])
  if (input) input.value = ''
  if (!files.length || batchUploading.value) return

  const targetType = batchTargetType || activeType.value
  batchUploading.value = true
  batchProgress.value = { done: 0, total: files.length }
  let cursor = 0
  let succeeded = 0
  const failed = []

  // 限制并发数，避免一次选择大量文件时占满本地后端与磁盘 I/O。
  async function worker() {
    while (cursor < files.length) {
      const file = files[cursor++]
      try {
        await createBatchItem(targetType, file)
        succeeded += 1
      } catch (error) {
        failed.push({ name: file.name, message: error?.message || '上传失败' })
      } finally {
        batchProgress.value = { done: batchProgress.value.done + 1, total: files.length }
      }
    }
  }

  try {
    const concurrency = Math.min(3, files.length)
    await Promise.all(Array.from({ length: concurrency }, () => worker()))

    const refreshTasks = [loadCounts()]
    if (targetType === activeType.value) refreshTasks.push(loadMaterials())
    if (targetType === 'audio') refreshTasks.push(loadAudioOptions())
    await Promise.all(refreshTasks)

    if (!failed.length) {
      ElMessage.success(`已批量添加 ${succeeded} 个${materialTypes.find(item => item.value === targetType)?.singular || '素材'}`)
    } else {
      const preview = failed.slice(0, 3).map(item => item.name).join('、')
      ElMessage.warning(`成功 ${succeeded} 个，失败 ${failed.length} 个：${preview}${failed.length > 3 ? ' 等' : ''}`)
    }
  } finally {
    batchUploading.value = false
    batchTargetType = null
  }
}

function startEdit(item) {
  editingId.value = item.id
  resetEditor(item)
  if (activeType.value === 'character') loadAudioOptions()
  editorOpen.value = true
  loadMaterialVersions()
}

async function activateMaterialVersion(version) {
  if (version.is_current || versionSwitchingId.value) return
  versionSwitchingId.value = version.id
  try {
    const saved = await materialVersionAPI.activate(activeType.value, editingId.value, version.id)
    resetEditor(saved)
    await Promise.all([loadMaterialVersions(), loadMaterials()])
    ElMessage.success(`已切换到版本 ${version.version_number}`)
  } catch (error) {
    ElMessage.error(error?.message || '切换版本失败')
  } finally { versionSwitchingId.value = null }
}

async function uploadEditorImage(event) {
  const file = event.target?.files?.[0]
  if (event.target) event.target.value = ''
  if (!file) return
  imageUploading.value = true
  try {
    const result = await uploadAPI.uploadImage(file)
    editor.image_url = result?.url || result?.image_url || ''
    editor.local_path = result?.local_path || null
    ElMessage.success('图片已上传')
  } catch (error) { ElMessage.error(error?.message || '图片上传失败') }
  finally { imageUploading.value = false }
}

async function saveEditor() {
  if (!editor.name.trim()) return
  saving.value = true
  try {
    const type = activeType.value
    const payload = type === 'scene'
      ? { location: editor.name.trim(), time: editor.time || null, category: editor.category || null, description: editor.description || null, prompt: editor.description || null, tags: editor.tags || null, image_url: editor.image_url || '', local_path: editor.local_path || null, source_type: 'upload' }
      : { name: editor.name.trim(), category: editor.category || null, description: editor.description || null, tags: editor.tags || null, image_url: editor.image_url || '', local_path: editor.local_path || null, source_type: 'upload' }
    const saved = editingId.value
      ? await apiFor(type).update(editingId.value, payload)
      : await apiFor(type).create(payload)
    const targetId = editingId.value || saved?.id
    if (type === 'character' && targetId) await voiceBindingAPI.bind(targetId, 'library-character', editor.voice_library_id)
    if (editingId.value && type !== 'audio') await loadMaterialVersions()
    ElMessage.success('素材已保存')
    editorOpen.value = false
    await Promise.all([loadMaterials(), loadCounts()])
  } catch (error) { ElMessage.error(error?.message || '保存失败') }
  finally { saving.value = false }
}

async function uploadAudio(event) {
  const file = event.target?.files?.[0]
  if (event.target) event.target.value = ''
  if (!file) return
  loading.value = true
  try {
    const duration = await getAudioDuration(file)
    const uploaded = await uploadAPI.uploadAudio(file)
    const name = file.name.replace(/\.[^.]+$/, '') || '新音频'
    await audioLibraryAPI.create({ name, category: 'audio', audio_url: uploaded?.url, local_path: uploaded?.local_path || null, mime_type: uploaded?.mime_type || file.type || null, duration })
    ElMessage.success('音频已加入统一素材库')
    await Promise.all([loadMaterials(), loadCounts(), loadAudioOptions()])
  } catch (error) { ElMessage.error(error?.message || '音频上传失败') }
  finally { loading.value = false }
}

onMounted(() => { tosClock = window.setInterval(() => { nowTick.value = Date.now() }, 60000) })
onBeforeUnmount(() => { if (tosClock) window.clearInterval(tosClock) })

async function onCardCommand(command, item) {
  if (command === 'edit') return startEdit(item)
  if (command !== 'delete') return
  try { await ElMessageBox.confirm(`确定删除“${itemTitle(item)}”吗？`, '删除素材', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }) }
  catch { return }
  try {
    await apiFor(activeType.value).delete(item.id)
    ElMessage.success('素材已删除')
    await Promise.all([loadMaterials(), loadCounts()])
    if (activeType.value === 'audio') await loadAudioOptions()
  } catch (error) { ElMessage.error(error?.message || '删除失败') }
}

onMounted(async () => {
  await Promise.all([loadMaterials(), loadCounts(), loadAudioOptions()])
})
</script>

<style scoped>
.workspace-header-actions { display: flex; align-items: center; gap: 8px; }
.materials-page { min-height: 100dvh; color: var(--cgp-text); }
.materials-shell { display: block; min-height: calc(100dvh - 68px); }
.materials-sidebar { position: fixed; z-index: 30; top: 68px; bottom: 0; left: 0; width: 218px; height: auto; padding: 28px 14px; border-right: 1px solid rgba(231,231,225,.085); background: rgba(25,26,26,.5); box-shadow: 8px 0 28px rgba(5,6,6,.1); backdrop-filter: blur(28px) saturate(104%); }
.sidebar-heading { display: grid; gap: 3px; padding: 0 12px 20px; }
.sidebar-heading span,.content-kicker { color: #b6b6b2; font-size: 10px; font-weight: 800; letter-spacing: .19em; }
.sidebar-heading strong { font-size: 17px; }
.material-tabs { position: relative; }
.material-tab-slider { position: absolute; z-index: 0; top: 0; left: 0; width: 100%; height: 46px; border: 1px solid rgba(226,227,219,.2); border-radius: 11px; background: var(--liquid-pulse-bg); box-shadow: 0 0 0 1px rgba(235,235,229,.025),0 0 19px rgba(167,183,168,.08); transform: translateY(calc(var(--material-index) * 53px)); transition: transform var(--motion-standard) var(--motion-ease-in-out); pointer-events: none; }
.material-tab-slider::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: radial-gradient(circle at 86% 12%,rgba(222,225,216,.13),transparent 44%); }
.material-tab { position: relative; z-index: 1; display: grid; grid-template-columns: 22px 1fr auto; align-items: center; width: 100%; min-height: 46px; margin-bottom: 7px; padding: 0 13px; border: 1px solid transparent; border-radius: 11px; color: #a9aba6; background: transparent; text-align: left; cursor: pointer; transition: color var(--motion-fast) var(--motion-ease-out), transform var(--motion-fast) var(--motion-ease-out); }
.material-tab:active { transform: scale(.97); transition-duration: 100ms; }
.material-tab:hover { color: #e7e7e2; background: transparent; }
.material-tab.is-active { color: #eeeeea; border-color: transparent; background: transparent; box-shadow: none; }
.material-tab small { min-width: 25px; padding: 2px 7px; border-radius: 99px; color: #9298a9; background: rgba(255,255,255,.055); text-align: center; }
.materials-content { display: grid; min-width: 0; margin-left: 218px; padding: 34px clamp(22px,3vw,48px) 54px; align-content: start; }
.material-panel { grid-area: 1 / 1; width: 100%; min-width: 0; }
.content-heading-stage,.materials-toolbar-stage { display: grid; width: 100%; max-width: 1500px; margin-right: auto; margin-left: auto; }
.content-heading-stage { margin-bottom: 25px; }
.materials-toolbar-stage { margin-bottom: 20px; }
.content-heading-stage > .content-heading,.materials-toolbar-stage > .materials-toolbar { grid-area: 1 / 1; width: 100%; }
.material-context-enter-active { transition: opacity 180ms var(--motion-ease-out); }
.material-context-leave-active { transition: opacity 120ms var(--motion-ease-out); pointer-events: none; }
.material-context-enter-from,.material-context-leave-to { opacity: 0; }
.content-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin: 0; }
.content-heading-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 9px; }
.content-heading h1 { margin: 6px 0 7px; color: #f7f7fb; font-size: clamp(25px,2vw,34px); line-height: 1.15; }
.content-heading p { max-width: 680px; margin: 0; color: #9399aa; line-height: 1.6; }
.add-button { min-height: 42px; padding: 0 19px; }
.batch-add-button { min-width: 116px; min-height: 42px; padding: 0 16px; }
.materials-toolbar { display: flex; align-items: center; gap: 12px; margin: 0; }
.search-input { width: min(390px,55vw); }
.result-count { margin-left: auto; color: #7f8595; font-size: 13px; }
.material-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(230px,1fr)); gap: 17px; max-width: 1500px; min-height: 360px; margin: 0 auto; }
.material-grid.is-audio { grid-template-columns: repeat(auto-fill,minmax(310px,1fr)); }
.material-card { min-width: 0; overflow: hidden; border: 1px solid rgba(229,229,223,.105); border-radius: 16px; background: rgba(31,32,32,.57); box-shadow: 0 12px 30px rgba(5,6,6,.2),inset 0 0 0 1px rgba(235,235,229,.018); backdrop-filter: blur(14px) saturate(104%); animation: material-card-enter 220ms cubic-bezier(.23,1,.32,1) backwards; animation-delay: calc(var(--card-index, 0) * 30ms); transition: border-color var(--motion-standard) var(--motion-ease-out), box-shadow var(--motion-standard) var(--motion-ease-out), transform var(--motion-standard) var(--motion-ease-out), opacity var(--motion-fast) var(--motion-ease-out); }
@keyframes material-card-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.material-card:hover { border-color: rgba(233,233,227,.2); box-shadow: 0 17px 38px rgba(5,6,6,.27),inset 0 0 0 1px rgba(235,235,229,.025); }
@media (hover: hover) and (pointer: fine) { .material-card:hover { transform: translateY(-2px); } }
.material-cover { display: block; width: 100%; aspect-ratio: 16/10; border-radius: 0; background: #080a10; }
.empty-cover { display: grid; place-content: center; gap: 8px; color: #62697a; text-align: center; }
.empty-cover .el-icon { margin: auto; font-size: 31px; }
.audio-visual { display: flex; align-items: center; gap: 15px; height: 98px; padding: 20px; background: radial-gradient(circle at 18% 50%,rgba(137,98,72,.16),transparent 36%),rgba(5,6,6,.34); }
.audio-icon { display: grid; flex: 0 0 44px; height: 44px; place-items: center; border: 1px solid rgba(255,255,255,.17); border-radius: 13px; color: #e0e0dd; background: rgba(255,255,255,.075); font-size: 21px; }
.audio-bars { display: flex; align-items: center; flex: 1; gap: 4px; height: 43px; }
.audio-bars i { flex: 1; min-height: 4px; border-radius: 3px; background: linear-gradient(to top,#878884,#e1e1de); opacity: .62; }
.material-card-body { padding: 15px 16px 14px; }
.card-title-row { display: flex; align-items: center; gap: 8px; }
.card-title-row h2 { flex: 1; min-width: 0; overflow: hidden; margin: 0; color: #f1f2f6; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.material-card-body > p { min-height: 38px; display: -webkit-box; overflow: hidden; margin: 6px 0 12px; color: #858b9b; font-size: 12px; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.voice-status { display: flex; align-items: center; gap: 6px; margin: 0 0 12px; padding: 7px 9px; border-radius: 8px; color: #a9aec0; background: rgba(255,255,255,.035); font-size: 11px; }
.voice-status .el-icon { color: #d0d0cd; }
.material-card audio { width: 100%; height: 34px; margin: 0 0 12px; }
.card-title-row h2 { display: flex; min-width: 0; align-items: center; gap: 7px; }
.tos-name-tag { flex: 0 0 auto; border-color: rgba(226,226,220,.25); color: #d7d7d2; background: rgba(226,226,220,.07); }
.tos-sync-button { width: 100%; margin: 0 0 12px; border-color: rgba(226,226,220,.13); background: rgba(226,226,220,.045); color: #c3c3bf; }
.tos-sync-button.is-disabled { opacity: .78; border-color: rgba(226,226,220,.1); background: rgba(226,226,220,.035); color: #aeadab; }
.card-meta { display: flex; justify-content: space-between; gap: 10px; padding-top: 11px; border-top: 1px solid rgba(255,255,255,.065); color: #656c7d; font-size: 11px; }
.empty-state { grid-column: 1/-1; display: grid; align-content: center; justify-items: center; min-height: 430px; color: #8a90a1; text-align: center; }
.empty-state-icon { display: grid; width: 64px; height: 64px; place-items: center; margin-bottom: 15px; border: 1px solid rgba(255,255,255,.18); border-radius: 19px; color: #e0e0dd; background: rgba(255,255,255,.06); font-size: 28px; }
.empty-state h2 { margin: 0 0 7px; color: #e8e9ef; font-size: 18px; }
.empty-state p { margin: 0 0 20px; }
.materials-pagination { justify-content: flex-end; max-width: 1500px; margin: 26px auto 0; }
.image-uploader { position: relative; display: grid; width: 100%; height: 210px; overflow: hidden; place-items: center; border: 1px dashed rgba(169,174,255,.27); border-radius: 13px; color: #9da3b4; background: rgba(255,255,255,.025); cursor: pointer; }
.image-uploader img { width: 100%; height: 100%; object-fit: contain; }
.image-uploader > span:not(.uploading-mask) { display: flex; align-items: center; gap: 7px; }
.uploading-mask { position: absolute; inset: 0; display: grid; place-items: center; color: white; background: rgba(5,7,12,.72); backdrop-filter: blur(6px); }
.material-form .el-select { width: 100%; }
.form-hint { margin-top: 7px; color: #777e91; font-size: 11px; }
.material-version-section { margin-top: 20px; padding-top: 18px; border-top: 1px solid rgba(232,232,226,.1); }
.version-section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 11px; }
.version-section-heading > div { display: grid; gap: 4px; }
.version-section-heading strong { color: #e5e5e1; font-size: 14px; }
.version-section-heading span,.version-section-heading small { color: #858a96; font-size: 11px; }
.material-version-list { display: grid; gap: 8px; max-height: 236px; overflow-y: auto; padding-right: 3px; }
.material-version-item { display: grid; grid-template-columns: 64px minmax(0,1fr) auto; align-items: center; gap: 11px; min-height: 68px; padding: 7px 9px; border: 1px solid rgba(232,232,226,.08); border-radius: 11px; background: rgba(18,19,19,.32); transition: border-color var(--motion-fast) var(--motion-ease-out), background var(--motion-fast) var(--motion-ease-out); }
.material-version-item.is-current { border-color: rgba(232,232,226,.18); background: rgba(232,232,226,.055); }
.material-version-item > img,.version-empty { width: 64px; height: 50px; border-radius: 7px; background: rgba(5,6,6,.42); object-fit: cover; }
.version-empty { display: grid; place-items: center; color: #727782; }
.version-details { display: grid; min-width: 0; gap: 3px; }
.version-details > div { display: flex; align-items: center; gap: 7px; }
.version-details strong { color: #d9d9d5; font-size: 12px; }
.version-details span,.version-details small { overflow: hidden; color: #777d89; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.version-details small.is-synced { color: #bfc1bb; }
@media (max-width: 780px) {
  .materials-shell { display: block; }
  .materials-sidebar { position: sticky; top: 66px; z-index: 30; display: block; width: 100%; height: auto; overflow: hidden; padding: 9px 12px; border-right: 0; border-bottom: 1px solid var(--cgp-border); }
  .sidebar-heading { display: none; }
  .material-tabs { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); width: 100%; }
  .material-tab-slider { width: 25%; height: 44px; transform: translateX(calc(var(--material-index) * 100%)); }
  .material-tab { grid-template-columns: 19px auto; justify-content: center; gap: 5px; min-height: 44px; margin: 0; padding: 0 8px; text-align: center; }
  .material-tab small { display: none; }
  .materials-content { margin-left: 0; padding: 25px 14px 40px; }
  .content-heading { align-items: center; }
  .content-heading p { display: none; }
  .add-button { padding: 0 13px; }
  .material-grid,.material-grid.is-audio { grid-template-columns: repeat(auto-fill,minmax(260px,1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .material-context-enter-active,.material-context-leave-active { transition: opacity var(--motion-fast) var(--motion-ease-out) !important; }
  .materials-sidebar,.content-heading,.materials-toolbar,.material-card { animation: none !important; }
  .material-card,.material-tab,.material-tab-slider { transition: opacity var(--motion-fast) var(--motion-ease-out), color var(--motion-fast) var(--motion-ease-out) !important; }
  .material-card:hover { transform: none; }
}
</style>
