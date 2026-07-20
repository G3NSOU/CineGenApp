// 与 Go UploadService 对齐：保存到 local_path，返回 url / local_path
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { randomUUID } = require('crypto');
const tosStorageService = require('./tosStorageService');

/**
 * 用 Node.js 原生 http/https 模块下载 URL 到 Buffer。
 * 比 native fetch 在 Electron 打包环境中更可靠，支持自动跟随 301/302 重定向（最多 5 次）。
 */
function downloadBufferViaNodeHttp(url, timeoutMs = 30000, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CineGen/1.4.25)',
        'Accept': 'image/*,*/*',
      },
      timeout: timeoutMs,
    };
    const req = mod.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const location = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsed.protocol}//${parsed.host}${res.headers.location}`;
        res.resume();
        return resolve(downloadBufferViaNodeHttp(location, timeoutMs, redirectCount + 1));
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || '' }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`Download timeout after ${timeoutMs}ms`)); });
    req.on('error', reject);
    req.end();
  });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** @returns {{ dir: string, relPrefix: string }} */
function resolveCategoryPaths(storagePath, category, projectSubdir) {
  const sub = projectSubdir && String(projectSubdir).trim();
  if (sub) {
    const relPrefix = `${sub.replace(/\\/g, '/')}/${category}`;
    return { dir: path.join(storagePath, sub, category), relPrefix };
  }
  return { dir: path.join(storagePath, category), relPrefix: category };
}

function uploadFile(storagePath, baseUrl, log, fileBuffer, originalName, mimeType, category, projectSubdir = null) {
  const { dir: categoryPath, relPrefix } = resolveCategoryPaths(storagePath, category, projectSubdir);
  ensureDir(categoryPath);
  const ext = path.extname(originalName) || '.png';
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const name = `${timestamp}_${randomUUID()}${ext}`;
  const filePath = path.join(categoryPath, name);
  fs.writeFileSync(filePath, fileBuffer);
  const relativePath = `${relPrefix}/${name}`.replace(/\\/g, '/');
  const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/${relativePath}` : `/static/${relativePath}`;
  log.info('File uploaded', { path: filePath, url });
  return { url, local_path: relativePath };
}

/**
 * 将远程/Base64 图片保存到本地 storage，避免 AI 链接过期后无法访问
 * @param {string} storagePath - 存储根目录（如 ./data/storage）
 * @param {string} imageUrl - 图片地址（http(s) URL 或 data:image/xxx;base64,...）
 * @param {string} category - 子目录：characters / scenes / images
 * @param {object} log - logger
 * @param {string} [prefix] - 文件名前缀，如 ig_123
 * @param {string|null} [projectSubdir] - 如 projects/0001_20250324_剧名 或 library，与 uploadFile 一致
 * @returns {Promise<string|null>} 相对路径如 characters/xxx.png，失败返回 null
 */
async function downloadImageToLocal(storagePath, imageUrl, category, log, prefix = '', projectSubdir = null) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  const { dir: categoryPath, relPrefix } = resolveCategoryPaths(storagePath, category, projectSubdir);
  try {
    ensureDir(categoryPath);
    let buffer;
    let ext = 'png';
    if (imageUrl.startsWith('data:')) {
      const match = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) {
        log.warn('downloadImageToLocal: invalid data URL');
        return null;
      }
      buffer = Buffer.from(match[2], 'base64');
      ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    } else {
      // 使用 Node.js 原生 http/https 模块下载，比 native fetch 在 Electron 打包环境更可靠
      // 失败自动重试最多 3 次
      let lastErr;
      let contentType = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await downloadBufferViaNodeHttp(imageUrl, 30000);
          buffer = result.buffer;
          contentType = result.contentType;
          break;
        } catch (e) {
          lastErr = e;
          log.warn('downloadImageToLocal: 下载失败，准备重试', { category, attempt, error: e.message, url: imageUrl.slice(0, 100) });
          if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
        }
      }
      if (!buffer) {
        log.warn('downloadImageToLocal: 3次重试均失败', { category, error: lastErr?.message });
        return null;
      }
      ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    }
    const name = `${prefix}${prefix ? '_' : ''}${randomUUID().slice(0, 8)}.${ext}`;
    const filePath = path.join(categoryPath, name);
    fs.writeFileSync(filePath, buffer);
    const relativePath = `${relPrefix}/${name}`.replace(/\\/g, '/');
    log.info('Image saved to local', { category, local_path: relativePath, projectSubdir: projectSubdir || '(root)' });
    return relativePath;
  } catch (e) {
    log.warn('downloadImageToLocal error', { category, error: e.message });
    return null;
  }
}

function getImageProxyUploadSettings() {
  try {
    const cfg = require('../config').loadConfig();
    const ip = cfg?.image_proxy || {};
    return {
      uploadUrl: (ip.upload_url || 'https://imageproxy.zhongzhuan.chat/api/upload').trim(),
      timeoutMs: Math.max(5000, Number(ip.upload_timeout_seconds ?? 45) * 1000),
      maxAttempts: Math.max(1, Math.min(5, Number(ip.upload_max_attempts ?? 2))),
    };
  } catch (_) {
    return {
      uploadUrl: 'https://imageproxy.zhongzhuan.chat/api/upload',
      timeoutMs: 45000,
      maxAttempts: 2,
    };
  }
}

/**
 * 将图片 Buffer 上传到中转图床，返回公开访问 URL。
 * 接口：POST https://imageproxy.zhongzhuan.chat/api/upload  (multipart/form-data, field: file)
 * 响应：{ url: "https://imageproxy.zhongzhuan.chat/api/proxy/image/<hash>", created: ... }
 * 失败自动重试；成功返回 string URL，全部失败返回 null。
 */
async function uploadToThirdPartyImageProxy(imageBuffer, mimeType, log, tag) {
  const { uploadUrl, timeoutMs, maxAttempts } = getImageProxyUploadSettings();
  const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  const ext = extMap[mimeType] || 'jpg';
  const filename = `ref_${Date.now()}.${ext}`;
  log.info('[图床上传] ▶ 开始', {
    tag,
    filename,
    size_kb: Math.round(imageBuffer.length / 1024),
    upload_url: uploadUrl,
    timeout_sec: Math.round(timeoutMs / 1000),
    max_attempts: maxAttempts,
  });
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const t0 = Date.now();
    try {
      const boundary = 'imgproxy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const headerLine = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
      const footerLine = `\r\n--${boundary}--\r\n`;
      const body = Buffer.concat([Buffer.from(headerLine, 'utf-8'), imageBuffer, Buffer.from(footerLine, 'utf-8')]);
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const raw = await res.text();
      const ms = Date.now() - t0;
      if (!res.ok) {
        log.warn('[图床上传] 失败', { tag, attempt, status: res.status, ms, body: raw.slice(0, 200) });
        if (attempt < maxAttempts) continue;
        return null;
      }
      const data = JSON.parse(raw);
      const url = data?.url || null;
      if (url) { log.info('[图床上传] ✓ 成功', { tag, attempt, url, ms }); return url; }
      log.warn('[图床上传] 响应无 url 字段', { tag, attempt, ms, raw: raw.slice(0, 200) });
      if (attempt < maxAttempts) continue;
      return null;
    } catch (err) {
      const errMsg = err.name === 'TimeoutError' || err.name === 'AbortError'
        ? `请求超时（${Math.round(timeoutMs / 1000)}s）`
        : err.message;
      log.warn('[图床上传] 请求异常', { tag, attempt, ms: Date.now() - t0, err: errMsg });
      if (attempt < maxAttempts) continue;
      return null;
    }
  }
  return null;
}

/**
 * TOS 已配置时优先上传；未配置或上传失败时自动回退现有第三方图床。
 * deps 只用于隔离外部网络的回归测试，生产环境使用官方 TOS SDK 和原有图床实现。
 */
async function uploadToPreferredStorage(imageBuffer, mimeType, log, tag, deps = {}) {
  const tosUpload = deps.tosUpload || tosStorageService.uploadBufferToTos;
  const fallbackUpload = deps.fallbackUpload || uploadToThirdPartyImageProxy;
  try {
    const tosResult = await tosUpload(imageBuffer, mimeType, tag);
    if (tosResult?.url) {
      log.info('[TOS 上传] ✓ 成功', {
        tag,
        bucket: tosResult.bucket,
        key: tosResult.key,
        access: tosResult.url.includes('X-Tos-') ? 'presigned' : 'public',
      });
      return tosResult.url;
    }
    if (!tosResult?.skipped) log.warn('[TOS 上传] 未返回 URL，回退第三方图床', { tag });
  } catch (error) {
    log.warn('[TOS 上传] 失败，回退第三方图床', {
      tag,
      code: error.code || error.name || 'TOS_ERROR',
      error: error.message,
      request_id: error.requestId || null,
    });
  }
  return fallbackUpload(imageBuffer, mimeType, log, tag);
}

async function uploadToImageProxy(imageBuffer, mimeType, log, tag) {
  return uploadToPreferredStorage(imageBuffer, mimeType, log, tag);
}

/**
 * 将前端可能提交的本地引用安全地还原为 storage 根目录内的文件。
 * 支持 local_path、/static/...、static/...、localhost /static URL，拒绝目录穿越
 * 和 storage 之外的绝对路径，避免把任意系统文件上传到第三方图床。
 */
function resolveStorageFilePath(storagePath, localPathOrUrl) {
  if (!storagePath || !localPathOrUrl || typeof localPathOrUrl !== 'string') return null;
  const root = path.resolve(storagePath);
  let raw = localPathOrUrl.trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('asset://')) return null;

  let cameFromStaticUrl = false;
  if (/^https?:\/\//i.test(raw)) {
    let parsed;
    try { parsed = new URL(raw); } catch (_) { return null; }
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const isLocalHost = host === 'localhost'
      || host === '::1'
      || host === '0.0.0.0'
      || /^127\./.test(host)
      || /^10\./.test(host)
      || /^192\.168\./.test(host)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
      || host.endsWith('.local');
    if (!isLocalHost) return null;
    const markerIndex = parsed.pathname.toLowerCase().indexOf('/static/');
    if (markerIndex < 0) return null;
    raw = parsed.pathname.slice(markerIndex + '/static/'.length);
    cameFromStaticUrl = true;
  } else {
    raw = raw.split(/[?#]/, 1)[0];
  }

  try { raw = decodeURIComponent(raw); } catch (_) { return null; }
  raw = raw.replace(/\\/g, '/');
  const isStaticPath = /^\/?static\//i.test(raw);
  if (isStaticPath) raw = raw.replace(/^\/?static\//i, '');

  let candidate;
  if (!cameFromStaticUrl && !isStaticPath && path.isAbsolute(raw)) {
    candidate = path.resolve(raw);
  } else {
    const relative = raw.replace(/^\/+/, '');
    if (!relative) return null;
    candidate = path.resolve(root, relative);
  }

  const insideRoot = candidate === root || candidate.startsWith(root + path.sep);
  if (!insideRoot) return null;
  return {
    filePath: candidate,
    relativePath: path.relative(root, candidate).replace(/\\/g, '/'),
  };
}

/**
 * 将本地文件路径或 localhost URL 的图片上传到图床，返回公网 URL。
 * - localPath: 相对 storagePath 的路径，如 "images/ig_xxx.jpg"
 * - localhostUrl: 类似 "http://localhost:5679/static/images/ig_xxx.jpg" 的 URL
 * 两者传其中一个即可；失败返回 null。
 */
async function uploadLocalImageToProxy(storagePath, localPathOrUrl, log, tag) {
  try {
    const resolved = resolveStorageFilePath(storagePath, localPathOrUrl);
    const filePath = resolved?.filePath || null;
    let mimeType = 'image/jpeg';
    if (!filePath || !fs.existsSync(filePath)) {
      log.warn('[图床上传] 本地文件不存在或路径不安全', { tag, filePath, input: String(localPathOrUrl || '').slice(0, 120) });
      return null;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    mimeType = mimeMap[ext] || 'image/jpeg';
    const buf = fs.readFileSync(filePath);
    return await uploadToImageProxy(buf, mimeType, log, tag);
  } catch (e) {
    log.warn('[图床上传] uploadLocalImageToProxy 异常', { tag, err: e.message });
    return null;
  }
}

module.exports = {
  uploadFile,
  downloadImageToLocal,
  uploadToImageProxy,
  uploadToPreferredStorage,
  uploadToThirdPartyImageProxy,
  uploadLocalImageToProxy,
  resolveStorageFilePath,
};
