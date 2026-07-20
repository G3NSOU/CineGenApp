const settingsService = require('../services/settingsService');
const response = require('../response');
const { loadConfig } = require('../config');
const { resolveVideoGenerationTimeoutMinutes } = require('../config/videoGeneration');
const tosStorageService = require('../services/tosStorageService');

function tosErrorMessage(error) {
  const requestId = String(error?.requestId || '').trim();
  const suffix = requestId ? `（Request ID: ${requestId}）` : '';
  if (error?.ec === '0002-00000020') {
    return `AccessKey ID 不存在。请使用火山引擎 IAM“访问控制 → 密钥管理”中创建的 AccessKey ID，不要填写方舟 API Key 或其他 Key ID ${suffix}`.trim();
  }
  const message = String(error?.message || '').trim();
  if (message) return `${message}${suffix}`;
  const code = String(error?.code || '').trim();
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    return `TOS HTTPS 直连超时，请检查当前网络是否允许直连该 Endpoint ${suffix}`.trim();
  }
  if (error?.statusCode === 403) {
    return `TOS 拒绝了请求（HTTP 403），请检查 AccessKey/Secret Access Key 是否成对、账号是否有 Bucket 权限 ${suffix}`.trim();
  }
  return `${code || 'TOS 未返回可识别的错误信息'}${suffix}`;
}

function getLanguage(cfg) {
  return (req, res) => {
    const language = settingsService.getLanguage(cfg);
    response.success(res, { language });
  };
}

function updateLanguage(cfg, log) {
  return (req, res) => {
    const lang = req.body?.language;
    if (lang !== 'zh' && lang !== 'en') {
      return response.badRequest(res, '语言参数错误，只支持 zh 或 en');
    }
    const out = settingsService.updateLanguage(cfg, log, lang);
    if (!out.ok) return response.badRequest(res, out.error);
    const message = lang === 'en' ? 'Language switched to English' : '语言已切换为中文';
    response.success(res, { message, language: lang });
  };
}

/** GET /settings/generation — 获取生成相关全局设置 */
function getGenerationSettings(db) {
  return (req, res) => {
    const concurrency = settingsService.getGlobalSetting(db, 'pipeline_concurrency', 3);
    const video_concurrency = settingsService.getGlobalSetting(db, 'pipeline_video_concurrency', 3);
    const video_generation_timeout_minutes = resolveVideoGenerationTimeoutMinutes(loadConfig());
    response.success(res, { concurrency, video_concurrency, video_generation_timeout_minutes });
  };
}

/** PUT /settings/generation — 更新生成相关全局设置 */
function updateGenerationSettings(db) {
  return (req, res) => {
    const { concurrency, video_concurrency } = req.body || {};
    if (concurrency !== undefined) {
      const n = Number(concurrency);
      if (!Number.isInteger(n) || n < 1 || n > 20) {
        return response.badRequest(res, '图片并发数需为 1-20 之间的整数');
      }
      settingsService.setGlobalSetting(db, 'pipeline_concurrency', n);
    }
    if (video_concurrency !== undefined) {
      const n = Number(video_concurrency);
      if (!Number.isInteger(n) || n < 1 || n > 20) {
        return response.badRequest(res, '视频并发数需为 1-20 之间的整数');
      }
      settingsService.setGlobalSetting(db, 'pipeline_video_concurrency', n);
    }
    const saved = settingsService.getGlobalSetting(db, 'pipeline_concurrency', 3);
    const saved_video = settingsService.getGlobalSetting(db, 'pipeline_video_concurrency', 3);
    const video_generation_timeout_minutes = resolveVideoGenerationTimeoutMinutes(loadConfig());
    response.success(res, {
      concurrency: saved,
      video_concurrency: saved_video,
      video_generation_timeout_minutes,
    });
  };
}

function getTosStorageSettings(cfg) {
  return (_req, res) => response.success(res, tosStorageService.publicTosConfig(cfg));
}

function updateTosStorageSettings(cfg, log) {
  return (req, res) => {
    try {
      const current = tosStorageService.normalizeTosConfig(cfg?.tos_storage || {});
      const next = tosStorageService.normalizeTosConfig(req.body || {}, current);
      const result = settingsService.updateTosStorageConfig(cfg, log, next);
      if (!result.ok) return response.badRequest(res, result.error);
      response.success(res, tosStorageService.publicTosConfig(cfg));
    } catch (error) {
      response.badRequest(res, error.message);
    }
  };
}

function testTosStorageSettings(cfg) {
  let inFlight = null;
  return async (req, res) => {
    if (inFlight) {
      return response.badRequest(res, 'TOS 连接测试正在进行，请等待当前请求完成');
    }
    try {
      const current = tosStorageService.resolveTosConfig(cfg).config;
      const candidate = tosStorageService.normalizeTosConfig(req.body || {}, current);
      inFlight = tosStorageService.testTosConnection(candidate);
      response.success(res, await inFlight);
    } catch (error) {
      response.badRequest(res, `TOS 连接失败：${tosErrorMessage(error)}`);
    } finally {
      inFlight = null;
    }
  };
}

module.exports = function settingsRoutes(db, cfg, log) {
  return {
    getLanguage: getLanguage(cfg),
    updateLanguage: updateLanguage(cfg, log),
    getGenerationSettings: getGenerationSettings(db),
    updateGenerationSettings: updateGenerationSettings(db),
    getTosStorageSettings: getTosStorageSettings(cfg),
    updateTosStorageSettings: updateTosStorageSettings(cfg, log),
    testTosStorageSettings: testTosStorageSettings(cfg),
  };
};

module.exports.tosErrorMessage = tosErrorMessage;
