#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifests = [
  'frontweb/package.json',
  'backend-node/package.json',
  'desktop/package.json',
]
const lockfiles = [
  'frontweb/package-lock.json',
  'backend-node/package-lock.json',
  'desktop/package-lock.json',
]
const yamlVersionFiles = [
  'backend-node/configs/config.yaml',
]
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'))
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(rootDir, relativePath), `${JSON.stringify(value, null, 2)}\n`)
}

function resolveNextVersion(currentVersion, requestedVersion) {
  const match = currentVersion.match(semverPattern)
  if (!match) throw new Error(`当前版本不是标准 SemVer：${currentVersion}`)

  const [, major, minor, patch] = match.map(Number)
  if (requestedVersion === 'patch') return `${major}.${minor}.${patch + 1}`
  if (requestedVersion === 'minor') return `${major}.${minor + 1}.0`
  if (requestedVersion === 'major') return `${major + 1}.0.0`
  if (semverPattern.test(requestedVersion)) return requestedVersion

  throw new Error('用法：node release-tools/bump-version.js <patch|minor|major|x.y.z>')
}

const requestedVersion = process.argv[2]
if (!requestedVersion) {
  throw new Error('缺少版本参数。用法：node release-tools/bump-version.js <patch|minor|major|x.y.z>')
}

const currentVersion = readJson('desktop/package.json').version
const nextVersion = resolveNextVersion(currentVersion, requestedVersion)

for (const relativePath of manifests) {
  const manifest = readJson(relativePath)
  manifest.version = nextVersion
  writeJson(relativePath, manifest)
}

for (const relativePath of lockfiles) {
  const lockfile = readJson(relativePath)
  lockfile.version = nextVersion
  if (lockfile.packages?.['']) lockfile.packages[''].version = nextVersion
  writeJson(relativePath, lockfile)
}

for (const relativePath of yamlVersionFiles) {
  const absolutePath = path.join(rootDir, relativePath)
  const source = fs.readFileSync(absolutePath, 'utf8')
  const updated = source.replace(/^(\s*version:\s*).+$/m, `$1${nextVersion}`)
  if (updated === source) throw new Error(`未在 ${relativePath} 找到 app.version`)
  fs.writeFileSync(absolutePath, updated)
}

console.log(`CineGen version: ${currentVersion} -> ${nextVersion}`)
