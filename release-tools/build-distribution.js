const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const repo = path.resolve(__dirname, '..');
const version = require(path.join(repo, 'desktop', 'package.json')).version;
const args = process.argv.slice(2);
const skipWindows = args.includes('--skip-windows');
const outputArg = args.find(arg => !arg.startsWith('--'));
const output = path.resolve(outputArg || path.join(repo, 'release-preview'));
const webName = `CineGen-Web-${version}`;
const winName = `CineGen-Windows-BuildKit-${version}`;
const webDir = path.join(output, webName);
const winDir = path.join(output, winName);

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function copyFile(from, to) { ensureDir(path.dirname(to)); fs.copyFileSync(from, to); }
function copyTree(from, to, filter = () => true, base = from) {
  if (!fs.existsSync(from)) return;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const rel = path.relative(base, source).replaceAll(path.sep, '/');
    if (!filter(rel, entry)) continue;
    const target = path.join(to, path.relative(from, source));
    if (entry.isDirectory()) copyTree(source, target, filter, base);
    else if (entry.isFile()) copyFile(source, target);
  }
}
function copySelected(rootName, entries, destination) {
  const root = path.join(repo, rootName);
  for (const entry of entries) {
    const source = path.join(root, entry);
    if (!fs.existsSync(source)) continue;
    const target = path.join(destination, rootName, entry);
    if (fs.statSync(source).isDirectory()) copyTree(source, target, rel => !/(^|\/)\.DS_Store$/.test(rel));
    else copyFile(source, target);
  }
}
function cleanTarget(target) { if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true }); }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function walkFiles(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(file, result); else if (entry.isFile()) result.push(file);
  }
  return result;
}
function auditCleanTree(dir) {
  const files = walkFiles(dir);
  const forbiddenPath = /(^|\/)(node_modules|data\/drama_generator\.db|\.runtime|example_drama)(\/|$)|\.(db|sqlite|sqlite3|log)$|(^|\/)\.env/i;
  const bad = files.map(file => path.relative(dir, file).replaceAll(path.sep, '/')).filter(rel => forbiddenPath.test(rel));
  if (bad.length) throw new Error(`Forbidden release files in ${path.basename(dir)}:\n${bad.join('\n')}`);

  const secretPatterns = [
    /\bsk-[A-Za-z0-9_-]{20,}\b/g,
    /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  ];
  const hits = [];
  for (const file of files) {
    const buffer = fs.readFileSync(file);
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    for (const pattern of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) hits.push(path.relative(dir, file));
    }
  }
  if (hits.length) throw new Error(`Potential credential values in release tree: ${[...new Set(hits)].join(', ')}`);
  return files.length;
}
function writeManifest(dir, kind, fileCount) {
  const manifest = {
    product: 'CineGen', version, kind,
    created_at: new Date().toISOString(),
    clean_install: true,
    file_count: fileCount,
    excluded: ['user databases', 'API keys', 'projects', 'generated media', 'logs', '.env files', 'example project', 'node_modules'],
  };
  fs.writeFileSync(path.join(dir, 'RELEASE-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
function zipFolder(folder, zipFile) {
  cleanTarget(zipFile);
  const result = spawnSync('ditto', ['-c', '-k', '--norsrc', '--keepParent', folder, zipFile], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Failed to create ${zipFile}`);
}

ensureDir(output);
cleanTarget(webDir);
ensureDir(webDir);
if (!skipWindows) {
  cleanTarget(winDir);
  ensureDir(winDir);
}

const backendEntries = ['src', 'configs', 'migrations', 'scripts', 'test', 'package.json', 'package-lock.json'];
const frontendEntries = ['src', 'public', 'test', 'dist', 'index.html', 'vite.config.js', 'package.json', 'package-lock.json'];

copySelected('backend-node', backendEntries, webDir);
copySelected('frontweb', frontendEntries, webDir);
for (const unwanted of [
  path.join(webDir, 'frontweb', 'public', 'wx.jpg'),
  path.join(webDir, 'frontweb', 'dist', 'wx.jpg'),
]) cleanTarget(unwanted);
ensureDir(path.join(webDir, 'backend-node', 'data', 'storage'));
fs.writeFileSync(path.join(webDir, 'backend-node', 'data', '.gitkeep'), '');
fs.writeFileSync(path.join(webDir, 'backend-node', 'data', 'storage', '.gitkeep'), '');
for (const name of ['LICENSE', 'SECURITY.md']) copyFile(path.join(repo, name), path.join(webDir, name));
copyFile(path.join(repo, 'release-assets', 'THIRD-PARTY-NOTICES.md'), path.join(webDir, 'THIRD-PARTY-NOTICES.md'));
copyTree(path.join(repo, 'release-assets', 'web'), webDir);
let webCount = auditCleanTree(webDir);
writeManifest(webDir, 'web-source-and-prebuilt-frontend', webCount);

if (!skipWindows) {
  copySelected('backend-node', backendEntries, winDir);
  copySelected('frontweb', frontendEntries.filter(x => x !== 'dist'), winDir);
  for (const unwanted of [path.join(winDir, 'frontweb', 'public', 'wx.jpg')]) cleanTarget(unwanted);
  copySelected('desktop', [
    'main.js', 'preload.js', 'package.json', 'package-lock.json', 'electron-builder-win.json',
    'scripts/copy-backend.js', 'scripts/copy-front.js', 'scripts/clean-win-unpacked.js',
    'scripts/build-icons-win.js', 'scripts/prepare-ffmpeg-win.js',
    'scripts/audit-packaged-app.js', 'scripts/dist-win.ps1', 'scripts/initial-migrations',
    'assets/cinegen-icon.png',
  ], winDir);
  for (const name of ['LICENSE', 'SECURITY.md']) copyFile(path.join(repo, name), path.join(winDir, name));
  copyFile(path.join(repo, 'release-assets', 'THIRD-PARTY-NOTICES.md'), path.join(winDir, 'THIRD-PARTY-NOTICES.md'));
  copyTree(path.join(repo, 'release-assets', 'windows'), winDir);
  let winCount = auditCleanTree(winDir);
  writeManifest(winDir, 'windows-x64-native-build-kit', winCount);
}

const webZip = path.join(output, `${webName}.zip`);
const winZip = path.join(output, `${winName}.zip`);
zipFolder(webDir, webZip);
if (!skipWindows) zipFolder(winDir, winZip);

const dmgSource = path.join(repo, 'desktop', 'release', `CineGen-${version}-mac-arm64.dmg`);
if (!fs.existsSync(dmgSource)) throw new Error(`Missing macOS DMG: ${dmgSource}`);
const dmgTarget = path.join(output, path.basename(dmgSource));
copyFile(dmgSource, dmgTarget);

const distributables = skipWindows ? [webZip, dmgTarget] : [webZip, dmgTarget, winZip];
const sums = distributables.map(file => `${sha256(file)}  ${path.basename(file)}`).join('\n') + '\n';
fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), sums);
const windowsLine = skipWindows ? '' : `- \`${path.basename(winZip)}\`：Windows x64 本机构建包与 Agent 文档。\n`;
fs.writeFileSync(path.join(output, 'README-交付清单.md'), `# CineGen ${version} 交付清单\n\n- \`${path.basename(webZip)}\`：网页版源码、预构建前端和双版本教程。\n- \`${path.basename(dmgTarget)}\`：macOS arm64 未签名安装包。\n${windowsLine}- \`SHA256SUMS.txt\`：当前可分发文件的 SHA-256。\n\n版本目录用于人工检查；对外分发优先使用 ZIP/DMG。所有包均排除了用户数据库、项目、素材、日志、API Key、示例项目和 node_modules。\n`);
console.log(`Distribution ready: ${output}`);
console.log(sums);
