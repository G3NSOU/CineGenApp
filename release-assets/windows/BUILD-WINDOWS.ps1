$ErrorActionPreference = 'Stop'

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'This build must run on Windows.' }
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -and $env:PROCESSOR_ARCHITEW6432 -ne 'AMD64') { throw 'Windows x64 (AMD64) is required.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22 LTS x64 first.' }
$nodeMajor = node -p "process.versions.node.split('.')[0]"
if ($nodeMajor -ne '22') { throw "Node.js 22.x is required; found $(node --version)." }

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "`n[1/6] Installing and testing backend" -ForegroundColor Cyan
Push-Location backend-node
try {
  npm ci
  node --test
} finally { Pop-Location }

Write-Host "`n[2/6] Installing, testing, and building frontend" -ForegroundColor Cyan
Push-Location frontweb
try {
  npm ci
  node --test
  npm run build
} finally { Pop-Location }

Write-Host "`n[3/6] Installing Electron dependencies" -ForegroundColor Cyan
Push-Location desktop
try { npm ci } finally { Pop-Location }

Write-Host "`n[4/6] Building and auditing NSIS installer" -ForegroundColor Cyan
Push-Location desktop
try { npm run dist:win } finally { Pop-Location }

Write-Host "`n[5/6] Testing a clean first launch" -ForegroundColor Cyan
$smoke = Join-Path $root '.smoke-user-data'
Remove-Item $smoke -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory $smoke | Out-Null
$oldCineGenUserData = $env:CINEGEN_USER_DATA_DIR
$env:CINEGEN_USER_DATA_DIR = $smoke
try {
  $process = Start-Process (Join-Path $root 'desktop\release\win-unpacked\CineGen.exe') -PassThru
  $dbPath = Join-Path $smoke 'backend\data\drama_generator.db'
  for ($i = 0; $i -lt 40 -and -not (Test-Path $dbPath); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Test-Path $dbPath)) { throw 'Clean first launch did not create its database.' }
  node (Join-Path $root 'AUDIT-CLEAN-DATABASE.js') $dbPath
} finally {
  if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
  $env:CINEGEN_USER_DATA_DIR = $oldCineGenUserData
  Remove-Item $smoke -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n[6/6] Writing checksum" -ForegroundColor Cyan
$installer = Get-ChildItem (Join-Path $root 'desktop\release') -Filter 'CineGen-*-windows-x64-setup.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $installer) { throw 'Installer not found after build.' }
$hash = Get-FileHash $installer.FullName -Algorithm SHA256
"$($hash.Hash.ToLower())  $($installer.Name)" | Set-Content -Encoding ascii (Join-Path $root 'desktop\release\SHA256SUMS.txt')
Write-Host "Build complete: $($installer.FullName)" -ForegroundColor Green
Write-Host "SHA-256: $($hash.Hash)"
