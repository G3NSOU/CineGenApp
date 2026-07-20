import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('AI config is a dedicated route and only mounts the active tab', () => {
  const content = read('../src/components/AIConfigContent.vue')
  const app = read('../src/App.vue')
  const header = read('../src/components/AppTopHeader.vue')
  const page = read('../src/views/AiConfig.vue')

  for (const tab of ['configs', 'prompts', 'sceneModelMap', 'generation', 'storage', 'sd2_assets']) {
    assert.match(content, new RegExp(`name="${tab}" lazy`))
    assert.match(content, new RegExp(`v-if="activeTab === '${tab}'"`))
  }
  assert.doesNotMatch(app, /showGlobalAiConfig|global-ai-config-dialog/)
  assert.match(header, /name: 'ai-config'/)
  assert.match(header, /returnTo: router\.currentRoute\.value\.fullPath/)
  assert.match(page, /ai-config-header-tabs/)
  assert.match(page, /ai-config-workspace/)
  assert.doesNotMatch(page, /global-ai-config-dialog/)
  assert.match(page, /function returnPath\(\)/)
  assert.equal((content.match(/append-to-body/g) || []).length, 9)
  assert.match(content, /doubao-seedance-2-0-mini-260615/)
  assert.match(content, /火山视频任务/)
  assert.match(header, /v-if="workspace && active === 'projects'"/)
  assert.match(page, /value: 'storage', label: '存储'/)
  assert.match(content, /<TosStorageSettings/)
})

test('free studio exposes persisted video snapshots and lifecycle actions', () => {
  const studio = read('../src/views/FreeStudio.vue')
  const api = read('../src/api/videos.js')

  assert.match(studio, /restoreGenerationSnapshot/)
  assert.match(studio, /downloadCurrentVideo/)
  assert.match(studio, /cancelCurrentGeneration/)
  assert.match(studio, /duplicateCurrentVideo/)
  assert.match(api, /providerTasks/)
  assert.match(api, /duplicate\(id\)/)
})

test('free studio uses the canonical inline @ reference editor instead of placeholder text', () => {
  const studio = read('../src/views/FreeStudio.vue')
  const editor = read('../src/components/UniversalSegmentOmniAtEditor.vue')

  assert.match(studio, /<UniversalSegmentOmniAtEditor/)
  assert.match(studio, /:slots="omniReferenceSlots"/)
  assert.match(studio, /normalizeOmniPromptSpacing/)
  assert.doesNotMatch(studio, /insertReferenceToken|参考图片\$\{index/)
  assert.match(editor, /contentEditable = 'false'/)
  assert.match(editor, /canonicalAt\(index\)/)
  assert.match(editor, /role="listbox"/)
})

test('cross-hierarchy routes retain content animation without animating the background', () => {
  const app = read('../src/App.vue')

  assert.match(app, /const routeTransitionCss = computed\(\(\) => true\)/)
  assert.match(app, /isWorkspaceSectionNavigation\.value \? undefined : 'out-in'/)
  assert.match(app, /<AppBackground \/>/)
})

test('pipeline workflow is presented as 剧集模式 with a highlighted mode badge', () => {
  const list = read('../src/views/FilmList.vue')

  assert.doesNotMatch(list, /剧本合成/)
  assert.match(list, /剧集模式/)
  assert.match(list, /\.badge-workflow[\s\S]*0 0 16px/)
})

test('project return controls share the top navigation material in both appearances', () => {
  const workflowStyles = read('../src/styles/workflow-unification.css')
  const studio = read('../src/views/FreeStudio.vue')

  assert.match(studio, /el-button text class="cgp-context-home"/)
  assert.match(workflowStyles, /\.cgp-context-home\.el-button\.is-text[\s\S]*backdrop-filter: blur\(14px\)/)
  assert.match(workflowStyles, /html\.dark\.cinegen-simple body \.cgp-route-context \.cgp-context-home\.el-button\.is-text[\s\S]*background: #222429/)
})

test('liquid top-bar actions use one glass family across context and global actions', () => {
  const workflowStyles = read('../src/styles/workflow-unification.css')

  assert.match(workflowStyles, /html\.dark:not\(\.cinegen-simple\) body #app \.app-top-header/)
  assert.match(workflowStyles, /\.cgp-route-context > \.el-button/)
  assert.match(workflowStyles, /\.cgp-route-context > \.cgp-context-actions > \.el-button/)
  assert.match(workflowStyles, /\.app-top-header__background\.el-button/)
  assert.match(workflowStyles, /\.app-top-header__ai\.el-button/)
  assert.match(workflowStyles, /height: 38px !important/)
  assert.match(workflowStyles, /background: transparent !important/)
  assert.match(workflowStyles, /backdrop-filter: none !important/)
  assert.doesNotMatch(workflowStyles, /\.cgp-route-context > \.el-button--primary:not\(\.is-plain\)/)
})

test('material library cards and heading actions retain readable surfaces', () => {
  const achromatic = read('../src/styles/achromatic-ui.css')

  assert.match(achromatic, /\.materials-page \.material-card[\s\S]*rgba\(24, 25, 26, \.58\)/)
  assert.match(achromatic, /\.materials-page \.content-heading-actions \.el-button[\s\S]*rgba\(27, 28, 29, \.58\)/)
  assert.match(achromatic, /\.content-heading-actions \.el-button--primary[\s\S]*rgba\(235, 235, 235, \.13\)/)
  assert.match(achromatic, /html\.dark\.cinegen-simple body #app \.materials-page \.content-heading-actions \.el-button/)
  assert.match(achromatic, /background: #222429 !important/)
})
