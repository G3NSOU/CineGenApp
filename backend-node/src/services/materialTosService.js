const fs = require('fs');
const path = require('path');
const { resolveStorageFilePath } = require('./uploadService');
const tosStorageService = require('./tosStorageService');
const materialVersionService = require('./materialVersionService');

const MATERIALS = Object.freeze({
  'global:character': { table: 'character_libraries', url: 'image_url', kind: 'image' },
  'global:scene': { table: 'scene_libraries', url: 'image_url', kind: 'image' },
  'global:prop': { table: 'prop_libraries', url: 'image_url', kind: 'image' },
  'global:audio': { table: 'audio_libraries', url: 'audio_url', kind: 'audio' },
  'project:character': { table: 'characters', url: 'image_url', kind: 'image' },
  'project:scene': { table: 'scenes', url: 'image_url', kind: 'image' },
  'project:prop': { table: 'props', url: 'image_url', kind: 'image' },
});

const MIME_BY_EXT = Object.freeze({
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.webm': 'audio/webm',
});

function materialSpec(source, type) {
  return MATERIALS[`${String(source || '').toLowerCase()}:${String(type || '').toLowerCase()}`] || null;
}

function isActiveTos(item, now = Date.now()) {
  const expiresAt = Date.parse(item?.tos_expires_at || '');
  return Boolean(item?.tos_url && Number.isFinite(expiresAt) && expiresAt > now);
}

function mimeFor(item, filePath, spec, responseType = '') {
  const explicit = String(item?.mime_type || responseType || '').split(';')[0].trim().toLowerCase();
  if (explicit && (explicit.startsWith('image/') || explicit.startsWith('audio/'))) return explicit;
  return MIME_BY_EXT[path.extname(filePath || item?.local_path || item?.[spec.url] || '').toLowerCase()]
    || (spec.kind === 'audio' ? 'audio/mpeg' : 'image/jpeg');
}

async function loadRemote(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('素材地址不是可上传的 HTTP(S) URL');
  const response = await fetch(parsed, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`下载素材失败：HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 100 * 1024 * 1024) throw new Error('素材超过 100MB，无法同步到 TOS');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 100 * 1024 * 1024) throw new Error('素材超过 100MB，无法同步到 TOS');
  return { buffer, contentType: response.headers.get('content-type') || '' };
}

async function syncMaterial(db, cfg, log, { source, type, id }) {
  const spec = materialSpec(source, type);
  if (!spec) throw new Error('不支持的素材类型或来源');
  const item = db.prepare(`SELECT * FROM ${spec.table} WHERE id = ? AND deleted_at IS NULL`).get(Number(id));
  if (!item) throw new Error('素材不存在');
  if (isActiveTos(item)) return { ...item, already_synced: true };

  const storageRoot = path.resolve(cfg?.storage?.local_path || './data/storage');
  const localInput = item.local_path || item[spec.url];
  const resolved = resolveStorageFilePath(storageRoot, localInput);
  let buffer;
  let filePath = '';
  let remoteContentType = '';
  if (resolved?.filePath && fs.existsSync(resolved.filePath)) {
    filePath = resolved.filePath;
    buffer = fs.readFileSync(filePath);
  } else if (/^https?:\/\//i.test(String(item[spec.url] || ''))) {
    const remote = await loadRemote(item[spec.url]);
    buffer = remote.buffer;
    remoteContentType = remote.contentType;
  } else {
    throw new Error('本地素材文件不存在，无法同步到 TOS');
  }

  const mimeType = mimeFor(item, filePath, spec, remoteContentType);
  const tagName = item.name || item.location || `${type}-${item.id}`;
  const uploaded = await tosStorageService.uploadBufferToTos(buffer, mimeType, `material-${type}-${tagName}`);
  if (!uploaded?.url) {
    const reason = uploaded?.reason === 'disabled' ? 'TOS 尚未启用' : 'TOS 配置不完整';
    throw new Error(reason);
  }
  const { config } = tosStorageService.resolveTosConfig();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.min(604800, Number(config.signed_url_expires_seconds) || 604800) * 1000);
  db.prepare(`UPDATE ${spec.table}
    SET tos_url = ?, tos_object_key = ?, tos_synced_at = ?, tos_expires_at = ?, updated_at = ?
    WHERE id = ?`).run(uploaded.url, uploaded.key || null, now.toISOString(), expiresAt.toISOString(), now.toISOString(), Number(id));
  if (String(source).toLowerCase() === 'global' && materialVersionService.specFor(type)) {
    materialVersionService.updateCurrentTos(db, String(type).toLowerCase(), id, {
      tos_url: uploaded.url,
      tos_object_key: uploaded.key || null,
      tos_synced_at: now.toISOString(),
      tos_expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    });
  }
  log.info('[素材 TOS 同步] ✓ 成功', { source, type, id: Number(id), key: uploaded.key, expires_at: expiresAt.toISOString() });
  return db.prepare(`SELECT * FROM ${spec.table} WHERE id = ?`).get(Number(id));
}

module.exports = { materialSpec, isActiveTos, syncMaterial };
