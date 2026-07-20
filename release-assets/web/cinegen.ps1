param([ValidateSet('install','start','stop','restart','status','logs')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root 'backend-node'
$Runtime = Join-Path $Root '.runtime'
$PidFile = Join-Path $Runtime 'backend.pid'
$OutLog = Join-Path $Runtime 'backend.log'
$ErrLog = Join-Path $Runtime 'backend-error.log'
$Port = if ($env:PORT) { $env:PORT } else { '5679' }

function Require-Node22 {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '缺少 Node.js 22 LTS' }
  $major = node -p "process.versions.node.split('.')[0]"
  if ($major -ne '22') { throw "需要 Node.js 22.x，当前为 $(node --version)" }
}
function Is-Running {
  if (-not (Test-Path $PidFile)) { return $false }
  $savedPid = [int](Get-Content $PidFile -Raw)
  return [bool](Get-Process -Id $savedPid -ErrorAction SilentlyContinue)
}
function Install-App {
  Require-Node22
  New-Item -ItemType Directory -Force (Join-Path $Backend 'data\storage'), $Runtime | Out-Null
  Push-Location $Backend; try { npm ci --omit=dev } finally { Pop-Location }
  if (-not (Test-Path (Join-Path $Root 'frontweb\dist\index.html'))) {
    Push-Location (Join-Path $Root 'frontweb'); try { npm ci; npm run build } finally { Pop-Location }
  }
  Write-Host 'CineGen Web 依赖安装完成' -ForegroundColor Green
}
function Start-App {
  Require-Node22
  if (-not (Test-Path (Join-Path $Backend 'node_modules'))) { Install-App }
  if (Is-Running) { Write-Host "CineGen 已运行：http://127.0.0.1:$Port"; return }
  New-Item -ItemType Directory -Force $Runtime, (Join-Path $Backend 'data\storage') | Out-Null
  $env:PORT = $Port
  $process = Start-Process node -ArgumentList 'src/server.js' -WorkingDirectory $Backend -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog -PassThru -WindowStyle Hidden
  Set-Content -NoNewline $PidFile $process.Id
  for ($i=0; $i -lt 40; $i++) {
    try { $health = Invoke-RestMethod "http://127.0.0.1:$Port/health" -TimeoutSec 2; if ($health.status -eq 'ok') { Write-Host "CineGen 已启动：http://127.0.0.1:$Port" -ForegroundColor Green; return } } catch {}
    Start-Sleep -Milliseconds 500
  }
  throw "启动失败，请查看 $ErrLog"
}
function Stop-App {
  if (-not (Is-Running)) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue; Write-Host 'CineGen 未运行'; return }
  $savedPid = [int](Get-Content $PidFile -Raw)
  Stop-Process -Id $savedPid
  Remove-Item $PidFile -Force
  Write-Host 'CineGen 已停止'
}
switch ($Action) {
  'install' { Install-App }
  'start' { Start-App }
  'stop' { Stop-App }
  'restart' { Stop-App; Start-App }
  'status' { if (Is-Running) { Write-Host "运行中：http://127.0.0.1:$Port" } else { Write-Host '未运行'; exit 1 } }
  'logs' { New-Item -ItemType File -Force $OutLog, $ErrLog | Out-Null; Get-Content $OutLog, $ErrLog -Wait }
}
