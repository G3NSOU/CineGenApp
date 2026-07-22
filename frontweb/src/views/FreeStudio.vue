<template>
  <div class="studio-page">
    <Teleport to="#app-header-context">
      <div class="cgp-route-context" :key="`studio-${drama?.id || 'loading'}`">
        <el-button text class="cgp-context-home" @click="router.push('/')">
          <el-icon><ArrowLeft /></el-icon>
          项目
        </el-button>
        <span class="breadcrumb-sep">›</span>
        <div class="project-heading">
          <span class="mode-kicker">自由创作</span>
          <h1>{{ drama?.title || '加载项目中…' }}</h1>
        </div>
      </div>
    </Teleport>

    <main v-loading="loading" class="studio-layout">
      <aside class="generation-panel panel-surface">
        <div class="panel-title-row">
          <div>
            <span class="panel-kicker">GENERATE</span>
            <h2>生成控制台</h2>
          </div>
        </div>
        <el-segmented v-model="generationMode" :options="generationModes" block :disabled="!currentVideo" />
        <div class="field-block prompt-block">
          <label>提示词</label>
          <UniversalSegmentOmniAtEditor
            v-if="generationMode === '全能参考'"
            v-model="prompt"
            :slots="omniReferenceSlots"
            :disabled="!currentVideo"
            class="free-studio-omni-editor"
          />
          <el-input v-else v-model="prompt" type="textarea" :rows="7" placeholder="描述镜头、动作、运镜与声音…" :disabled="!currentVideo" />
          <div v-if="generationMode === '全能参考'" class="omni-reference-guidance" :class="{ 'has-error': references.length && !omniReferenceValidation.valid }">
            <span>输入 <kbd>@</kbd> 选择素材；CineGen 内保存为 <code>@图片N</code>，仅在发送给模型前转换成官方格式“图片N”。</span>
            <span v-if="omniReferenceValidation.invalid.length">无效引用：{{ omniReferenceValidation.invalid.map((n) => `@图片${n}`).join('、') }}</span>
            <span v-else-if="omniReferenceValidation.missing.length">尚未引用：{{ omniReferenceValidation.missing.map((n) => `@图片${n}`).join('、') }}</span>
          </div>
        </div>
        <div class="reference-panel">
          <div class="dock-title">
            <div class="dock-title-main">
              <span>参考素材</span>
              <el-tag size="small" effect="plain">{{ references.length }}/{{ referenceLimit }}</el-tag>
            </div>
            <el-button size="small" :disabled="!currentVideo" @click="assetDrawerOpen = true">
              <el-icon><Plus /></el-icon>添加
            </el-button>
          </div>
          <TransitionGroup v-if="references.length" name="studio-list" tag="div" class="reference-list">
            <div v-for="(reference, index) in references" :key="reference.key" class="reference-card" :style="{ '--motion-index': Math.min(index, 5) }">
              <img :src="reference.url" alt="" />
              <span class="reference-index">{{ referenceLabel(index) }}</span>
              <span v-if="reference.voice" class="reference-voice-marker" :class="{ muted: reference.voice.muted }" :title="reference.voice.muted ? '角色声音已临时静音' : '包含角色声音'">♫</span>
              <button v-if="reference.voice" type="button" class="reference-voice-toggle" @click="toggleReferenceVoice(reference)">{{ reference.voice.muted ? '启用声音' : '临时静音' }}</button>
              <button type="button" class="reference-remove" title="移除" @click="removeReference(reference.key)">×</button>
              <small><el-tag v-if="reference.tos_url" size="small" effect="plain">TOS</el-tag>{{ reference.name }}</small>
            </div>
          </TransitionGroup>
          <div v-else class="dock-placeholder">
            {{ currentVideo ? modeReferenceHint : '请先在右侧选择一个视频' }}
          </div>
          <div class="audio-reference-status" :class="{ 'is-limit': !audioReferenceState.valid }">
            <span>音频参考 {{ audioReferenceState.count }}/3</span>
            <span>总时长 {{ formatDuration(audioReferenceState.duration) }}/15秒</span>
          </div>
          <div v-for="audio in audioReferences" :key="audio.key" class="audio-reference-chip">
            <el-icon><Headset /></el-icon>
            <div><strong><el-tag v-if="audio.tos_url" size="small" effect="plain">TOS</el-tag>{{ audio.name }}</strong><small>音频参考 · {{ formatDuration(audio.duration) }}</small></div>
            <audio :src="audio.url" controls preload="none" />
            <button type="button" title="移除" @click="removeAudioReference(audio.key)">×</button>
          </div>
        </div>
        <div class="parameter-grid">
          <div class="field-block model-field">
            <label>模型</label>
            <el-select v-model="selectedModel" placeholder="选择视频模型" :disabled="!currentVideo" filterable>
              <el-option v-for="model in videoModels" :key="model.value" :label="model.label" :value="model.value" />
            </el-select>
          </div>
          <div class="field-block">
            <label>时长</label>
            <el-select v-model="duration" :disabled="!currentVideo">
              <el-option v-for="second in durationOptions" :key="second" :label="`${second} 秒`" :value="second" />
            </el-select>
          </div>
          <div class="field-block">
            <label>比例</label>
            <el-select v-model="aspectRatio" :disabled="!currentVideo">
              <el-option v-for="ratio in aspectRatios" :key="ratio" :label="ratio" :value="ratio" />
            </el-select>
          </div>
          <div class="field-block">
            <label>分辨率</label>
            <el-select v-model="resolution" :disabled="!currentVideo">
              <el-option label="480P" value="480p" />
              <el-option label="720P" value="720p" />
              <el-option label="1080P" value="1080p" />
            </el-select>
          </div>
          <div class="field-block web-search-field">
            <div class="switch-field-row">
              <div>
                <label>联网搜索</label>
                <small>默认关闭；火山官方目前仅支持纯文本输入场景</small>
              </div>
              <el-switch v-model="webSearchEnabled" :disabled="!currentVideo" />
            </div>
          </div>
        </div>
        <el-button
          type="primary"
          size="large"
          class="generate-button"
          :class="{ 'is-confirming': generationArmed, 'is-cooling-down': generationCooldown }"
          :loading="generationSubmitting"
          :disabled="!canGenerate || generationSubmitting || generationCooldown"
          @click="handleGenerateClick"
        >
          <span class="generate-button-sheen" aria-hidden="true"></span>
          <Transition name="generate-label" mode="out-in">
            <span :key="generateButtonLabel" class="generate-button-label">{{ generateButtonLabel }}</span>
          </Transition>
        </el-button>
        <p v-if="generationError" class="generation-error">{{ generationError }}</p>
      </aside>

      <section class="studio-workspace panel-surface">
        <div class="preview-header">
          <div>
            <span class="panel-kicker">PREVIEW</span>
            <h2>{{ currentVideo?.title || '视频预览' }}</h2>
          </div>
          <el-tag v-if="currentVideo" size="small" effect="plain">{{ generationMode }}</el-tag>
        </div>
        <div class="preview-stage">
          <Transition name="preview-state">
            <video
              v-if="currentVideo && latestGeneration?.status === 'completed' && mediaUrl(latestGeneration)"
              :key="`completed-${latestGeneration.id}`"
              :src="mediaUrl(latestGeneration)"
              controls
              preload="metadata"
            />
            <div v-else-if="currentVideo && latestGeneration" :key="`status-${latestGeneration.id}-${latestGeneration.status}`" class="preview-status" :class="`preview-status--${latestGeneration.status}`">
              <el-icon><VideoCamera /></el-icon>
              <strong>{{ latestGeneration.status === 'failed' ? '生成失败' : (latestGeneration.status === 'cancelled' ? '任务已取消' : '视频生成中') }}</strong>
              <span>{{ latestGeneration.status === 'failed' ? (latestGeneration.error_msg || '请调整参数后重试') : (latestGeneration.status === 'cancelled' ? '可以调整提示词或参考素材后重新生成' : '完成后会自动显示在这里') }}</span>
            </div>
            <div v-else-if="currentVideo" key="ready" class="stage-placeholder">
              <el-icon><VideoCamera /></el-icon>
              <h2>准备生成第一个版本</h2>
              <p>在左侧添加参考素材、填写提示词并配置参数。</p>
            </div>
            <div v-else key="empty" class="stage-placeholder">
              <el-icon><VideoCamera /></el-icon>
              <h2>选择一个视频开始创作</h2>
              <p>子项目和视频列表已移到右侧。</p>
            </div>
          </Transition>
        </div>
        <Transition name="preview-actions">
          <div v-if="currentVideo && latestGeneration" class="preview-actions" aria-label="当前视频操作">
            <el-button :disabled="latestGeneration.status !== 'completed' || !mediaUrl(latestGeneration)" @click="downloadCurrentVideo">
              <el-icon><Download /></el-icon>下载
            </el-button>
            <el-button v-if="latestGeneration.status === 'processing'" :loading="cancellingGeneration" @click="cancelCurrentGeneration">
              <el-icon><CloseBold /></el-icon>取消
            </el-button>
            <el-button :disabled="latestGeneration.status !== 'completed'" :loading="duplicatingVideo" @click="duplicateCurrentVideo">
              <el-icon><CopyDocument /></el-icon>复制
            </el-button>
          </div>
        </Transition>
        <div class="history-strip">
          <div class="history-strip-title">
            <span>生成历史</span>
            <small>{{ generationHistory.length }} 个版本</small>
          </div>
          <TransitionGroup v-if="generationHistory.length" name="studio-list" tag="div" class="history-list">
            <div v-for="(item, index) in generationHistory" :key="item.id" class="history-item" :style="{ '--motion-index': Math.min(index, 5) }">
              <video v-if="item.status === 'completed' && mediaUrl(item)" :src="mediaUrl(item)" controls preload="metadata" />
              <div v-else class="history-status" :class="'history-status--' + item.status">
                {{ item.status === 'failed' ? '失败' : (item.status === 'cancelled' ? '已取消' : '处理中') }}
              </div>
              <small>{{ item.model || '默认模型' }} · {{ item.duration || duration }} 秒</small>
            </div>
          </TransitionGroup>
          <div v-else class="history-empty">生成结果会按版本保留在这里</div>
        </div>
      </section>

      <aside class="studio-sidebar panel-surface">
        <div class="panel-title-row hierarchy-title">
          <div>
            <span class="panel-kicker">PROJECT</span>
            <h2>项目内容</h2>
          </div>
          <el-button circle size="small" :icon="Plus" title="新建子项目" @click="showSubprojectDialog = true" />
        </div>
        <TransitionGroup v-if="episodes.length" name="studio-list" tag="div" class="subproject-list">
          <button
            v-for="(episode, index) in episodes"
            :key="episode.id"
            class="subproject-item"
            :class="{ active: episode.id === selectedEpisodeId }"
            :style="{ '--motion-index': Math.min(index, 5) }"
            type="button"
            @click="selectEpisode(episode)"
          >
            <div>
              <span>{{ episode.title || `子项目 ${episode.episode_number || ''}` }}</span>
              <small>{{ episode.storyboards?.length || 0 }} 个视频</small>
            </div>
          </button>
        </TransitionGroup>
        <div v-else class="empty-block compact-empty">
          <el-icon><FolderAdd /></el-icon>
          <strong>还没有子项目</strong>
          <el-button type="primary" plain @click="showSubprojectDialog = true">新建子项目</el-button>
        </div>
        <div v-if="currentEpisode" class="video-list-section">
          <div class="video-list-title">
            <div>
              <span class="panel-kicker">{{ currentEpisode.title || '未命名子项目' }}</span>
              <h3>视频</h3>
            </div>
            <el-button size="small" :icon="Plus" @click="showVideoDialog = true">新建</el-button>
          </div>
          <TransitionGroup v-if="currentVideos.length" name="studio-list" tag="div" class="video-list">
            <button
              v-for="(video, index) in currentVideos"
              :key="video.id"
              class="video-list-item"
              :class="{ active: video.id === selectedVideoId }"
              :style="{ '--motion-index': Math.min(index, 5) }"
              type="button"
              @click="selectVideo(video)"
            >
              <div class="video-list-thumb"><el-icon><VideoCamera /></el-icon></div>
              <div class="video-card-info">
                <strong>{{ video.title || `视频 ${video.storyboard_number}` }}</strong>
                <span>{{ video.duration || 5 }} 秒 · {{ video.status || 'pending' }}</span>
              </div>
            </button>
          </TransitionGroup>
          <div v-else class="empty-video-list">
            <span>这个子项目还没有视频</span>
            <el-button type="primary" @click="showVideoDialog = true">新建视频</el-button>
          </div>
        </div>
      </aside>
    </main>

    <el-dialog v-model="showSubprojectDialog" title="新建子项目" width="420px" @closed="subprojectTitle = ''">
      <el-form label-position="top">
        <el-form-item label="子项目名称" required>
          <el-input v-model="subprojectTitle" placeholder="例如：序列 01、广告版本 A" maxlength="100" @keyup.enter="createSubproject" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSubprojectDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingSubproject" :disabled="!subprojectTitle.trim()" @click="createSubproject">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showVideoDialog" title="新建视频" width="420px" @closed="videoTitle = ''">
      <el-form label-position="top">
        <el-form-item label="视频名称" required>
          <el-input v-model="videoTitle" placeholder="例如：角色进入车站" maxlength="100" @keyup.enter="createVideo" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showVideoDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingVideo" :disabled="!videoTitle.trim()" @click="createVideo">创建</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="assetDrawerOpen" title="添加参考素材" size="620px">
      <div class="asset-drawer-note">同时显示当前项目资产与主页全局素材库，点击即可加入当前视频。</div>
      <el-tabs v-model="assetTab">
        <el-tab-pane label="角色" name="character">
          <div v-loading="assetLibraryLoading" class="asset-grid">
            <button v-for="item in characterAssets" :key="`character-${item.asset_source}-${item.id}`" class="asset-card" type="button" :disabled="!assetUrl(item)" @click="addAssetReference('character', item)">
              <img v-if="assetUrl(item)" :src="assetUrl(item)" alt="" />
              <div v-else class="asset-no-image">暂无图片</div>
              <el-tag class="asset-source-tag" size="small" :type="item.asset_source === 'global' ? 'success' : 'info'">{{ item.asset_source === 'global' ? '全局' : '项目' }}</el-tag>
              <strong><el-tag v-if="isTosActive(item)" size="small" effect="plain">TOS</el-tag>{{ item.name || '未命名角色' }}<span v-if="item.voice_library_id" class="asset-voice-mark" title="已绑定角色声音">♫</span></strong>
            </button>
          </div>
          <el-empty v-if="!assetLibraryLoading && !characterAssets.length" description="角色素材库为空" />
        </el-tab-pane>
        <el-tab-pane label="场景" name="scene">
          <div v-loading="assetLibraryLoading" class="asset-grid">
            <button v-for="item in sceneAssets" :key="`scene-${item.asset_source}-${item.id}`" class="asset-card" type="button" :disabled="!assetUrl(item)" @click="addAssetReference('scene', item)">
              <img v-if="assetUrl(item)" :src="assetUrl(item)" alt="" />
              <div v-else class="asset-no-image">暂无图片</div>
              <el-tag class="asset-source-tag" size="small" :type="item.asset_source === 'global' ? 'success' : 'info'">{{ item.asset_source === 'global' ? '全局' : '项目' }}</el-tag>
              <strong><el-tag v-if="isTosActive(item)" size="small" effect="plain">TOS</el-tag>{{ item.location || item.time || '未命名场景' }}</strong>
            </button>
          </div>
          <el-empty v-if="!assetLibraryLoading && !sceneAssets.length" description="场景素材库为空" />
        </el-tab-pane>
        <el-tab-pane label="道具" name="prop">
          <div v-loading="assetLibraryLoading" class="asset-grid">
            <button v-for="item in propAssets" :key="`prop-${item.asset_source}-${item.id}`" class="asset-card" type="button" :disabled="!assetUrl(item)" @click="addAssetReference('prop', item)">
              <img v-if="assetUrl(item)" :src="assetUrl(item)" alt="" />
              <div v-else class="asset-no-image">暂无图片</div>
              <el-tag class="asset-source-tag" size="small" :type="item.asset_source === 'global' ? 'success' : 'info'">{{ item.asset_source === 'global' ? '全局' : '项目' }}</el-tag>
              <strong><el-tag v-if="isTosActive(item)" size="small" effect="plain">TOS</el-tag>{{ item.name || '未命名道具' }}</strong>
            </button>
          </div>
          <el-empty v-if="!assetLibraryLoading && !propAssets.length" description="道具素材库为空" />
        </el-tab-pane>
        <el-tab-pane label="音频" name="audio">
          <div class="voice-binding-panel">
            <div class="voice-binding-title"><strong>角色声音绑定</strong><small>与普通音频共用同一素材库</small></div>
            <div v-for="character in (drama?.characters || [])" :key="`binding-${character.id}`" class="voice-binding-row">
              <span>{{ character.name || '未命名角色' }}</span>
              <el-select v-model="projectVoiceBindings[character.id]" clearable filterable placeholder="选择音频素材">
                <el-option v-for="audio in globalAudioAssets" :key="audio.id" :label="audio.name" :value="audio.id" />
              </el-select>
              <el-button size="small" @click="bindProjectVoice(character)">保存</el-button>
            </div>
            <small v-if="!(drama?.characters || []).length" class="binding-empty">当前项目没有项目角色；可在素材库给全局角色绑定声音。</small>
          </div>
          <el-upload class="inline-audio-upload" :show-file-list="false" accept="audio/*,.mp3,.wav,.m4a,.ogg" :http-request="uploadAudioAsset">
            <el-button type="primary" plain><el-icon><Headset /></el-icon>上传并加入音频素材库</el-button>
          </el-upload>
          <div v-loading="assetLibraryLoading" class="media-asset-list">
            <button v-for="item in globalAudioAssets" :key="`audio-${item.id}`" class="media-asset-card" type="button" @click="selectAudioReference(item)">
              <el-icon><Headset /></el-icon>
              <span><strong><el-tag v-if="isTosActive(item)" size="small" effect="plain">TOS</el-tag>{{ item.name }}</strong><small>{{ item.category || '音频素材' }} · {{ formatDuration(item.duration) }}</small></span>
              <audio :src="audioAssetUrl(item)" controls preload="none" @click.stop />
            </button>
          </div>
          <el-empty v-if="!assetLibraryLoading && !globalAudioAssets.length" description="音频素材库为空，请先在主页添加" />
        </el-tab-pane>
        <el-tab-pane label="上传" name="upload">
          <el-upload drag :show-file-list="false" accept="image/*" :http-request="uploadReferenceAsset">
            <el-icon class="upload-drag-icon"><UploadFilled /></el-icon>
            <div>拖入图片，或点击选择</div>
            <template #tip><div class="el-upload__tip">上传图片仅作为当前视频参考，不触发图片生成。</div></template>
          </el-upload>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, CloseBold, CopyDocument, Download, FolderAdd, Plus, UploadFilled, VideoCamera, Headset } from '@element-plus/icons-vue'
import { dramaAPI } from '@/api/drama'
import { storyboardsAPI } from '@/api/storyboards'
import { aiAPI } from '@/api/ai'
import { videosAPI } from '@/api/videos'
import { taskAPI } from '@/api/task'
import { uploadAPI } from '@/api/upload'
import { characterLibraryAPI } from '@/api/characterLibrary'
import { sceneLibraryAPI } from '@/api/sceneLibrary'
import { propLibraryAPI } from '@/api/propLibrary'
import { audioLibraryAPI, materialTosAPI, voiceBindingAPI } from '@/api/mediaLibrary'
import UniversalSegmentOmniAtEditor from '@/components/UniversalSegmentOmniAtEditor.vue'
import { normalizeOmniPromptSpacing, removeOmniReferenceFromPrompt, validateOmniPromptReferences } from '@/utils/omniReferences'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const drama = ref(null)
const generationMode = ref('全能参考')
const generationModes = ['图生视频', '全能参考', '首尾帧']
const prompt = ref('')
const references = ref([])
const audioReferences = ref([])
const assetDrawerOpen = ref(false)
const assetTab = ref('character')
const assetLibraryLoading = ref(false)
const globalCharacterAssets = ref([])
const globalSceneAssets = ref([])
const globalPropAssets = ref([])
const globalAudioAssets = ref([])
const projectVoiceBindings = ref({})
const videoConfigs = ref([])
const selectedModel = ref('')
const duration = ref(5)
const aspectRatio = ref('16:9')
const resolution = ref('720p')
const webSearchEnabled = ref(false)
const generationArmed = ref(false)
const generationSubmitting = ref(false)
const generationCooldown = ref(false)
let generationConfirmTimer = null
let generationCooldownTimer = null
const cancellingGeneration = ref(false)
const duplicatingVideo = ref(false)
const generationError = ref('')
const generationHistory = ref([])
const selectedEpisodeId = ref(null)
const selectedVideoId = ref(null)
const showSubprojectDialog = ref(false)
const showVideoDialog = ref(false)
const subprojectTitle = ref('')
const videoTitle = ref('')
const savingSubproject = ref(false)
const savingVideo = ref(false)
const episodes = computed(() => drama.value?.episodes || [])
const currentEpisode = computed(() => episodes.value.find((item) => item.id === selectedEpisodeId.value) || null)
const currentVideos = computed(() => currentEpisode.value?.storyboards || [])
const currentVideo = computed(() => currentVideos.value.find((item) => item.id === selectedVideoId.value) || null)
const characterAssets = computed(() => [
  ...(drama.value?.characters || []).map((item) => ({ ...item, asset_source: 'project' })),
  ...globalCharacterAssets.value.map((item) => ({ ...item, asset_source: 'global' })),
])
const sceneAssets = computed(() => [
  ...(drama.value?.scenes || []).map((item) => ({ ...item, asset_source: 'project' })),
  ...globalSceneAssets.value.map((item) => ({ ...item, asset_source: 'global' })),
])
const propAssets = computed(() => [
  ...(drama.value?.props || []).map((item) => ({ ...item, asset_source: 'project' })),
  ...globalPropAssets.value.map((item) => ({ ...item, asset_source: 'global' })),
])
const latestGeneration = computed(() => generationHistory.value[0] || null)
const generateButtonLabel = computed(() => {
  if (generationSubmitting.value) return '正在提交…'
  if (generationCooldown.value) return '任务已提交'
  if (generationArmed.value) return '再次点击确认生成'
  return '生成视频'
})
const effectiveAudioReferences = computed(() => [
  ...audioReferences.value,
  ...references.value.filter((item) => item.voice && !item.voice.muted).map((item) => ({ ...item.voice, owner_key: item.key })),
])
const audioReferenceState = computed(() => {
  const count = effectiveAudioReferences.value.length
  const duration = effectiveAudioReferences.value.reduce((sum, item) => sum + Math.max(0, Number(item.duration) || 0), 0)
  return { count, duration, valid: count <= 3 && duration <= 15.001 }
})
const referenceLimit = computed(() => generationMode.value === '图生视频' ? 1 : (generationMode.value === '首尾帧' ? 2 : 9))
const omniReferenceSlots = computed(() => references.value.map((item, index) => ({
  index: index + 1,
  kind: ['scene', 'character', 'prop'].includes(item.type) ? item.type : 'reference',
  name: item.name || `图片${index + 1}`,
  thumbUrl: item.url || '',
})))
const omniReferenceValidation = computed(() => validateOmniPromptReferences(prompt.value, references.value.length))
const durationOptions = Array.from({ length: 12 }, (_, index) => index + 4)
const aspectRatios = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
const videoModels = computed(() => {
  const out = []
  for (const config of videoConfigs.value) {
    if (config.is_active === false) continue
    const models = Array.isArray(config.model) ? config.model : []
    for (const model of models) {
      if (!model || out.some((item) => item.value === model)) continue
      out.push({ value: model, label: `${model} · ${config.name || config.provider || '视频模型'}` })
    }
  }
  return out
})
const modeReferenceHint = computed(() => {
  if (generationMode.value === '图生视频') return '请选择或上传一张主图'
  if (generationMode.value === '首尾帧') return '请依次添加首帧和尾帧'
  return '从项目或全局素材库中添加最多 9 张参考图'
})
const canGenerate = computed(() => {
  if (!currentVideo.value || !prompt.value.trim() || !selectedModel.value || !audioReferenceState.value.valid) return false
  if (generationMode.value === '图生视频') return references.value.length === 1
  if (generationMode.value === '首尾帧') return references.value.length === 2
  return references.value.length >= 1 && references.value.length <= 9 && omniReferenceValidation.value.valid
})

watch(generationMode, () => {
  generationError.value = ''
  const max = generationMode.value === '图生视频' ? 1 : (generationMode.value === '首尾帧' ? 2 : 9)
  if (references.value.length > max) {
    references.value = references.value.slice(0, max)
    if (generationMode.value === '全能参考') {
      prompt.value = prompt.value.replace(/@图片(\d+)/g, (token, number) => Number(number) <= max ? token : '')
    }
  }
})

function resetGenerationConfirmation() {
  generationArmed.value = false
  if (generationConfirmTimer) window.clearTimeout(generationConfirmTimer)
  generationConfirmTimer = null
}

watch(
  [selectedVideoId, generationMode, prompt, selectedModel, duration, aspectRatio, resolution, webSearchEnabled, references, audioReferences],
  resetGenerationConfirmation,
  { deep: true },
)

function selectEpisode(episode) {
  selectedEpisodeId.value = episode?.id || null
  selectedVideoId.value = episode?.storyboards?.[0]?.id || null
  prompt.value = episode?.storyboards?.[0]?.video_prompt || ''
  references.value = []
  audioReferences.value = []
  webSearchEnabled.value = false
  generationHistory.value = []
  if (selectedVideoId.value) loadGenerationHistory()
}

function selectVideo(video) {
  selectedVideoId.value = video?.id || null
  prompt.value = video?.video_prompt || ''
  references.value = []
  audioReferences.value = []
  webSearchEnabled.value = false
  generationError.value = ''
  loadGenerationHistory()
}

function assetUrl(item) {
  if (!item) return ''
  if (item.local_path) return `/static/${String(item.local_path).replace(/^\//, '')}`
  return item.image_url || item.ref_image || ''
}

function audioAssetUrl(item) {
  if (!item) return ''
  if (item.local_path) return `/static/${String(item.local_path).replace(/^\//, '')}`
  return item.audio_url || ''
}

function isTosActive(item) {
  const expires = Date.parse(item?.tos_expires_at || '')
  return Boolean(item?.tos_url && Number.isFinite(expires) && expires > Date.now())
}

function formatDuration(value) {
  const seconds = Math.max(0, Number(value) || 0)
  return `${seconds.toFixed(seconds % 1 ? 1 : 0)}秒`
}

function probeAudioDuration(url) {
  return new Promise((resolve) => {
    const audio = new Audio()
    const timer = window.setTimeout(() => finish(null), 8000)
    const finish = (value) => {
      window.clearTimeout(timer)
      audio.removeAttribute('src')
      resolve(Number.isFinite(value) ? Math.round(value * 100) / 100 : null)
    }
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(audio.duration)
    audio.onerror = () => finish(null)
    audio.src = url
  })
}

async function ensureAudioDuration(item) {
  if (Number(item?.duration) > 0) return Number(item.duration)
  const duration = await probeAudioDuration(audioAssetUrl(item))
  if (!duration) throw new Error(`无法读取“${item?.name || '音频'}”的时长`)
  item.duration = duration
  if (item.id) {
    try { await audioLibraryAPI.update(item.id, { duration }) } catch (_) {}
  }
  return duration
}

function updateSyncedSource(type, source, id, synced) {
  const globalMap = { character: globalCharacterAssets, scene: globalSceneAssets, prop: globalPropAssets, audio: globalAudioAssets }
  const projectMap = { character: 'characters', scene: 'scenes', prop: 'props' }
  const list = source === 'global' ? globalMap[type]?.value : drama.value?.[projectMap[type]]
  const original = Array.isArray(list) ? list.find((entry) => Number(entry.id) === Number(id)) : null
  if (original) Object.assign(original, synced)
}

async function ensureTosAsset(type, item) {
  if (isTosActive(item)) return item
  const source = item.asset_source || 'global'
  const synced = await materialTosAPI.sync(source, type, item.id)
  Object.assign(item, synced)
  updateSyncedSource(type, source, item.id, synced)
  return item
}

function canAddAudio(duration) {
  return audioReferenceState.value.count < 3 && audioReferenceState.value.duration + Math.max(0, Number(duration) || 0) <= 15.001
}

async function selectAudioReference(item) {
  try {
    const key = `audio:global:${item.id}`
    if (audioReferences.value.some((audio) => audio.key === key)) return ElMessage.info('该音频已在参考列表中')
    const duration = await ensureAudioDuration(item)
    if (!canAddAudio(duration)) return ElMessage.warning('音频参考最多 3 条，且总时长不能超过 15 秒')
    const synced = await ensureTosAsset('audio', { ...item, asset_source: 'global' })
    audioReferences.value.push({ key, type: 'audio', id: item.id, name: item.name || '未命名音频', url: synced.tos_url, tos_url: synced.tos_url, tos_expires_at: synced.tos_expires_at, duration, source: 'global' })
    assetDrawerOpen.value = false
    ElMessage.success('已加入音频参考')
  } catch (error) {
    ElMessage.error(error?.message || '音频素材同步失败')
  }
}

function removeAudioReference(key) {
  audioReferences.value = audioReferences.value.filter((item) => item.key !== key)
}

async function uploadAudioAsset(options) {
  try {
    const uploaded = await uploadAPI.uploadAudio(options.file)
    const data = uploaded?.data ?? uploaded
    const name = options.file.name.replace(/\.[^.]+$/, '') || '新音频'
    const item = await audioLibraryAPI.create({
      name, category: 'audio', audio_url: data.url,
      local_path: data.local_path || null, mime_type: data.mime_type || options.file.type || null,
    })
    globalAudioAssets.value.unshift(item)
    await selectAudioReference(item)
    options.onSuccess?.(item)
  } catch (error) {
    options.onError?.(error)
    ElMessage.error(error?.message || '音频上传失败')
  }
}

async function bindProjectVoice(character) {
  try {
    await voiceBindingAPI.bind(character.id, 'character', projectVoiceBindings.value[character.id] || null)
    character.voice_library_id = projectVoiceBindings.value[character.id] || null
    ElMessage.success(character.voice_library_id ? '角色声音已绑定' : '已解除角色声音绑定')
  } catch (error) { ElMessage.error(error?.message || '绑定失败') }
}

function assetName(type, item) {
  if (type === 'scene') return item.location || item.time || '未命名场景'
  return item.name || (type === 'character' ? '未命名角色' : '未命名道具')
}

function referenceLabel(index) {
  if (generationMode.value === '首尾帧') return index === 0 ? '首帧' : '尾帧'
  return generationMode.value === '图生视频' ? '主图' : `@图片${index + 1}`
}

async function addAssetReference(type, item) {
  const localUrl = assetUrl(item)
  if (!localUrl) return
  const source = item.asset_source || 'project'
  const key = `${type}:${source}:${item.id}`
  if (references.value.some((reference) => reference.key === key)) {
    ElMessage.info('该资产已经在参考素材中')
    return
  }
  const max = generationMode.value === '图生视频' ? 1 : (generationMode.value === '首尾帧' ? 2 : 9)
  if (references.value.length >= max) {
    ElMessage.warning(`${generationMode.value}最多添加 ${max} 张图片`)
    return
  }
  try {
    const synced = await ensureTosAsset(type, item)
    let voice = null
    if (type === 'character' && item.voice_library_id) {
      const audio = globalAudioAssets.value.find((entry) => Number(entry.id) === Number(item.voice_library_id))
      if (audio) {
        const duration = await ensureAudioDuration(audio)
        const syncedAudio = await ensureTosAsset('audio', { ...audio, asset_source: 'global' })
        voice = {
          id: audio.id,
          name: audio.name || '角色声音',
          url: syncedAudio.tos_url,
          tos_url: syncedAudio.tos_url,
          tos_expires_at: syncedAudio.tos_expires_at,
          duration,
          muted: !canAddAudio(duration),
        }
        if (voice.muted) ElMessage.warning('音频参考已达 3 条或 15 秒上限，角色声音已临时静音')
      }
    }
    references.value.push({
      key, type, id: item.id, source, name: assetName(type, item),
      url: synced.tos_url, tos_url: synced.tos_url, tos_expires_at: synced.tos_expires_at, voice,
    })
    assetDrawerOpen.value = false
  } catch (error) {
    ElMessage.error(error?.message || '素材同步到 TOS 失败')
  }
}

function toggleReferenceVoice(reference) {
  if (!reference?.voice) return
  if (reference.voice.muted) {
    if (!canAddAudio(reference.voice.duration)) return ElMessage.warning('音频参考最多 3 条，且总时长不能超过 15 秒')
    reference.voice.muted = false
    ElMessage.success('已为本次生成启用角色声音')
  } else {
    reference.voice.muted = true
    ElMessage.info('仅本次引用临时静音，不会修改素材库绑定')
  }
}

function removeReference(key) {
  const removedIndex = references.value.findIndex((reference) => reference.key === key)
  references.value = references.value.filter((reference) => reference.key !== key)
  if (generationMode.value === '全能参考' && removedIndex >= 0) {
    prompt.value = removeOmniReferenceFromPrompt(prompt.value, removedIndex + 1)
  }
}

async function uploadReferenceAsset(options) {
  try {
    const result = await uploadAPI.uploadImage(options.file, { dramaId: drama.value?.id })
    const url = result?.url || result?.image_url || (result?.local_path ? `/static/${String(result.local_path).replace(/^\//, '')}` : '')
    if (!url) throw new Error('上传未返回图片地址')
    const key = `upload:${Date.now()}:${options.file.name}`
    const max = generationMode.value === '图生视频' ? 1 : (generationMode.value === '首尾帧' ? 2 : 9)
    if (references.value.length >= max) throw new Error(`${generationMode.value}最多添加 ${max} 张图片`)
    references.value.push({ key, type: 'upload', id: null, name: options.file.name, url, local_path: result?.local_path || null })
    options.onSuccess?.(result)
    ElMessage.success('参考图已上传')
  } catch (error) {
    options.onError?.(error)
    ElMessage.error(error?.message || '上传失败')
  }
}

async function loadVideoConfigs() {
  try {
    videoConfigs.value = await aiAPI.list('video') || []
    const defaultConfig = videoConfigs.value.find((item) => item.is_default && item.is_active !== false)
      || videoConfigs.value.find((item) => item.is_active !== false)
    selectedModel.value = defaultConfig?.default_model || defaultConfig?.model?.[0] || videoModels.value[0]?.value || ''
  } catch (_) {
    videoConfigs.value = []
  }
}

async function loadSharedAssets() {
  assetLibraryLoading.value = true
  try {
    const [characters, scenes, props, audio] = await Promise.all([
      characterLibraryAPI.list({ global: 1, page: 1, page_size: 100 }),
      sceneLibraryAPI.list({ global: 1, page: 1, page_size: 100 }),
      propLibraryAPI.list({ global: 1, page: 1, page_size: 100 }),
      audioLibraryAPI.list({ global: 1, page: 1, page_size: 100 }),
    ])
    globalCharacterAssets.value = characters?.items || []
    globalSceneAssets.value = scenes?.items || []
    globalPropAssets.value = props?.items || []
    globalAudioAssets.value = audio?.items || []
    projectVoiceBindings.value = Object.fromEntries((drama.value?.characters || []).map((item) => [item.id, item.voice_library_id || null]))
  } catch (error) {
    globalCharacterAssets.value = []
    globalSceneAssets.value = []
    globalPropAssets.value = []
    globalAudioAssets.value = []
    ElMessage.error(error?.message || '全局素材库加载失败')
  } finally {
    assetLibraryLoading.value = false
  }
}

function mediaUrl(item) {
  if (item?.local_path) return `/static/${String(item.local_path).replace(/^\//, '')}`
  return item?.video_url || ''
}

async function loadGenerationHistory() {
  if (!selectedVideoId.value) {
    generationHistory.value = []
    return
  }
  try {
    const result = await videosAPI.list({ storyboard_id: selectedVideoId.value, page: 1, page_size: 30 })
    generationHistory.value = result?.items || []
    if (generationHistory.value[0]) restoreGenerationSnapshot(generationHistory.value[0])
    else webSearchEnabled.value = false
  } catch (_) {
    generationHistory.value = []
  }
}

function restoreGenerationSnapshot(item) {
  if (!item) return
  const modeMap = {
    image_to_video: '图生视频',
    omni_reference: '全能参考',
    first_last_frame: '首尾帧',
  }
  if (modeMap[item.generation_mode]) generationMode.value = modeMap[item.generation_mode]
  prompt.value = item.prompt || currentVideo.value?.video_prompt || ''
  selectedModel.value = item.model || selectedModel.value
  duration.value = Number(item.duration) || duration.value
  aspectRatio.value = item.aspect_ratio || aspectRatio.value
  resolution.value = item.resolution || resolution.value
  webSearchEnabled.value = item.generation_config?.web_search === true
  const snapshot = Array.isArray(item.reference_assets) ? item.reference_assets : []
  references.value = snapshot
    .filter((entry) => !['audio', 'voice'].includes(entry.type) && entry.url)
    .map((entry, index) => ({
      key: `${entry.type || 'reference'}:${entry.source || 'snapshot'}:${entry.id ?? index}:${entry.order || index + 1}`,
      type: entry.type || 'upload',
      id: entry.id ?? null,
      source: entry.source || 'snapshot',
      name: entry.name || entry.label || `参考素材 ${index + 1}`,
      url: entry.url,
      tos_url: entry.tos_url || null,
      tos_expires_at: entry.tos_expires_at || null,
      voice: entry.voice ? { ...entry.voice } : null,
    }))
  audioReferences.value = snapshot
    .filter((entry) => ['audio', 'voice'].includes(entry.type) && entry.url)
    .map((audio, index) => ({
      key: `audio:${audio.source || 'snapshot'}:${audio.id ?? index}`,
      type: 'audio', id: audio.id ?? null, source: audio.source || 'snapshot',
      name: audio.name || audio.label || '音频参考', url: audio.url,
      tos_url: audio.tos_url || null, duration: Number(audio.duration) || 0,
      tos_expires_at: audio.tos_expires_at || null,
    }))
}

async function refreshExpiredTosReferences() {
  for (const reference of references.value) {
    if (reference.id && ['global', 'project'].includes(reference.source) && !isTosActive(reference)) {
      const synced = await ensureTosAsset(reference.type, reference)
      reference.url = synced.tos_url
      reference.tos_url = synced.tos_url
      reference.tos_expires_at = synced.tos_expires_at
    }
    if (reference.voice?.id && !isTosActive(reference.voice)) {
      const audio = globalAudioAssets.value.find((item) => Number(item.id) === Number(reference.voice.id))
      if (!audio) throw new Error(`角色绑定音频“${reference.voice.name || reference.voice.id}”已不存在`)
      const syncedAudio = await ensureTosAsset('audio', { ...audio, asset_source: 'global' })
      Object.assign(reference.voice, { url: syncedAudio.tos_url, tos_url: syncedAudio.tos_url, tos_expires_at: syncedAudio.tos_expires_at })
    }
  }
  for (const audio of audioReferences.value) {
    if (audio.id && audio.source === 'global' && !isTosActive(audio)) {
      const original = globalAudioAssets.value.find((item) => Number(item.id) === Number(audio.id))
      if (!original) throw new Error(`音频素材“${audio.name || audio.id}”已不存在`)
      const synced = await ensureTosAsset('audio', { ...original, asset_source: 'global' })
      Object.assign(audio, { url: synced.tos_url, tos_url: synced.tos_url, tos_expires_at: synced.tos_expires_at })
    }
  }
}

function downloadCurrentVideo() {
  const item = latestGeneration.value
  const url = mediaUrl(item)
  if (!url) return ElMessage.warning('当前版本没有可下载的视频文件')
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${(currentVideo.value?.title || 'CineGen-video').replace(/[\\/:*?"<>|]/g, '_')}.mp4`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

async function cancelCurrentGeneration() {
  const item = latestGeneration.value
  if (!item || item.status !== 'processing' || cancellingGeneration.value) return
  try {
    await ElMessageBox.confirm('确定取消当前视频生成任务？火山方舟仅允许取消仍在排队中的任务。', '取消视频任务', { type: 'warning' })
    cancellingGeneration.value = true
    await videosAPI.cancel(item.id)
    await loadGenerationHistory()
    ElMessage.success('取消请求已提交')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '取消失败')
  } finally {
    cancellingGeneration.value = false
  }
}

async function duplicateCurrentVideo() {
  const item = latestGeneration.value
  if (!item || item.status !== 'completed' || duplicatingVideo.value) return
  duplicatingVideo.value = true
  try {
    const result = await videosAPI.duplicate(item.id)
    await reloadDrama(currentEpisode.value?.id, result?.storyboard_id)
    await loadGenerationHistory()
    ElMessage.success('已复制视频、提示词与参考素材')
  } catch (error) {
    ElMessage.error(error?.message || '复制失败')
  } finally {
    duplicatingVideo.value = false
  }
}

async function pollGeneration(taskId) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 30 * 60 * 1000) {
    await new Promise((resolve) => setTimeout(resolve, 2500))
    const task = await taskAPI.get(taskId)
    if (task?.status === 'completed') return task
    if (task?.status === 'failed') throw new Error(task.error || '生成失败')
  }
  throw new Error('生成任务超时，请稍后在历史记录中查看')
}

function handleGenerateClick() {
  if (!canGenerate.value || generationSubmitting.value || generationCooldown.value) return
  if (!generationArmed.value) {
    generationArmed.value = true
    if (generationConfirmTimer) window.clearTimeout(generationConfirmTimer)
    generationConfirmTimer = window.setTimeout(resetGenerationConfirmation, 8000)
    return
  }
  resetGenerationConfirmation()
  void submitVideoGeneration()
}

function beginGenerationCooldown() {
  generationCooldown.value = true
  if (generationCooldownTimer) window.clearTimeout(generationCooldownTimer)
  generationCooldownTimer = window.setTimeout(() => {
    generationCooldown.value = false
    generationCooldownTimer = null
  }, 3000)
}

async function monitorGeneration(taskId, episodeId, videoId) {
  try {
    await pollGeneration(taskId)
    if (Number(selectedVideoId.value) === Number(videoId)) {
      await loadGenerationHistory()
      await reloadDrama(episodeId, videoId)
    }
    ElMessage.success('视频生成完成')
  } catch (error) {
    const message = error?.message || '视频生成失败'
    if (/取消/.test(message)) ElMessage.info('视频生成已取消')
    else {
      generationError.value = message
      ElMessage.error(message)
    }
    if (Number(selectedVideoId.value) === Number(videoId)) await loadGenerationHistory()
  }
}

async function submitVideoGeneration() {
  if (!canGenerate.value || generationSubmitting.value || generationCooldown.value) return
  const submittedEpisodeId = currentEpisode.value?.id
  const submittedVideoId = currentVideo.value?.id
  generationSubmitting.value = true
  generationError.value = ''
  try {
    await refreshExpiredTosReferences()
    const submittedPrompt = generationMode.value === '全能参考'
      ? normalizeOmniPromptSpacing(prompt.value.trim())
      : prompt.value.trim()
    prompt.value = submittedPrompt
    await storyboardsAPI.update(submittedVideoId, { video_prompt: submittedPrompt, duration: duration.value })
    const referenceAssets = references.value.map((item, index) => ({
      type: item.type,
      id: item.id,
      source: item.source || 'project',
      name: item.name,
      url: item.url,
      tos_url: item.tos_url || null,
      tos_expires_at: item.tos_expires_at || null,
      voice: item.voice ? { ...item.voice } : null,
      order: index + 1,
      label: referenceLabel(index),
    }))
    for (const audio of audioReferences.value) {
      referenceAssets.push({
        type: 'audio', id: audio.id, source: audio.source, name: audio.name,
        url: audio.url, tos_url: audio.tos_url || null, tos_expires_at: audio.tos_expires_at || null, duration: Number(audio.duration) || 0,
        label: '音频参考',
      })
    }
    const generationModeValue = generationMode.value === '图生视频'
      ? 'image_to_video'
      : (generationMode.value === '首尾帧' ? 'first_last_frame' : 'omni_reference')
    const body = {
      drama_id: drama.value.id,
      storyboard_id: submittedVideoId,
      generation_mode: generationModeValue,
      prompt: submittedPrompt,
      model: selectedModel.value,
      duration: duration.value,
      aspect_ratio: aspectRatio.value,
      resolution: resolution.value,
      reference_assets: referenceAssets,
      generation_config: {
        generation_mode: generationModeValue,
        duration: duration.value,
        aspect_ratio: aspectRatio.value,
        resolution: resolution.value,
        web_search: webSearchEnabled.value,
      },
    }
    if (generationModeValue === 'image_to_video') body.image_url = references.value[0].url
    if (generationModeValue === 'omni_reference') body.reference_image_urls = references.value.map((item) => item.url)
    if (generationModeValue === 'first_last_frame') {
      body.first_frame_url = references.value[0].url
      body.last_frame_url = references.value[1].url
    }
    const created = await videosAPI.create(body)
    beginGenerationCooldown()
    generationSubmitting.value = false
    await loadGenerationHistory()
    if (created?.task_id) {
      void monitorGeneration(created.task_id, submittedEpisodeId, submittedVideoId)
    }
    ElMessage.success('生成任务已提交')
  } catch (error) {
    const message = error?.message || '视频生成失败'
    if (/取消/.test(message)) {
      generationError.value = ''
      ElMessage.info('视频生成已取消')
    } else {
      generationError.value = message
      ElMessage.error(generationError.value)
    }
    await loadGenerationHistory()
  } finally {
    generationSubmitting.value = false
  }
}

async function reloadDrama(preferredEpisodeId, preferredVideoId) {
  const data = await dramaAPI.get(Number(route.params.id))
  drama.value = data
  const episode = data?.episodes?.find((item) => item.id === preferredEpisodeId) || data?.episodes?.[0]
  if (episode) {
    selectedEpisodeId.value = episode.id
    const video = episode.storyboards?.find((item) => item.id === preferredVideoId) || episode.storyboards?.[0]
    selectedVideoId.value = video?.id || null
    prompt.value = video?.video_prompt || ''
  } else {
    selectedEpisodeId.value = null
    selectedVideoId.value = null
    prompt.value = ''
  }
}

async function createSubproject() {
  const title = subprojectTitle.value.trim()
  if (!title || savingSubproject.value) return
  savingSubproject.value = true
  try {
    const existing = episodes.value.map((episode) => ({
      id: episode.id,
      episode_number: episode.episode_number,
      title: episode.title,
      script_content: episode.script_content,
      description: episode.description,
      duration: episode.duration,
    }))
    const nextNumber = Math.max(0, ...existing.map((episode) => Number(episode.episode_number) || 0)) + 1
    await dramaAPI.saveEpisodes(drama.value.id, [...existing, { episode_number: nextNumber, title }])
    await reloadDrama()
    const created = episodes.value.find((episode) => episode.episode_number === nextNumber)
    if (created) selectEpisode(created)
    showSubprojectDialog.value = false
    ElMessage.success('子项目已创建')
  } catch (error) {
    ElMessage.error(error?.message || '子项目创建失败')
  } finally {
    savingSubproject.value = false
  }
}

async function createVideo() {
  const title = videoTitle.value.trim()
  if (!title || !currentEpisode.value || savingVideo.value) return
  savingVideo.value = true
  try {
    const nextNumber = Math.max(0, ...currentVideos.value.map((item) => Number(item.storyboard_number) || 0)) + 1
    const created = await storyboardsAPI.create({
      episode_id: currentEpisode.value.id,
      storyboard_number: nextNumber,
      title,
      duration: 5,
      creation_mode: 'custom_multi_reference',
      video_prompt: '',
    })
    await reloadDrama(currentEpisode.value.id, created?.id)
    showVideoDialog.value = false
    ElMessage.success('视频已创建')
  } catch (error) {
    ElMessage.error(error?.message || '视频创建失败')
  } finally {
    savingVideo.value = false
  }
}

onMounted(async () => {
  const id = Number(route.params.id)
  if (!id) {
    router.replace('/')
    return
  }
  loading.value = true
  try {
    const data = await dramaAPI.get(id)
    const mode = data?.workflow_mode || data?.metadata?.workflow_mode || 'pipeline'
    if (mode !== 'free_studio') {
      ElMessage.warning('该项目使用剧本合成模式')
      router.replace(`/drama/${id}`)
      return
    }
    drama.value = data
    aspectRatio.value = data?.metadata?.aspect_ratio || '16:9'
    if (data?.episodes?.length) selectEpisode(data.episodes[0])
    await Promise.all([loadVideoConfigs(), loadSharedAssets()])
  } catch (error) {
    ElMessage.error(error?.message || '项目加载失败')
    router.replace('/')
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (generationConfirmTimer) window.clearTimeout(generationConfirmTimer)
  if (generationCooldownTimer) window.clearTimeout(generationCooldownTimer)
})
</script>

<style scoped>
.studio-page {
  min-height: 100vh;
  background: #08080d;
  color: #e4e4e7;
}
.studio-header {
  height: 72px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(113, 113, 122, 0.22);
  background: rgba(12, 12, 18, 0.92);
}
.header-left, .header-actions, .panel-title-row, .dock-title {
  display: flex;
  align-items: center;
}
.header-left { gap: 14px; }
.header-actions { gap: 10px; }
.project-heading h1, .panel-title-row h2 { margin: 0; }
.project-heading h1 { font-size: 18px; }
.mode-kicker, .panel-kicker {
  color: #818cf8;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: .12em;
}
.studio-layout {
  height: calc(100vh - 72px);
  padding: 12px;
  display: grid;
  grid-template-columns: 360px minmax(460px, 1fr) 300px;
  gap: 12px;
  overflow: hidden;
}
.panel-surface {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(113, 113, 122, 0.22);
  border-radius: 14px;
  background: #111118;
  overflow: hidden;
}
.studio-sidebar, .generation-panel { padding: 16px; overflow-y: auto; }
.panel-title-row { justify-content: space-between; margin-bottom: 18px; }
.panel-title-row h2 { margin-top: 4px; font-size: 17px; }
.subproject-list { position: relative; display: grid; gap: 8px; }
.subproject-item {
  padding: 12px;
  display: block;
  width: 100%;
  color: #e4e4e7;
  text-align: left;
  background: #181820;
  border: 1px solid rgba(113, 113, 122, .2);
  border-radius: 10px;
  cursor: pointer;
}
.subproject-item > div { display: grid; gap: 4px; }
.subproject-item small { color: #71717a; font-size: 11px; }
.subproject-item.active, .video-list-item.active {
  border-color: rgba(99, 102, 241, .7);
  background: rgba(99, 102, 241, .13);
}
.empty-block, .stage-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #71717a;
}
.empty-block { min-height: 240px; gap: 10px; }
.compact-empty { min-height: 180px; }
.empty-block .el-icon, .stage-placeholder .el-icon { font-size: 34px; }
.empty-block strong { color: #d4d4d8; }
.empty-block span { max-width: 180px; font-size: 12px; line-height: 1.6; }
.studio-workspace { display: grid; grid-template-rows: auto minmax(0, 1fr) 48px 140px; background: #09090e; }
.preview-header { min-height: 66px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(113, 113, 122, .2); }
.preview-header h2 { margin: 4px 0 0; font-size: 17px; }
.preview-stage { position: relative; min-height: 0; padding: 12px 24px; display: grid; place-items: center; overflow: hidden; background: radial-gradient(circle at 50% 40%, #181824 0, #0a0a0f 56%); }
.preview-stage > video { width: 100%; height: 100%; max-width: 1100px; max-height: 100%; object-fit: contain; border-radius: 10px; background: #000; }
.preview-status { display: flex; flex-direction: column; align-items: center; gap: 9px; color: #a1a1aa; text-align: center; }
.preview-status .el-icon { font-size: 44px; color: #6366f1; }
.preview-status strong { color: #e4e4e7; font-size: 18px; }
.preview-status--failed .el-icon, .preview-status--failed strong { color: #f87171; }
.preview-status--cancelled .el-icon, .preview-status--cancelled strong { color: #b6b6b2; }
.preview-actions {
  box-sizing: border-box;
  height: 48px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: unset;
  padding: 6px 16px;
  border-top: 1px solid rgba(235,235,235,.075);
  background: rgba(14,15,15,.34);
  position: relative;
  margin: 0 !important;
}

.preview-actions-enter-active,
.preview-actions-leave-active { transition: opacity 220ms ease, transform 240ms cubic-bezier(.2,.8,.2,1); }
.preview-actions-enter-from,
.preview-actions-leave-to { opacity: 0; transform: translateY(6px); }
.stage-placeholder { height: 100%; }
.stage-placeholder h2 { margin: 14px 0 6px; color: #d4d4d8; }
.stage-placeholder p { margin: 0; }
.history-strip { padding: 12px 16px 14px; overflow: hidden; border-top: 1px solid rgba(113, 113, 122, .2); background: #101017; }
.history-strip-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; color: #d4d4d8; font-size: 12px; font-weight: 700; }
.history-strip-title small { color: #71717a; font-weight: 500; }
.history-list { position: relative; display: flex; gap: 10px; overflow-x: auto; }
.history-item { flex: 0 0 154px; padding: 6px; display: grid; gap: 5px; background: #181820; border-radius: 9px; }
.history-item video, .history-status { width: 100%; height: 86px; border-radius: 7px; background: #050508; }
.history-item small { color: #71717a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-status { display: grid; place-items: center; color: #a1a1aa; font-size: 12px; }
.history-status--failed { color: #fca5a5; }
.history-empty { height: 92px; display: grid; place-items: center; color: #52525b; border: 1px dashed rgba(113, 113, 122, .25); border-radius: 9px; font-size: 12px; }
.hierarchy-title { position: sticky; top: -16px; z-index: 2; margin: -16px -16px 16px; padding: 16px; background: #111118; border-bottom: 1px solid rgba(113, 113, 122, .15); }
.video-list-section { margin-top: 22px; padding-top: 18px; border-top: 1px solid rgba(113, 113, 122, .22); }
.video-list-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.video-list-title h3 { margin: 4px 0 0; font-size: 15px; }
.video-list { position: relative; display: grid; gap: 8px; }
.video-list-item { width: 100%; padding: 7px; display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 9px; align-items: center; color: #e4e4e7; text-align: left; background: #181820; border: 1px solid rgba(113, 113, 122, .22); border-radius: 10px; cursor: pointer; }
.video-list-thumb { width: 72px; aspect-ratio: 16 / 9; display: grid; place-items: center; color: #52525b; background: #09090e; border-radius: 7px; }
.video-card-info { min-width: 0; display: grid; gap: 5px; }
.video-card-info strong, .video-card-info span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.video-card-info span { color: #71717a; font-size: 12px; }
.empty-video-list { padding: 24px 12px; display: grid; place-items: center; gap: 12px; color: #71717a; font-size: 12px; border: 1px dashed rgba(113, 113, 122, .28); border-radius: 10px; }
.reference-panel { margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(113, 113, 122, .22); }
.dock-title { justify-content: space-between; font-weight: 650; }
.dock-title-main { display: flex; align-items: center; gap: 8px; }
.dock-placeholder {
  height: 84px;
  margin-top: 12px;
  display: grid;
  place-items: center;
  padding: 10px;
  color: #71717a;
  text-align: center;
  font-size: 12px;
  border: 1px dashed rgba(113, 113, 122, .32);
  border-radius: 10px;
}
.reference-list { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.reference-card { position: relative; min-width: 0; }
.reference-card img { width: 100%; aspect-ratio: 1; display: block; object-fit: cover; border-radius: 9px; border: 1px solid rgba(113, 113, 122, .32); }
.reference-card small { display: block; margin-top: 5px; color: #a1a1aa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reference-index { position: absolute; left: 5px; top: 5px; padding: 2px 5px; color: white; font-size: 10px; background: rgba(0,0,0,.72); border-radius: 5px; }
.reference-remove { position: absolute; right: 4px; top: 4px; width: 20px; height: 20px; color: white; border: 0; border-radius: 50%; background: rgba(0,0,0,.7); cursor: pointer; }
.reference-voice-marker { position: absolute; right: 6px; bottom: 25px; display: grid; place-items: center; width: 22px; height: 22px; border: 1px solid rgba(230,230,225,.28); border-radius: 50%; color: #deded9; background: rgba(20,20,20,.72); backdrop-filter: blur(8px); }
.reference-voice-marker.muted { opacity: .48; text-decoration: line-through; }
.reference-voice-toggle { position: absolute; left: 5px; right: 5px; bottom: 25px; width: calc(100% - 36px); min-height: 22px; padding: 2px 5px; overflow: hidden; border: 1px solid rgba(225,225,220,.18); border-radius: 6px; color: #d0d0cc; background: rgba(16,16,16,.7); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; opacity: 0; transition: opacity 160ms ease; }
.reference-card:hover .reference-voice-toggle { opacity: 1; }
.reference-card small { display: flex; align-items: center; gap: 4px; }
.reference-card small .el-tag, .asset-card strong .el-tag, .media-asset-card strong .el-tag { height: 17px; padding: 0 4px; flex: 0 0 auto; border-color: rgba(225,225,220,.22); color: #d4d4d0; background: rgba(225,225,220,.06); font-size: 9px; }
.asset-voice-mark { margin-left: 5px; color: #d7d7d2; }
.preview-state-enter-active { transition: opacity var(--motion-standard) var(--motion-ease-out), transform var(--motion-standard) var(--motion-ease-out); }
.preview-state-leave-active { position: absolute; transition: opacity var(--motion-fast) var(--motion-ease-out), transform var(--motion-fast) var(--motion-ease-out); }
.preview-state-enter-from { opacity: 0; transform: translateY(6px); }
.preview-state-leave-to { opacity: 0; transform: translateY(-3px); }
.studio-list-enter-active,
.studio-list-leave-active,
.studio-list-move { transition: opacity var(--motion-fast) var(--motion-ease-out), transform var(--motion-standard) var(--motion-ease-out); }
.studio-list-enter-active { transition-delay: calc(var(--motion-index, 0) * 40ms); }
.studio-list-enter-from { opacity: 0; transform: translateY(6px); }
.studio-list-leave-to { opacity: 0; transform: scale(.98); }
.studio-list-leave-active { position: absolute; }
@media (prefers-reduced-motion: reduce) {
  .preview-state-enter-active,
  .preview-state-leave-active,
  .studio-list-enter-active,
  .studio-list-leave-active,
  .studio-list-move { transition: opacity var(--motion-fast) var(--motion-ease-out); transition-delay: 0s; }
  .preview-state-enter-from,
  .preview-state-leave-to,
  .studio-list-enter-from,
  .studio-list-leave-to { transform: none; }
  .generate-button.is-confirming .generate-button-sheen {
    animation: none !important;
    opacity: 0;
  }
  .generate-label-enter-active,
  .generate-label-leave-active { transition: opacity 100ms linear !important; }
  .generate-label-enter-from,
  .generate-label-leave-to { transform: none !important; filter: none !important; }
  .generate-button { transition: opacity 120ms linear !important; }
}
.audio-reference-chip { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; margin-top: 10px; padding: 9px 34px 9px 10px; border: 1px solid rgba(225,225,220,.14); border-radius: 10px; background: rgba(225,225,220,.04); }
.audio-reference-chip > .el-icon { color: #cececa; font-size: 20px; }
.audio-reference-chip strong, .audio-reference-chip small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.audio-reference-chip small { margin-top: 2px; color: #a1a1aa; font-size: 10px; }
.audio-reference-chip audio { grid-column: 1 / -1; width: 100%; height: 30px; }
.audio-reference-chip button { position: absolute; right: 8px; top: 8px; color: #d4d4d8; border: 0; background: transparent; cursor: pointer; }
.audio-reference-status { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; padding: 7px 9px; border: 1px solid rgba(225,225,220,.12); border-radius: 9px; color: #aaa; background: rgba(225,225,220,.035); font-size: 11px; }
.audio-reference-status.is-limit { border-color: rgba(235,120,120,.42); color: #e3a5a5; }
.field-block { margin-top: 16px; }
.field-block label { display: block; margin-bottom: 8px; color: #a1a1aa; font-size: 13px; }
.omni-reference-guidance { display: grid; gap: 4px; margin-top: 7px; color: #8f918f; font-size: 11px; line-height: 1.45; }
.omni-reference-guidance kbd, .omni-reference-guidance code { padding: 1px 5px; border: 1px solid rgba(235,235,235,.12); border-radius: 5px; color: #d7d8d4; background: rgba(235,235,235,.055); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.omni-reference-guidance.has-error { color: #c7aaa8; }
:deep(.free-studio-omni-editor .omni-at-editor) { min-height: 154px; max-height: 280px; }
.parameter-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 10px; }
.parameter-grid .model-field { grid-column: 1 / -1; }
.parameter-grid .web-search-field { grid-column: 1 / -1; }
.parameter-grid .el-select { width: 100%; }
.switch-field-row { min-height: 42px; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.switch-field-row label { margin-bottom: 3px; }
.switch-field-row small { display: block; color: #7f817f; font-size: 11px; line-height: 1.4; }
.generate-button {
  width: 100%;
  margin-top: 16px;
  transition:
    background-color 260ms var(--motion-ease-out),
    border-color 260ms var(--motion-ease-out),
    color 220ms var(--motion-ease-out),
    opacity 260ms var(--motion-ease-out),
    filter 260ms var(--motion-ease-out),
    box-shadow 260ms var(--motion-ease-out),
    transform var(--motion-fast) var(--motion-ease-out) !important;
}
:deep(.generate-button > span) { position: static; z-index: auto; }
.generate-button-sheen {
  position: absolute;
  top: -45%;
  bottom: -45%;
  left: -56%;
  z-index: 1;
  width: 46%;
  pointer-events: none;
  opacity: 0;
  transform: translateX(0) skewX(-20deg);
  background: linear-gradient(90deg, transparent 0%, rgba(242,242,237,.06) 12%, rgba(244,244,239,.24) 34%, rgba(248,248,243,.5) 50%, rgba(244,244,239,.24) 66%, rgba(242,242,237,.06) 88%, transparent 100%);
  filter: blur(1.1px);
}
.generate-button-label {
  position: relative;
  z-index: 2;
}
.generate-label-enter-active,
.generate-label-leave-active {
  transition: opacity 150ms var(--motion-ease-out), filter 170ms var(--motion-ease-out), transform 170ms var(--motion-ease-out);
}
.generate-label-enter-from { opacity: 0; filter: blur(2px); transform: translateY(2px); }
.generate-label-leave-to { opacity: 0; filter: blur(1.5px); transform: translateY(-2px); }
.generate-button.is-cooling-down {
  opacity: .7;
  filter: saturate(.12) brightness(.84);
  box-shadow: inset 0 0 0 1px rgba(232,232,227,.025) !important;
}
.generate-button.is-confirming .generate-button-sheen {
  animation: generate-surface-sheen 4.2s cubic-bezier(.4, 0, .2, 1) infinite;
}
.generate-button.is-confirming .generate-button-label {
  color: rgba(248,248,244,.98);
  text-shadow: 0 0 6px rgba(246,246,240,.52), 0 0 15px rgba(234,234,228,.24);
}
@keyframes generate-surface-sheen {
  0%, 5% { transform: translateX(0) skewX(-18deg); opacity: 0; }
  11% { opacity: .68; }
  76% { transform: translateX(340%) skewX(-18deg); opacity: .6; }
  82%, 100% { transform: translateX(340%) skewX(-18deg); opacity: 0; }
}
.generation-error { color: #fca5a5; font-size: 12px; line-height: 1.5; }
.asset-drawer-note { margin: -4px 0 14px; color: #71717a; font-size: 12px; line-height: 1.6; }
.asset-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.asset-card { position: relative; padding: 0 0 9px; overflow: hidden; color: #e4e4e7; background: #181820; border: 1px solid rgba(113, 113, 122, .25); border-radius: 10px; cursor: pointer; }
.asset-card:disabled { cursor: not-allowed; opacity: .5; }
.asset-card img, .asset-no-image { width: 100%; aspect-ratio: 1; object-fit: cover; }
.asset-no-image { display: grid; place-items: center; color: #71717a; background: #0b0b10; }
.asset-card strong { display: block; padding: 8px 8px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.asset-source-tag { position: absolute; left: 7px; top: 7px; }
.media-asset-list { display: flex; flex-direction: column; gap: 9px; }
.inline-audio-upload { margin-bottom: 12px; }
.media-asset-card { width: 100%; display: grid; grid-template-columns: 34px minmax(120px, 1fr) minmax(200px, 300px); align-items: center; gap: 10px; padding: 10px; color: #e4e4e7; text-align: left; background: #181820; border: 1px solid rgba(113,113,122,.25); border-radius: 10px; cursor: pointer; }
.media-asset-card:hover { border-color: rgba(129,140,248,.7); background: rgba(99,102,241,.1); }
.media-asset-card > .el-icon { color: #a5b4fc; font-size: 23px; }
.media-asset-card.voice-card > .el-icon { color: #f0abfc; }
.media-asset-card strong, .media-asset-card small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.media-asset-card small { margin-top: 4px; color: #a1a1aa; }
.media-asset-card audio { width: 100%; height: 32px; }
.voice-binding-panel { margin-bottom: 16px; padding: 12px; border: 1px solid rgba(225,225,220,.13); border-radius: 10px; background: rgba(225,225,220,.035); }
.voice-binding-title { display: flex; align-items: center; gap: 8px; margin-bottom: 9px; }
.voice-binding-title small { color: #898985; font-weight: 400; }
.voice-binding-row { display: grid; grid-template-columns: 110px minmax(0, 1fr) auto; align-items: center; gap: 8px; margin-top: 7px; }
.binding-empty { color: #a1a1aa; line-height: 1.5; }
.upload-drag-icon { font-size: 42px; color: #818cf8; }
@media (max-width: 1180px) {
  .studio-layout { grid-template-columns: 330px minmax(400px, 1fr) 270px; }
}
@media (max-width: 960px) {
  .studio-layout { height: auto; min-height: calc(100vh - 72px); grid-template-columns: 1fr; overflow: visible; }
  .studio-workspace { min-height: 620px; grid-row: 1; }
  .generation-panel { grid-row: 2; }
  .studio-sidebar { grid-row: 3; }
}
</style>
