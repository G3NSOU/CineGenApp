$ErrorActionPreference = 'Stop'

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'CineGen Windows build must run on Windows.' }
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -and $env:PROCESSOR_ARCHITEW6432 -ne 'AMD64') {
  throw 'CineGen Windows build requires Windows x64 (AMD64).'
}

$desktop = Split-Path -Parent $PSScriptRoot
Set-Location $desktop

Write-Host "`n========== CineGen Windows x64 clean build ==========`n" -ForegroundColor Cyan
npm run icons:win
npm run prepare:ffmpeg:win
npm run prepare-backend
npm run build:front
npm run copy-front
npm run clean:unpacked
npx electron-builder --win nsis --x64 --config electron-builder-win.json
node scripts/audit-packaged-app.js

$installer = Get-ChildItem (Join-Path $desktop 'release') -Filter 'CineGen-*-windows-x64-setup.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) { throw 'Windows installer was not generated.' }
$hash = Get-FileHash $installer.FullName -Algorithm SHA256
Write-Host "`nBuild complete: $($installer.FullName)" -ForegroundColor Green
Write-Host "SHA-256: $($hash.Hash)"
