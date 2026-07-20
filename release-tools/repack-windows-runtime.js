#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { once } = require('events')
const asar = require('../desktop/node_modules/@electron/asar')

const repo = path.resolve(__dirname, '..')
const runtime = path.resolve(process.argv[2] || '')
const desktop = path.join(repo, 'desktop')
const version = require(path.join(desktop, 'package.json')).version
const expectedElectron = require(path.join(desktop, 'node_modules', 'electron', 'package.json')).version

async function main() {
if (!process.argv[2]) throw new Error('Usage: node release-tools/repack-windows-runtime.js <extracted-windows-runtime>')

const executable = path.join(runtime, 'CineGen.exe')
const resources = path.join(runtime, 'resources')
const archive = path.join(resources, 'app.asar')
const unpacked = `${archive}.unpacked`
for (const required of [executable, archive, unpacked]) {
  if (!fs.existsSync(required)) throw new Error(`Missing extracted Windows runtime item: ${required}`)
}

const oldPackage = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'))
const currentPackage = require(path.join(desktop, 'package.json'))
for (const name of Object.keys(currentPackage.dependencies || {})) {
  const oldDependency = JSON.parse(asar.extractFile(archive, `node_modules/${name}/package.json`).toString('utf8')).version
  const currentDependency = require(path.join(desktop, 'node_modules', name, 'package.json')).version
  if (oldDependency !== currentDependency) {
    throw new Error(`Cannot reuse Windows runtime: ${name} is ${oldDependency}, current build requires ${currentDependency}`)
  }
}

const executableBytes = fs.readFileSync(executable)
if (!executableBytes.includes(Buffer.from(`Electron v${expectedElectron}`))) {
  throw new Error(`Cannot reuse Windows runtime: expected Electron ${expectedElectron}`)
}

const appSource = path.join(runtime, '.cinegen-repack-source')
fs.rmSync(appSource, { recursive: true, force: true })
fs.mkdirSync(appSource, { recursive: true })
asar.extractAll(archive, appSource)
fs.cpSync(unpacked, appSource, { recursive: true })

function replace(relativePath, sourcePath) {
  const destination = path.join(appSource, relativePath)
  fs.rmSync(destination, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.cpSync(sourcePath, destination, { recursive: true })
}

for (const name of ['main.js', 'preload.js', 'package.json']) {
  replace(name, path.join(desktop, name))
}
replace('assets', path.join(desktop, 'assets'))
replace('backend-app', path.join(desktop, 'backend-app'))

fs.rmSync(archive, { force: true })
fs.rmSync(unpacked, { recursive: true, force: true })
const archiveStream = await asar.createPackageWithOptions(appSource, archive, {
  unpackDir: 'node_modules/{better-sqlite3,sharp,@img/sharp-win32-x64}',
})
if (!archiveStream.writableFinished) await once(archiveStream, 'finish')
fs.rmSync(appSource, { recursive: true, force: true })

const frontendTarget = path.join(resources, 'frontweb', 'dist')
fs.rmSync(frontendTarget, { recursive: true, force: true })
fs.mkdirSync(path.dirname(frontendTarget), { recursive: true })
fs.cpSync(path.join(repo, 'frontweb', 'dist'), frontendTarget, { recursive: true })

function patchExecutableVersion(buffer, fromVersion, toVersion) {
  const [fromMajor, fromMinor, fromPatch] = fromVersion.split('.').map(Number)
  const [toMajor, toMinor, toPatch] = toVersion.split('.').map(Number)
  const fromMS = (fromMajor << 16) | fromMinor
  const fromLS = fromPatch << 16
  const toMS = (toMajor << 16) | toMinor
  const toLS = toPatch << 16
  const signature = Buffer.from([0xbd, 0x04, 0xef, 0xfe])
  let cursor = 0
  let fixedInfoUpdates = 0
  while ((cursor = buffer.indexOf(signature, cursor)) >= 0) {
    if (
      buffer.readUInt32LE(cursor + 4) === 0x00010000 &&
      buffer.readUInt32LE(cursor + 8) === fromMS &&
      buffer.readUInt32LE(cursor + 12) === fromLS &&
      buffer.readUInt32LE(cursor + 16) === fromMS &&
      buffer.readUInt32LE(cursor + 20) === fromLS
    ) {
      buffer.writeUInt32LE(toMS, cursor + 8)
      buffer.writeUInt32LE(toLS, cursor + 12)
      buffer.writeUInt32LE(toMS, cursor + 16)
      buffer.writeUInt32LE(toLS, cursor + 20)
      fixedInfoUpdates += 1
    }
    cursor += signature.length
  }
  const oldText = Buffer.from(fromVersion, 'utf16le')
  const newText = Buffer.from(toVersion, 'utf16le')
  let textUpdates = 0
  cursor = 0
  while ((cursor = buffer.indexOf(oldText, cursor)) >= 0) {
    newText.copy(buffer, cursor)
    textUpdates += 1
    cursor += oldText.length
  }
  if (fixedInfoUpdates !== 1 || textUpdates < 1) {
    throw new Error(`Unexpected PE version resources: fixed=${fixedInfoUpdates}, text=${textUpdates}`)
  }
}

patchExecutableVersion(executableBytes, oldPackage.version, version)
fs.writeFileSync(executable, executableBytes)

asar.uncache(archive)
const packedPackage = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'))
if (packedPackage.version !== version) throw new Error(`Repacked app.asar version is ${packedPackage.version}`)
for (const file of [
  path.join(unpacked, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
  path.join(unpacked, 'node_modules', '@img', 'sharp-win32-x64', 'lib', 'sharp-win32-x64.node'),
  path.join(resources, 'ffmpeg', 'ffmpeg.exe'),
  path.join(resources, 'ffmpeg', 'ffprobe.exe'),
]) {
  if (!fs.existsSync(file)) throw new Error(`Repacked runtime is missing ${file}`)
}

console.log(`Repacked Windows runtime ${oldPackage.version} -> ${version}`)
console.log(`Electron ${expectedElectron}; all runtime dependency versions matched`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
