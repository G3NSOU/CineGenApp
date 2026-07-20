const { randomUUID } = require('crypto');
const { TosClient } = require('@volcengine/tos-sdk');
const { loadConfig } = require('../config');

const DEFAULT_TOS = Object.freeze({
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
});

function cleanEndpoint(value) {
  return String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function cleanPrefix(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.{2,}/g, '.');
}

function normalizeTosConfig(input = {}, existing = {}) {
  const source = { ...DEFAULT_TOS, ...(existing || {}), ...(input || {}) };
  const keepExistingSecret = input.secret_access_key == null || input.secret_access_key === '';
  const keepExistingToken = input.security_token == null || input.security_token === '';
  const expires = Math.max(900, Math.min(604800, Number(source.signed_url_expires_seconds) || 604800));
  return {
    enabled: source.enabled === true,
    endpoint: cleanEndpoint(source.endpoint) || DEFAULT_TOS.endpoint,
    region: String(source.region || DEFAULT_TOS.region).trim(),
    bucket: String(source.bucket || '').trim(),
    prefix: cleanPrefix(source.prefix) || DEFAULT_TOS.prefix,
    public_base_url: String(source.public_base_url || '').trim().replace(/\/+$/, ''),
    signed_url_expires_seconds: Math.round(expires),
    access_key_id: String(source.access_key_id || '').trim(),
    secret_access_key: input.clear_secret_access_key
      ? ''
      : String(keepExistingSecret ? (existing.secret_access_key || '') : input.secret_access_key).trim(),
    security_token: input.clear_security_token
      ? ''
      : String(keepExistingToken ? (existing.security_token || '') : input.security_token).trim(),
  };
}

function applyEnvironmentOverrides(config) {
  const env = process.env;
  const hasEnvCredentials = Boolean(env.TOS_ACCESS_KEY_ID || env.TOS_SECRET_ACCESS_KEY || env.TOS_SECRET_KEY);
  if (!hasEnvCredentials) return { config, source: 'config' };
  return {
    source: 'environment',
    config: normalizeTosConfig({
      ...config,
      enabled: true,
      access_key_id: env.TOS_ACCESS_KEY_ID || config.access_key_id,
      secret_access_key: env.TOS_SECRET_ACCESS_KEY || env.TOS_SECRET_KEY || config.secret_access_key,
      security_token: env.TOS_SECURITY_TOKEN || config.security_token,
      endpoint: env.TOS_ENDPOINT || config.endpoint,
      region: env.TOS_REGION || config.region,
      bucket: env.TOS_BUCKET || config.bucket,
      prefix: env.TOS_PREFIX || config.prefix,
      public_base_url: env.TOS_PUBLIC_BASE_URL || config.public_base_url,
    }, config),
  };
}

function resolveTosConfig(rawConfig = null) {
  const appConfig = rawConfig || loadConfig();
  return applyEnvironmentOverrides(normalizeTosConfig(appConfig?.tos_storage || {}));
}

function missingFields(config) {
  const required = ['access_key_id', 'secret_access_key', 'endpoint', 'region', 'bucket'];
  return required.filter((key) => !String(config?.[key] || '').trim());
}

function publicTosConfig(rawConfig = null) {
  const { config, source } = resolveTosConfig(rawConfig);
  const missing = missingFields(config);
  return {
    enabled: config.enabled,
    endpoint: config.endpoint,
    region: config.region,
    bucket: config.bucket,
    prefix: config.prefix,
    public_base_url: config.public_base_url,
    signed_url_expires_seconds: config.signed_url_expires_seconds,
    access_key_preview: config.access_key_id
      ? `${config.access_key_id.slice(0, 5)}••••${config.access_key_id.slice(-4)}`
      : '',
    has_access_key_id: Boolean(config.access_key_id),
    has_secret_access_key: Boolean(config.secret_access_key),
    has_security_token: Boolean(config.security_token),
    ready: config.enabled && missing.length === 0,
    missing,
    source,
    fallback: 'third_party_image_proxy',
  };
}

function createClient(config, options = {}) {
  const client = new TosClient({
    accessKeyId: config.access_key_id,
    accessKeySecret: config.secret_access_key,
    stsToken: config.security_token || undefined,
    endpoint: config.endpoint,
    region: config.region,
    secure: true,
    requestTimeout: options.requestTimeout ?? 45000,
    connectionTimeout: options.connectionTimeout ?? 10000,
    maxRetryCount: options.maxRetryCount ?? 1,
  });

  // @volcengine/tos-sdk 2.9.1 内置 Axios 0.21。当系统 HTTPS_PROXY 的地址本身
  // 是 http:// 协议时，它会把 HTTPS TOS 请求错误交给 HTTP transport，导致：
  // Protocol "http:" not supported. Expected "https:"
  // TOS 中国大陆公网 Endpoint 可直连；仅对这个 SDK 实例关闭环境代理，
  // 不修改 CineGen 其他 AI 供应商的代理行为。
  if (client.axiosInst?.defaults) client.axiosInst.defaults.proxy = false;
  return client;
}

function mimeExtension(mimeType) {
  return ({
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
  })[String(mimeType || '').toLowerCase()] || 'jpg';
}

function buildObjectKey(config, mimeType, tag) {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeTag = String(tag || 'reference').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || 'reference';
  return [config.prefix, yyyy, mm, `${safeTag}-${randomUUID()}.${mimeExtension(mimeType)}`]
    .filter(Boolean)
    .join('/');
}

function encodeObjectKey(key) {
  return String(key).split('/').map(encodeURIComponent).join('/');
}

function objectAccessUrl(client, config, key) {
  if (config.public_base_url) return `${config.public_base_url}/${encodeObjectKey(key)}`;
  return client.getPreSignedUrl({
    bucket: config.bucket,
    key,
    method: 'GET',
    expires: config.signed_url_expires_seconds,
  });
}

async function testTosConnection(inputConfig, clientFactory = createClient) {
  const config = normalizeTosConfig(inputConfig || {});
  const missing = missingFields(config);
  if (missing.length) throw new Error(`TOS 配置不完整：${missing.join(', ')}`);
  // 连接测试只发送一次 HeadBucket，失败后不由 SDK 重试。
  const client = clientFactory(config, {
    maxRetryCount: 0,
    requestTimeout: 12000,
    connectionTimeout: 5000,
  });
  const result = await client.headBucket(config.bucket);
  return {
    ok: true,
    bucket: config.bucket,
    region: config.region,
    request_id: result?.requestId || result?.headers?.['x-tos-request-id'] || null,
  };
}

async function uploadBufferToTos(buffer, mimeType, tag, options = {}) {
  const resolved = options.config
    ? { config: normalizeTosConfig(options.config), source: 'provided' }
    : resolveTosConfig();
  const config = resolved.config;
  if (!config.enabled) return { skipped: true, reason: 'disabled' };
  const missing = missingFields(config);
  if (missing.length) return { skipped: true, reason: 'incomplete', missing };
  const client = (options.clientFactory || createClient)(config, {
    maxRetryCount: 0,
    requestTimeout: 20000,
    connectionTimeout: 5000,
  });
  const key = buildObjectKey(config, mimeType, tag);
  await client.putObject({
    bucket: config.bucket,
    key,
    body: buffer,
    contentLength: buffer.length,
    contentType: mimeType,
  });
  return {
    skipped: false,
    url: objectAccessUrl(client, config, key),
    bucket: config.bucket,
    key,
    source: resolved.source,
  };
}

module.exports = {
  DEFAULT_TOS,
  normalizeTosConfig,
  resolveTosConfig,
  publicTosConfig,
  missingFields,
  buildObjectKey,
  objectAccessUrl,
  createClient,
  testTosConnection,
  uploadBufferToTos,
};
