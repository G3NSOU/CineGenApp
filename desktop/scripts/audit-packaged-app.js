const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

const cliArgs = process.argv.slice(2);
const platformArg = cliArgs.find(arg => arg.startsWith('--platform='));
const targetPlatform = platformArg ? platformArg.slice('--platform='.length) : process.platform;
const resourcesArg = cliArgs.find(arg => !arg.startsWith('--'));
const resources = resourcesArg || (targetPlatform === 'win32'
  ? path.join(__dirname, '..', 'release', 'win-unpacked', 'resources')
  : undefined);

if (!resources || !fs.existsSync(resources)) throw new Error(`Resources directory not found: ${resources || '(missing)'}`);
const archive = path.join(resources, 'app.asar');
if (!fs.existsSync(archive)) throw new Error(`app.asar not found: ${archive}`);

const forbidden = /^\/?(?:backend-app\/(?:data|logs?)(?:\/|$)|example_drama(?:\/|$))|\.(?:db|sqlite|sqlite3|log)$|(?:^|\/)\.env/i;
const badPaths = asar.listPackage(archive).filter(item => forbidden.test(item));
if (badPaths.length) throw new Error(`Forbidden packaged paths:\n${badPaths.join('\n')}`);

const config = asar.extractFile(archive, 'backend-app/configs/config.yaml').toString('utf8');
const compiledRoot = path.join(resources, 'frontweb', 'dist');
const credentialPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /(?:api[_-]?key|access[_-]?token|secret[_-]?key)\s*[=:]\s*["'][^"'\s]{12,}["']/ig,
];

function scanText(label, text) {
  for (const pattern of credentialPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) throw new Error(`Potential credential detected in ${label}`);
  }
}
scanText('bundled config', config);

for (const entry of asar.listPackage(archive)) {
  const normalized = entry.replace(/^\//, '');
  if (normalized !== 'main.js' && !/^backend-app\/.+\.(?:js|json|ya?ml|sql|md|txt)$/i.test(normalized)) continue;
  scanText(`app.asar/${normalized}`, asar.extractFile(archive, normalized).toString('utf8'));
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else {
      const buffer = fs.readFileSync(file);
      if (!buffer.includes(0)) scanText(path.relative(resources, file), buffer.toString('utf8'));
    }
  }
}
// 强制校验：前端产物必须包含 index.html，否则 Electron 窗口会白屏
const indexHtml = path.join(compiledRoot, 'index.html');
if (!fs.existsSync(indexHtml)) {
  throw new Error(`Frontend index.html missing at: ${indexHtml}\n请确认 copy-front 已执行且 extraResources 生效`);
}
const indexSize = fs.statSync(indexHtml).size;
if (indexSize < 200) {
  throw new Error(`Frontend index.html suspiciously small (${indexSize} bytes) at: ${indexHtml}`);
}
console.log(`Frontend check passed: ${indexHtml} (${indexSize} bytes)`);

walk(compiledRoot);

for (const name of targetPlatform === 'win32' ? ['ffmpeg.exe', 'ffprobe.exe'] : ['ffmpeg', 'ffprobe']) {
  if (!fs.existsSync(path.join(resources, 'ffmpeg', name))) throw new Error(`Missing bundled ${name}`);
}
console.log('Release audit passed: no database, logs, example project, .env, or credential-like values found.');
