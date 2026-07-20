const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set([
  '.git', 'node_modules', 'dist', 'release', 'release-preview', 'release-staging',
  'backend-app', 'backend-app-secure', 'frontweb-dist', 'vendor', '.runtime',
]);
const forbiddenFile = /(?:^|\/)(?:backend-node\/data|example_drama)(?:\/|$)|\.(?:db|sqlite|sqlite3|log|dmg|exe|zip|p12|pfx)$/i;
const credentialPatterns = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { name: 'OpenAI-style key', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'cloud access key', pattern: /\b(?:AKIA[A-Z0-9]{16}|AKLT[A-Za-z0-9]{16,}|AKTP[A-Za-z0-9]{16,})\b/g },
];
const safeLiteral = /^(?:test|fake|example|placeholder|redacted|your[-_]|dummy|mock|none|null|undefined)/i;
const configSecret = /^\s*["']?(?:api[_-]?key|access[_-]?key(?:_id)?|secret[_-]?(?:access[_-]?)?key|security[_-]?token)["']?\s*[:=]\s*["']?([^"'\s,}]+)["']?\s*[,}]?\s*$/i;
const errors = [];

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function auditFile(file) {
  const rel = relative(file);
  if (forbiddenFile.test(rel)) errors.push(`${rel}: forbidden release or user-data file`);
  const stat = fs.statSync(file);
  if (stat.size > 20 * 1024 * 1024) errors.push(`${rel}: file exceeds 20 MiB`);
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) return;
  const text = buffer.toString('utf8');
  for (const { name, pattern } of credentialPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) errors.push(`${rel}: possible ${name}`);
  }
  if (!/\.(?:ya?ml|json|env|ini|toml)$/i.test(rel) || /(?:^|\/)test\//.test(rel) || rel.endsWith('package-lock.json')) return;
  for (const [index, line] of text.split('\n').entries()) {
    const match = line.match(configSecret);
    const value = match?.[1] || '';
    if (value && !safeLiteral.test(value)) errors.push(`${rel}:${index + 1}: non-empty credential-like config value`);
  }
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile()) auditFile(file);
  }
}

walk(root);
if (errors.length) {
  console.error(`Source audit failed:\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('Source audit passed: no user data, distributables, large files, private keys, or credential-like values found.');
