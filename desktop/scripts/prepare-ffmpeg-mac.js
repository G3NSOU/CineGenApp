const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error(`CineGen macOS build requires darwin-arm64, got ${process.platform}-${process.arch}`);
}

const ffmpegSource = require('ffmpeg-static');
const ffprobeModule = require('@derhuerst/ffprobe-static');
const ffprobeSource = typeof ffprobeModule === 'string' ? ffprobeModule : ffprobeModule.path;
const dest = path.join(__dirname, '..', 'vendor', 'darwin-arm64');

fs.mkdirSync(dest, { recursive: true });
for (const [name, source] of [['ffmpeg', ffmpegSource], ['ffprobe', ffprobeSource]]) {
  if (!source || !fs.existsSync(source)) throw new Error(`${name} static binary is missing`);
  const target = path.join(dest, name);
  fs.copyFileSync(source, target);
  fs.chmodSync(target, 0o755);
  execFileSync(target, ['-version'], { stdio: 'ignore' });
}

const encoders = execFileSync(path.join(dest, 'ffmpeg'), ['-hide_banner', '-encoders'], { encoding: 'utf8' });
if (!encoders.includes('libx264')) throw new Error('Bundled ffmpeg does not provide libx264');
console.log(`Prepared verified FFmpeg binaries in ${dest}`);
