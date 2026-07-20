const response = require('../response');
const videoService = require('../services/videoService');
const taskService = require('../services/taskService');
const { normalizeAspectRatioForApi } = require('../services/videoClient');

const FREE_STUDIO_GENERATION_MODES = new Set(['image_to_video', 'omni_reference', 'first_last_frame']);

function normalizeOmniReferencePrompt(value, referenceCount) {
  const prompt = String(value || '')
    .replace(/@图片(\d+)(?=[\u4e00-\u9fffA-Za-z「『【（])/gu, '@图片$1 ')
    .replace(/[ \t]+\n/g, '\n');
  const count = Math.max(0, Number(referenceCount) || 0);
  const numbers = [];
  const seen = new Set();
  for (const match of prompt.matchAll(/@图片(\d+)/g)) {
    const number = Number(match[1]);
    if (!seen.has(number)) {
      seen.add(number);
      numbers.push(number);
    }
  }
  const invalid = numbers.filter((number) => number < 1 || number > count);
  const missing = Array.from({ length: count }, (_, index) => index + 1)
    .filter((number) => !seen.has(number));
  if (invalid.length) return { error: `提示词包含无效引用：${invalid.map((n) => `@图片${n}`).join('、')}` };
  if (missing.length) return { error: `以下参考图尚未在提示词中引用：${missing.map((n) => `@图片${n}`).join('、')}` };
  return { prompt, numbers };
}

function normalizeGenerationInputs(body = {}) {
  const generationMode = body.generation_mode == null || body.generation_mode === ''
    ? null
    : String(body.generation_mode).trim();
  if (generationMode && !FREE_STUDIO_GENERATION_MODES.has(generationMode)) {
    return { error: 'generation_mode 无效' };
  }
  let imageUrl = body.image_url ?? null;
  let firstFrameUrl = body.first_frame_url ?? body.first_frame_local_path ?? null;
  let lastFrameUrl = body.last_frame_url ?? body.last_frame_local_path ?? null;
  let referenceImages = Array.isArray(body.reference_image_urls)
    ? body.reference_image_urls.slice(0, 9).map((value) => value == null ? '' : String(value).trim())
    : [];
  if (generationMode === 'image_to_video') {
    if (!imageUrl) return { error: '图生视频需要一张主图' };
    firstFrameUrl = null;
    lastFrameUrl = null;
    referenceImages = [];
  } else if (generationMode === 'omni_reference') {
    if (referenceImages.length === 0) return { error: '全能参考至少需要一张参考图' };
    const emptyIndex = referenceImages.findIndex((value) => !value);
    if (emptyIndex >= 0) return { error: `参考图片${emptyIndex + 1}缺少有效地址，不能压缩数组以免 @图片序号错位` };
    imageUrl = null;
    firstFrameUrl = null;
    lastFrameUrl = null;
  } else if (generationMode === 'first_last_frame') {
    if (!firstFrameUrl || !lastFrameUrl) return { error: '首尾帧模式需要同时提供首帧和尾帧' };
    imageUrl = null;
    referenceImages = [];
  }
  return { generationMode, imageUrl, firstFrameUrl, lastFrameUrl, referenceImages };
}

function collectAudioReferences(referenceAssets = [], legacyVoiceUrl = '') {
  const out = [];
  for (const asset of Array.isArray(referenceAssets) ? referenceAssets : []) {
    if (asset?.type === 'audio' && asset.url) {
      out.push({ type: 'audio', url: String(asset.url), duration: Number(asset.duration) || 0 });
    }
    if (asset?.voice && !asset.voice.muted && asset.voice.url) {
      out.push({
        type: 'voice',
        url: String(asset.voice.url),
        duration: Number(asset.voice.duration) || 0,
        after_image_order: Number(asset.order) || null,
      });
    }
  }
  if (!out.length && legacyVoiceUrl) out.push({ type: 'voice', url: String(legacyVoiceUrl), duration: 0 });
  return out;
}

function routes(db, log) {
  return {
    list: (req, res) => {
      try {
        const query = { ...req.query };
        const { items, total, page, pageSize } = videoService.list(db, query);
        response.successWithPagination(res, items, total, page, pageSize);
      } catch (err) {
        log.error('videos list', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    create: (req, res) => {
      try {
        const body = req.body || {};
        const now = new Date().toISOString();
        const dramaId = Number(body.drama_id) || 0;
        const storyboardId = body.storyboard_id != null ? Number(body.storyboard_id) : null;
        const provider = body.provider || 'chatfire';
        let prompt = body.prompt || '';
        const style = (body.style || '').toString().trim();
        if (style) {
          const baseLower = String(prompt || '').toLowerCase();
          const styleLower = style.toLowerCase();
          if (!baseLower.includes(styleLower)) {
            prompt = prompt ? `${prompt}. Style: ${style}` : `Style: ${style}`;
          }
        }
        const model = body.model ?? null;
        const duration = body.duration ?? null;
        // 画幅：请求体归一化（全角冒号等）后写入 DB；未传则从 drama.metadata 读取并同样归一化
        let aspectRatio = null;
        if (body.aspect_ratio != null && String(body.aspect_ratio).trim() !== '') {
          aspectRatio = normalizeAspectRatioForApi(body.aspect_ratio);
        }
        if (!aspectRatio && dramaId) {
          try {
            const dramaRow = db.prepare('SELECT metadata FROM dramas WHERE id = ? AND deleted_at IS NULL').get(dramaId);
            if (dramaRow && dramaRow.metadata) {
              const meta = typeof dramaRow.metadata === 'string' ? JSON.parse(dramaRow.metadata) : dramaRow.metadata;
              if (meta && meta.aspect_ratio) aspectRatio = normalizeAspectRatioForApi(meta.aspect_ratio);
            }
          } catch (_) {}
        }
        const resolution = body.resolution ?? null;
        const seed = body.seed != null ? Number(body.seed) : null;
        const cameraFixed = body.camera_fixed != null ? (body.camera_fixed ? 1 : 0) : null;
        // CineGen 的 Seedance 工作流固定输出无水印视频；不接受前端或旧快照重新开启。
        const watermark = 0;
        const normalizedInputs = normalizeGenerationInputs(body);
        if (normalizedInputs.error) return response.badRequest(res, normalizedInputs.error);
        const {
          generationMode,
          imageUrl: normalizedImageUrl,
          firstFrameUrl: normalizedFirstFrameUrl,
          lastFrameUrl: normalizedLastFrameUrl,
          referenceImages: normalizedReferenceImages,
        } = normalizedInputs;
        if (generationMode === 'omni_reference') {
          const normalizedPrompt = normalizeOmniReferencePrompt(prompt, normalizedReferenceImages.length);
          if (normalizedPrompt.error) return response.badRequest(res, normalizedPrompt.error);
          prompt = normalizedPrompt.prompt;
        }
        // 多图模式：sxy，存 JSON 数组到 reference_image_urls
        const refImagesJson = normalizedReferenceImages.length ? JSON.stringify(normalizedReferenceImages) : null;
        const referenceAssets = Array.isArray(body.reference_assets) ? body.reference_assets.slice(0, 15) : [];
        const audioReferences = collectAudioReferences(referenceAssets, body.voice_reference_url);
        if (audioReferences.length > 3) return response.badRequest(res, '音频参考最多 3 条');
        const totalAudioDuration = audioReferences.reduce((sum, item) => sum + Math.max(0, Number(item.duration) || 0), 0);
        if (totalAudioDuration > 15.001) return response.badRequest(res, '音频参考总时长不能超过 15 秒');
        const referenceAssetsJson = referenceAssets.length
          ? JSON.stringify(referenceAssets)
          : null;
        const rawGenerationConfig = body.generation_config && typeof body.generation_config === 'object'
          ? body.generation_config
          : {};
        const generationConfigJson = JSON.stringify({
          ...rawGenerationConfig,
          // 默认关闭；只有严格的 boolean true 才会开启，避免字符串 "false" 被误判。
          web_search: rawGenerationConfig.web_search === true,
        });
        const voiceReferenceUrl = body.voice_reference_url ? String(body.voice_reference_url).trim() : null;
        // 输入校验完成后再创建任务，避免非法请求留下永远无法执行的 pending 任务。
        const task = taskService.createTask(db, log, 'video_generation', String(body.drama_id || ''));
        db.prepare(
          `INSERT INTO video_generations (drama_id, storyboard_id, provider, prompt, model, duration, aspect_ratio, resolution, seed, camera_fixed, watermark, image_url, first_frame_url, last_frame_url, reference_image_urls, generation_mode, reference_assets, generation_config, voice_reference_url, status, task_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?)`
        ).run(dramaId, storyboardId, provider, prompt, model, duration, aspectRatio, resolution, seed, cameraFixed, watermark, normalizedImageUrl, normalizedFirstFrameUrl, normalizedLastFrameUrl, refImagesJson, generationMode, referenceAssetsJson, generationConfigJson, voiceReferenceUrl, task.id, now, now);
        const videoGenId = db.prepare('SELECT last_insert_rowid() as id').get().id;
        setImmediate(() => {
          videoService.processVideoGeneration(db, log, videoGenId);
        });
        const item = videoService.getById(db, videoGenId);
        response.created(res, item || { id: videoGenId, task_id: task.id, status: 'processing' });
      } catch (err) {
        log.error('videos create', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    providerTasks: async (req, res) => {
      try {
        response.success(res, await videoService.listProviderTasks(db, req.query || {}));
      } catch (err) {
        response.badRequest(res, err.message);
      }
    },
    deleteProviderTask: async (req, res) => {
      try {
        response.success(res, await videoService.deleteProviderTask(db, req.params.task_id, req.query?.model));
      } catch (err) {
        response.badRequest(res, err.message);
      }
    },
    cancel: async (req, res) => {
      try {
        const result = await videoService.cancelGeneration(db, log, req.params.id);
        if (!result) return response.notFound(res, '记录不存在');
        response.success(res, result);
      } catch (err) {
        response.badRequest(res, err.message);
      }
    },
    duplicate: (req, res) => {
      try {
        const result = videoService.duplicateAsStoryboard(db, log, req.params.id);
        if (!result) return response.notFound(res, '记录不存在');
        response.created(res, result);
      } catch (err) {
        response.badRequest(res, err.message);
      }
    },
    get: (req, res) => {
      try {
        const item = videoService.getById(db, req.params.id);
        if (!item) return response.notFound(res, '记录不存在');
        response.success(res, item);
      } catch (err) {
        log.error('videos get', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    delete: (req, res) => {
      try {
        const ok = videoService.deleteById(db, log, req.params.id);
        if (!ok) return response.notFound(res, '记录不存在');
        response.success(res, { message: '删除成功' });
      } catch (err) {
        log.error('videos delete', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    fromImage: (req, res) => {
      try {
        const task = taskService.createTask(db, log, 'video_generation', req.params.image_gen_id);
        response.success(res, { task_id: task.id });
      } catch (err) {
        log.error('videos fromImage', { error: err.message });
        response.internalError(res, err.message);
      }
    },
    episodeBatch: (req, res) => {
      try {
        response.success(res, []);
      } catch (err) {
        log.error('videos episode batch', { error: err.message });
        response.internalError(res, err.message);
      }
    },
  };
}

module.exports = routes;
module.exports.normalizeGenerationInputs = normalizeGenerationInputs;
module.exports.normalizeOmniReferencePrompt = normalizeOmniReferencePrompt;
module.exports.collectAudioReferences = collectAudioReferences;
