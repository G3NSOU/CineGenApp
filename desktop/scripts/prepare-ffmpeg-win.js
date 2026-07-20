const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error(`CineGen Windows build requires win32-x64, got ${process.platform}-${process.arch}`);
}

const ffmpegSource = require('ffmpeg-static');
const ffprobeModule = require('@derhuerst/ffprobe-static');
const ffprobeSource = typeof ffprobeModule === 'string' ? ffprobeModule : ffprobeModule.path;
const dest = path.join(__dirname, '..', 'vendor', 'win32-x64');

fs.mkdirSync(dest, { recursive: true });
for (const [name, source] of [['ffmpeg.exe', ffmpegSource], ['ffprobe.exe', ffprobeSource]]) {
  if (!source || !fs.existsSync(source)) throw new Error(`${name} static binary is missing`);
  const target = path.join(dest, name);
  fs.copyFileSync(source, target);
  execFileSync(target, ['-version'], { stdio: 'ignore' });
}

const encoders = execFileSync(path.join(dest, 'ffmpeg.exe'), ['-hide_banner', '-encoders'], { encoding: 'utf8' });
if (!encoders.includes('libx264')) throw new Error('Bundled Windows ffmpeg does not provide libx264');

for (const [label, packageJson] of [
  ['ffmpeg', require.resolve('ffmpeg-static/package.json')],
  ['ffprobe', require.resolve('@derhuerst/ffprobe-static/package.json')],
]) {
  for (const name of ['LICENSE', 'LICENSE.md']) {
    const candidate = path.join(path.dirname(packageJson), name);
    if (fs.existsSync(candidate)) fs.copyFileSync(candidate, path.join(dest, `LICENSE-${label}-${name}`));
  }
}
console.log(`Prepared verified Windows FFmpeg binaries in ${dest}`);
