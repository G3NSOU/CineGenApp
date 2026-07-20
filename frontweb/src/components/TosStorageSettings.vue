<template>
  <div class="tos-settings" v-loading="loading">
    <header class="storage-heading">
      <div>
        <span class="storage-kicker">OBJECT STORAGE</span>
        <h2>参考素材存储</h2>
        <p>为本地参考图生成 Seedance 可读取的公网地址。TOS 可用时优先上传，否则自动回退当前第三方图床。</p>
      </div>
      <div class="storage-status" :class="statusClass">
        <span class="status-dot" />
        <div>
          <strong>{{ statusTitle }}</strong>
          <small>{{ statusDescription }}</small>
        </div>
      </div>
    </header>

    <section class="routing-strip" aria-label="图片存储回退顺序">
      <div class="route-step" :class="{ active: form.enabled }">
        <span>01</span><div><strong>火山 TOS</strong><small>配置完整时优先</small></div>
      </div>
      <span class="route-arrow">→</span>
      <div class="route-step active">
        <span>02</span><div><strong>第三方图床</strong><small>TOS 未配置或失败时</small></div>
      </div>
      <span class="route-arrow">→</span>
      <div class="route-step">
        <span>03</span><div><strong>Base64</strong><small>仅支持的模型链路兜底</small></div>
      </div>
    </section>

    <div class="storage-grid">
      <section class="storage-section credentials-section">
        <div class="section-heading">
          <div><span>连接信息</span><small>凭据仅保存在后端配置文件，前端不会读取原文</small></div>
          <el-switch v-model="form.enabled" inline-prompt active-text="启用" inactive-text="停用" />
        </div>

        <el-form label-position="top" class="storage-form">
          <div class="form-pair">
            <el-form-item label="AccessKey ID（火山 IAM）">
              <el-input v-model="form.access_key_id" type="password" show-password autocomplete="off" :placeholder="remote.access_key_preview || '通常以 AKLT 开头，不是方舟 API Key'" />
            </el-form-item>
            <el-form-item label="Secret Access Key（与 AK 成对）">
              <el-input v-model="form.secret_access_key" type="password" show-password autocomplete="new-password" :placeholder="remote.has_secret_access_key ? '已保存；留空保持不变' : '请输入 Secret Access Key'" />
            </el-form-item>
          </div>
          <div class="form-pair">
            <el-form-item label="Endpoint">
              <el-input v-model="form.endpoint" placeholder="tos-cn-beijing.volces.com" />
            </el-form-item>
            <el-form-item label="Region">
              <el-input v-model="form.region" placeholder="cn-beijing" />
            </el-form-item>
          </div>
          <div class="form-pair">
            <el-form-item label="Bucket">
              <el-input v-model="form.bucket" placeholder="例如 cinegen-assets" />
            </el-form-item>
            <el-form-item label="对象前缀">
              <el-input v-model="form.prefix" placeholder="cinegen/references" />
            </el-form-item>
          </div>
        </el-form>
      </section>

      <section class="storage-section delivery-section">
        <div class="section-heading">
          <div><span>访问方式</span><small>默认生成私有桶预签名链接，也支持公开桶或自定义域名</small></div>
        </div>
        <el-form label-position="top" class="storage-form">
          <el-form-item label="公开访问域名（可选）">
            <el-input v-model="form.public_base_url" placeholder="例如 https://assets.example.com；私有桶请留空" />
            <p class="field-note">留空时生成最长 7 天的 TOS 预签名 GET URL；填写后直接拼接对象路径。</p>
          </el-form-item>
          <el-form-item label="签名有效期">
            <el-select v-model="form.signed_url_expires_seconds" style="width: 100%">
              <el-option label="24 小时" :value="86400" />
              <el-option label="3 天" :value="259200" />
              <el-option label="7 天（推荐）" :value="604800" />
            </el-select>
          </el-form-item>
          <el-form-item label="STS Security Token（可选）">
            <el-input v-model="form.security_token" type="password" show-password autocomplete="new-password" :placeholder="remote.has_security_token ? '已保存；留空保持不变' : '使用临时凭据时填写'" />
          </el-form-item>
        </el-form>

        <div class="storage-help">
          <strong>建议最小权限</strong>
          <span>限制到目标 Bucket 和前缀，并授予 HeadBucket、PutObject、GetObject。若使用公开域名，请自行确认桶策略或 CDN 可读取新对象。</span>
          <a href="https://www.volcengine.com/docs/6349/113481" target="_blank" rel="noopener noreferrer">查看 TOS Node.js SDK 文档</a>
        </div>
      </section>
    </div>

    <footer class="storage-actions">
      <span v-if="remote.source === 'environment'">当前凭据由环境变量接管，页面保存不会覆盖环境变量。</span>
      <span v-else>保存后立即生效，无需重启后端。</span>
      <div>
        <el-button :loading="testing" :disabled="!form.enabled || testing" @click="testConnection">测试连接</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存存储配置</el-button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { storageSettingsAPI } from '@/api/settings'

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const remote = reactive({
  ready: false,
  source: 'config',
  missing: [],
  access_key_preview: '',
  has_secret_access_key: false,
  has_security_token: false,
})
const form = reactive({
  enabled: false,
  endpoint: 'tos-cn-beijing.volces.com',
  region: 'cn-beijing',
  bucket: '',
  prefix: 'cinegen/references',
  public_base_url: '',
  signed_url_expires_seconds: 604800,
  access_key_id: '',
  secret_access_key: '',
  security_token: '',
})

const statusClass = computed(() => form.enabled && remote.ready ? 'is-ready' : form.enabled ? 'is-incomplete' : 'is-fallback')
const statusTitle = computed(() => form.enabled && remote.ready ? 'TOS 优先' : form.enabled ? '等待完整配置' : '第三方图床')
const statusDescription = computed(() => {
  if (form.enabled && remote.ready) return remote.source === 'environment' ? '环境变量已生效' : `${remote.bucket || form.bucket} 已就绪`
  if (form.enabled) return remote.missing?.length ? `缺少 ${remote.missing.join('、')}` : '保存并测试后启用'
  return '保持现有兼容链路'
})

function applyRemote(data = {}) {
  Object.assign(remote, data)
  for (const key of ['enabled', 'endpoint', 'region', 'bucket', 'prefix', 'public_base_url', 'signed_url_expires_seconds']) {
    if (data[key] !== undefined) form[key] = data[key]
  }
  form.access_key_id = ''
  form.secret_access_key = ''
  form.security_token = ''
}

function payload() {
  return {
    enabled: form.enabled,
    endpoint: form.endpoint.trim(),
    region: form.region.trim(),
    bucket: form.bucket.trim(),
    prefix: form.prefix.trim(),
    public_base_url: form.public_base_url.trim(),
    signed_url_expires_seconds: form.signed_url_expires_seconds,
    access_key_id: form.access_key_id.trim() || undefined,
    secret_access_key: form.secret_access_key.trim() || undefined,
    security_token: form.security_token.trim() || undefined,
  }
}

async function load() {
  loading.value = true
  try { applyRemote(await storageSettingsAPI.getTos()) }
  catch (error) { ElMessage.error(error?.message || '读取 TOS 配置失败') }
  finally { loading.value = false }
}

async function save() {
  saving.value = true
  try {
    applyRemote(await storageSettingsAPI.updateTos(payload()))
    ElMessage.success(form.enabled ? 'TOS 存储配置已保存' : '已停用 TOS，将继续使用第三方图床')
  } catch (error) { ElMessage.error(error?.message || '保存失败') }
  finally { saving.value = false }
}

async function testConnection() {
  if (testing.value) return
  testing.value = true
  try {
    const result = await storageSettingsAPI.testTos(payload())
    ElMessage.success(`连接成功：Bucket ${result.bucket}`)
  } catch (error) { ElMessage.error(error?.message || 'TOS 连接失败') }
  finally { testing.value = false }
}

onMounted(load)
</script>

<style scoped>
.tos-settings { min-height: 100%; padding: 2px 4px 28px; color: rgba(238,239,240,.9); }
.storage-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:28px; margin-bottom:18px; }
.storage-kicker { display:block; margin-bottom:7px; font-size:10px; font-weight:700; letter-spacing:.16em; color:rgba(228,230,232,.46); }
.storage-heading h2 { margin:0 0 7px; font-size:22px; }
.storage-heading p { max-width:760px; margin:0; font-size:13px; line-height:1.65; color:rgba(226,228,230,.58); }
.storage-status { min-width:210px; display:flex; align-items:center; gap:11px; padding:11px 14px; border:1px solid rgba(238,240,242,.11); border-radius:13px; background:rgba(20,21,22,.34); }
.status-dot { width:8px; height:8px; border-radius:50%; background:rgba(226,228,230,.36); box-shadow:0 0 0 5px rgba(226,228,230,.04); }
.storage-status.is-ready .status-dot { background:rgba(240,242,244,.92); box-shadow:0 0 13px rgba(240,242,244,.5); }
.storage-status strong,.storage-status small { display:block; }
.storage-status strong { font-size:12px; }.storage-status small { margin-top:2px; font-size:10.5px; color:rgba(222,224,226,.48); }
.routing-strip { display:flex; align-items:center; gap:10px; margin-bottom:16px; padding:12px; border:1px solid rgba(238,240,242,.09); border-radius:14px; background:rgba(16,17,18,.22); }
.route-step { flex:1; display:flex; align-items:center; gap:10px; min-width:0; padding:9px 11px; border:1px solid rgba(236,238,240,.07); border-radius:10px; background:rgba(236,238,240,.025); opacity:.58; }
.route-step.active { opacity:1; background:rgba(236,238,240,.065); border-color:rgba(240,242,244,.14); }
.route-step > span { font:600 10px ui-monospace,monospace; color:rgba(230,232,234,.44); }.route-step strong,.route-step small { display:block; }.route-step strong { font-size:12px; }.route-step small { margin-top:2px; font-size:10.5px; color:rgba(220,222,224,.46); }
.route-arrow { color:rgba(230,232,234,.28); }
.storage-grid { display:grid; grid-template-columns:minmax(0,1.18fr) minmax(360px,.82fr); gap:16px; }
.storage-section { padding:18px; border:1px solid rgba(238,240,242,.1); border-radius:16px; background:rgba(18,19,20,.31); backdrop-filter:blur(15px) saturate(106%); box-shadow:inset 0 1px 0 rgba(248,249,250,.035); }
.section-heading { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:16px; }.section-heading span,.section-heading small { display:block; }.section-heading span { font-size:14px; font-weight:650; }.section-heading small { margin-top:3px; font-size:11px; color:rgba(220,222,224,.46); }
.form-pair { display:grid; grid-template-columns:1fr 1fr; gap:14px; }.storage-form :deep(.el-form-item) { margin-bottom:15px; }.storage-form :deep(.el-form-item__label) { color:rgba(232,234,236,.68); font-size:11px; }
.field-note { margin:6px 0 0; color:rgba(216,218,220,.44); font-size:10.5px; line-height:1.5; }
.storage-help { display:flex; flex-direction:column; gap:5px; margin-top:2px; padding:12px; border:1px solid rgba(236,238,240,.08); border-radius:11px; background:rgba(236,238,240,.035); }.storage-help strong { font-size:11.5px; }.storage-help span,.storage-help a { font-size:10.5px; line-height:1.55; color:rgba(218,220,222,.5); }.storage-help a { width:fit-content; color:rgba(238,240,242,.76); }
.storage-actions { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-top:16px; padding:13px 4px 0; border-top:1px solid rgba(236,238,240,.07); }.storage-actions > span { font-size:11px; color:rgba(218,220,222,.48); }.storage-actions > div { display:flex; gap:9px; }
@media (max-width: 1080px) { .storage-grid { grid-template-columns:1fr; }.storage-heading { align-items:stretch; }.storage-status { min-width:190px; } }
@media (prefers-reduced-motion: reduce) { .tos-settings * { transition-duration:.01ms !important; } }
</style>
