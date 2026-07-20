'use strict';

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function resolveEndpointUrl(baseUrl, endpoint, fallbackEndpoint = '') {
  const value = String(endpoint || fallbackEndpoint || '').trim();
  if (!value) return String(baseUrl || '').trim().replace(/\/+$/, '');
  if (isAbsoluteHttpUrl(value)) return value;

  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) return value;
  return `${base}/${value.replace(/^\/+/, '')}`;
}

function replaceTaskId(endpoint, taskId) {
  const encoded = encodeURIComponent(String(taskId));
  return String(endpoint || '')
    .replace(/\{taskId\}/gi, encoded)
    .replace(/\{task_id\}/gi, encoded)
    .replace(/\{id\}/gi, encoded);
}

function appendSearchParams(endpoint, values) {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(values || {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

module.exports = {
  appendSearchParams,
  isAbsoluteHttpUrl,
  replaceTaskId,
  resolveEndpointUrl,
};
